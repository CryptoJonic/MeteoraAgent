import { CampaignEngine } from '../core/campaign-engine';
import { aggregateCandles, ReplayEngine, type ReplayStepResult } from '../core/replay-engine';
import {
  HISTORY_MIN_TIME,
  type CampaignConfig,
  type Candle,
  type MarketSymbol,
  type StoredReplayState,
} from '../core/types';
import type { LoadMarketDataOptions, MarketDataProvider } from '../data/market-data-provider';
import { CampaignStore, campaignResultFromState } from '../storage/campaign-store';

const DAY_SECONDS = 86_400;
const INITIAL_LOOKBACK_DAYS = 21;
const INITIAL_FORWARD_DAYS = 45;
const EXTENSION_DAYS = 45;

export interface MarketWindow {
  symbol: MarketSymbol;
  startTime: number;
  endTime: number;
  replayStartTime: number;
}

export class CampaignController {
  private marketCandles: Candle[] = [];
  private marketWindowValue: MarketWindow | null = null;
  private replayValue: ReplayEngine | null = null;
  private loadingAbort: AbortController | null = null;

  public constructor(
    private readonly provider: MarketDataProvider,
    private readonly store: CampaignStore,
  ) {}

  public get replay(): ReplayEngine | null {
    return this.replayValue;
  }

  public get window(): MarketWindow | null {
    return this.marketWindowValue;
  }

  public async loadMarketWindow(
    symbol: MarketSymbol,
    replayStartTime: number,
    options: LoadMarketDataOptions = {},
  ): Promise<Candle[]> {
    this.loadingAbort?.abort();
    this.loadingAbort = new AbortController();
    const startTime = Math.max(
      HISTORY_MIN_TIME,
      replayStartTime - INITIAL_LOOKBACK_DAYS * DAY_SECONDS,
    );
    const now = Math.floor(Date.now() / 300_000) * 300;
    const endTime = Math.min(now, replayStartTime + INITIAL_FORWARD_DAYS * DAY_SECONDS);
    if (endTime <= startTime) throw new Error('Для выбранной даты ещё нет завершённых свечей.');
    const signal = this.loadingAbort.signal;
    if (options.signal) {
      options.signal.addEventListener('abort', () => this.loadingAbort?.abort(), { once: true });
    }
    this.marketCandles = await this.provider.loadFiveMinuteCandles(symbol, startTime, endTime, {
      signal,
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });
    this.marketWindowValue = { symbol, startTime, endTime, replayStartTime };
    this.replayValue = null;
    return this.preReplayHourlyCandles();
  }

  public preReplayHourlyCandles(): Candle[] {
    const replayStartTime = this.marketWindowValue?.replayStartTime ?? Number.POSITIVE_INFINITY;
    return aggregateCandles(this.marketCandles.filter((candle) => candle.time < replayStartTime));
  }

  public startCampaign(config: CampaignConfig): ReplayEngine {
    if (!this.marketWindowValue || this.marketWindowValue.symbol !== config.symbol) {
      throw new Error('Сначала загрузите историю выбранной монеты.');
    }
    const finishedReplay = this.replayValue?.campaign.state.status === 'ACTIVE'
      ? null
      : this.replayValue;
    const previous = finishedReplay?.lastVisibleCandle ?? [...this.marketCandles]
      .reverse()
      .find((candle) => candle.time < config.startTime);
    const next = finishedReplay?.nextCandle ?? this.marketCandles.find(
      (candle) => candle.time >= config.startTime,
    );
    const initialPrice = previous?.close ?? next?.open;
    if (initialPrice === undefined) throw new Error('Нет цены для старта кампании.');
    const campaign = new CampaignEngine(config, config.galkaPrice);
    if (initialPrice !== config.galkaPrice) {
      campaign.processPrice(initialPrice, config.startTime);
    }
    this.replayValue = finishedReplay
      ? finishedReplay.continueWith(campaign)
      : new ReplayEngine(this.marketCandles, campaign);
    this.store.saveConfig(config);
    this.persist();
    return this.replayValue;
  }

