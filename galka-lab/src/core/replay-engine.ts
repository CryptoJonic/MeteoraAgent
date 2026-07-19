import { CampaignEngine } from './campaign-engine';
import {
  ONE_HOUR_SECONDS,
  type CampaignEvent,
  type Candle,
  type ReplaySnapshot,
} from './types';

export interface ReplayStepResult {
  processed: number;
  events: CampaignEvent[];
  exhausted: boolean;
  campaignEnded: boolean;
}

function sortAndDedupe(candles: readonly Candle[]): Candle[] {
  const rows = new Map<number, Candle>();
  for (const candle of candles) rows.set(candle.time, { ...candle });
  return [...rows.values()].sort((left, right) => left.time - right.time);
}

export function aggregateCandles(
  candles: readonly Candle[],
  timeframeSeconds = ONE_HOUR_SECONDS,
): Candle[] {
  const buckets = new Map<number, Candle>();
  for (const candle of candles) {
    const bucketTime = Math.floor(candle.time / timeframeSeconds) * timeframeSeconds;
    const existing = buckets.get(bucketTime);
    if (!existing) {
      buckets.set(bucketTime, { ...candle, time: bucketTime });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
  }
  return [...buckets.values()].sort((left, right) => left.time - right.time);
}

export class ReplayEngine {
  private candles: Candle[];
  private cursorValue: number;
  public readonly campaign: CampaignEngine;

  public constructor(candles: readonly Candle[], campaign: CampaignEngine, cursor?: number) {
    this.candles = sortAndDedupe(candles);
    this.campaign = campaign;
    const defaultCursor = this.candles.findIndex(
      (candle) => candle.time >= campaign.state.config.startTime,
    );
    this.cursorValue = cursor ?? (defaultCursor < 0 ? this.candles.length : defaultCursor);
    if (!Number.isInteger(this.cursorValue) || this.cursorValue < 0 || this.cursorValue > this.candles.length) {
      throw new RangeError('Replay cursor is outside the market data window.');
    }
  }

  public static restore(candles: readonly Candle[], snapshot: ReplaySnapshot): ReplayEngine {
    return new ReplayEngine(
      candles,
      CampaignEngine.restore(snapshot.campaign),
      snapshot.cursor,
    );
  }

  public get cursor(): number {
    return this.cursorValue;
  }

  public get exhausted(): boolean {
    return this.cursorValue >= this.candles.length;
  }

  public get totalCandles(): number {
    return this.candles.length;
  }

  public get nextCandleTime(): number | null {
    return this.candles[this.cursorValue]?.time ?? null;
  }

  public visibleFiveMinuteCandles(): Candle[] {
    return this.candles.slice(0, this.cursorValue).map((candle) => ({ ...candle }));
  }

  public visibleHourlyCandles(): Candle[] {
    return aggregateCandles(this.visibleFiveMinuteCandles());
  }

  public stepFiveMinute(count = 1): ReplayStepResult {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError('Replay step count must be a positive integer.');
    }
    const events: CampaignEvent[] = [];
    let processed = 0;
    while (
      processed < count &&
      this.cursorValue < this.candles.length &&
      this.campaign.state.status === 'ACTIVE'
    ) {
      const candle = this.candles[this.cursorValue];
      if (!candle) break;
      events.push(...this.campaign.processCandle(candle));
      this.cursorValue += 1;
      processed += 1;
    }
    return {
      processed,
      events,
      exhausted: this.exhausted,
      campaignEnded: this.campaign.state.status !== 'ACTIVE',
    };
  }

  public stepOneHour(): ReplayStepResult {
    const next = this.candles[this.cursorValue];
    if (!next) {
      return { processed: 0, events: [], exhausted: true, campaignEnded: this.campaign.state.status !== 'ACTIVE' };
    }
    const bucket = Math.floor(next.time / ONE_HOUR_SECONDS);
    const events: CampaignEvent[] = [];
    let processed = 0;
    while (
      this.cursorValue < this.candles.length &&
      this.campaign.state.status === 'ACTIVE'
    ) {
      const candle = this.candles[this.cursorValue];
      if (!candle || Math.floor(candle.time / ONE_HOUR_SECONDS) !== bucket) break;
      const result = this.stepFiveMinute(1);
      processed += result.processed;
      events.push(...result.events);
    }
    return {
      processed,
      events,
      exhausted: this.exhausted,
      campaignEnded: this.campaign.state.status !== 'ACTIVE',
    };
  }

  public jumpToNextEvent(maxCandles = 100_000): ReplayStepResult {
    if (!Number.isInteger(maxCandles) || maxCandles < 1) {
      throw new RangeError('Jump limit must be a positive integer.');
    }
    let processed = 0;
    while (
      processed < maxCandles &&
      this.cursorValue < this.candles.length &&
      this.campaign.state.status === 'ACTIVE'
    ) {
      const result = this.stepFiveMinute(1);
      processed += result.processed;
      if (result.events.length > 0) {
        return { ...result, processed };
      }
    }
    return {
      processed,
      events: [],
      exhausted: this.exhausted,
      campaignEnded: this.campaign.state.status !== 'ACTIVE',
    };
  }

  public appendCandles(candles: readonly Candle[]): void {
    if (candles.length === 0) return;
    const lastVisibleTime = this.candles[this.cursorValue - 1]?.time ?? Number.NEGATIVE_INFINITY;
    this.candles = sortAndDedupe([...this.candles, ...candles]);
    const newCursor = this.candles.findIndex((candle) => candle.time > lastVisibleTime);
    this.cursorValue = newCursor < 0 ? this.candles.length : newCursor;
  }

  public allCandlesForAnalysis(): Candle[] {
    return this.candles.map((candle) => ({ ...candle }));
  }

  public snapshot(): ReplaySnapshot {
    return {
      version: 1,
      cursor: this.cursorValue,
      campaign: this.campaign.snapshot(),
    };
  }
}