  public async restoreActive(stored: StoredReplayState): Promise<ReplayEngine> {
    const state = stored.replay.campaign;
    const symbol = state.config.symbol;
    this.marketCandles = await this.provider.loadFiveMinuteCandles(
      symbol,
      stored.marketWindowStart,
      stored.marketWindowEnd,
    );
    this.marketWindowValue = {
      symbol,
      startTime: stored.marketWindowStart,
      endTime: stored.marketWindowEnd,
      replayStartTime: state.config.startTime,
    };
    this.replayValue = ReplayEngine.restore(this.marketCandles, stored.replay);
    return this.replayValue;
  }

  public stepFiveMinute(count: number): ReplayStepResult {
    const replay = this.requireReplay();
    const result = replay.stepFiveMinute(count);
    this.afterMutation();
    return result;
  }

  public stepOneHour(): ReplayStepResult {
    const result = this.requireReplay().stepOneHour();
    this.afterMutation();
    return result;
  }

  public stepHours(count: number): ReplayStepResult {
    const result = this.requireReplay().stepHours(count);
    this.afterMutation();
    return result;
  }

  public nextCampaignStartTime(): number {
    const replay = this.replayValue;
    if (replay && replay.campaign.state.status !== 'ACTIVE') {
      return replay.nextCandleTime ?? replay.campaign.state.currentTime;
    }
    return this.marketWindowValue?.replayStartTime ?? 0;
  }

  public jumpToNextEvent(): ReplayStepResult {
    const result = this.requireReplay().jumpToNextEvent();
    this.afterMutation();
    return result;
  }

  public stopCampaign(): void {
    const replay = this.requireReplay();
    replay.campaign.stop(replay.campaign.state.currentTime, replay.campaign.state.currentPrice);
    this.afterMutation();
  }

  public async extendMarketData(options: LoadMarketDataOptions = {}): Promise<boolean> {
    const windowState = this.marketWindowValue;
    const replay = this.replayValue;
    if (!windowState || !replay || !replay.exhausted || replay.campaign.state.status !== 'ACTIVE') {
      return false;
    }
    const now = Math.floor(Date.now() / 300_000) * 300;
    if (windowState.endTime >= now) return false;
    const nextEnd = Math.min(now, windowState.endTime + EXTENSION_DAYS * DAY_SECONDS);
    const rows = await this.provider.loadFiveMinuteCandles(
      windowState.symbol,
      windowState.endTime,
      nextEnd,
      options,
    );
    replay.appendCandles(rows);
    this.marketCandles = [...new Map([...this.marketCandles, ...rows].map((row) => [row.time, row])).values()]
      .sort((left, right) => left.time - right.time);
    windowState.endTime = nextEnd;
    this.persist();
    return rows.length > 0;
  }

  public chartCandles(): Candle[] {
    return this.replayValue?.visibleHourlyCandles() ?? this.preReplayHourlyCandles();
  }

  public visibleAnalysisCandles(): Candle[] {
    if (this.replayValue) return this.replayValue.visibleFiveMinuteCandles();
    const startTime = this.marketWindowValue?.replayStartTime ?? Number.POSITIVE_INFINITY;
    return this.marketCandles
      .filter((candle) => candle.time < startTime)
      .map((candle) => ({ ...candle }));
  }

  public persist(): void {
    if (!this.replayValue || !this.marketWindowValue) return;
    this.store.saveActive({
      savedAt: Date.now(),
      marketWindowStart: this.marketWindowValue.startTime,
      marketWindowEnd: this.marketWindowValue.endTime,
      replay: this.replayValue.snapshot(),
    });
  }

  private requireReplay(): ReplayEngine {
    if (!this.replayValue) throw new Error('Кампания ещё не запущена.');
    return this.replayValue;
  }

  private afterMutation(): void {
    const replay = this.requireReplay();
    const state = replay.campaign.state;
    if (state.status === 'COMPLETED' || state.status === 'STOPPED') {
      this.store.addResult(campaignResultFromState(replay.campaign.snapshot()));
      this.store.clearActive();
    } else {
      this.persist();
    }
  }
}
