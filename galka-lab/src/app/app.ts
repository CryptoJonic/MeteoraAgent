import { calculatePoolBoundaries, createCampaignConfig, poolFillPct, poolSoldPct } from '../core/pool-engine';
import {
  HISTORY_MIN_TIME,
  type CampaignState,
  type MarketSymbol,
} from '../core/types';
import { BinanceProvider } from '../data/binance-provider';
import { IndexedDbCandleCache } from '../data/cache';
import { CampaignStore } from '../storage/campaign-store';
import { MeasurementStore } from '../storage/measurement-store';
import { CampaignController } from './campaign-controller';
import { ChartController, type ChartPoint } from './chart-controller';
import { MeasurementController } from './measurement-controller';

const SPEEDS = [1, 10, 50, 200] as const;

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Required element #${id} is missing.`);
  return value as T;
}

function money(value: number): string {
  return `${value < 0 ? '−' : ''}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function signedMoney(value: number): string {
  return `${value >= 0 ? '+' : '−'}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function price(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function quantity(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return value.toLocaleString('en-US', { maximumSignificantDigits: 8 });
}

function duration(seconds: number | null): string {
  if (seconds === null) return 'нет возврата';
  const totalHours = Math.max(0, Math.floor(seconds / 3_600));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}д ${hours}ч` : `${hours}ч`;
}

function dateTime(seconds: number | null): string {
  if (seconds === null) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(seconds * 1_000));
}

function datetimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function randomId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `campaign-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class GalkaLabApp {
  private readonly campaignStore = new CampaignStore();
  private readonly measurementStore = new MeasurementStore();
  private readonly campaignController = new CampaignController(
    new BinanceProvider(new IndexedDbCandleCache()),
    this.campaignStore,
  );
  private readonly measurementController = new MeasurementController(this.measurementStore);
  private readonly chart: ChartController;
  private speed: (typeof SPEEDS)[number] = 1;
  private playTimer: number | null = null;
  private playBusy = false;
  private historyDirty = false;
  private measurementMode = false;
  private toastTimer: number | null = null;

  public constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = this.template();
    this.chart = new ChartController(element('chartHost'), {
      onPointSelected: (point) => this.onChartPoint(point),
      onCrosshair: (point) => this.renderCrosshair(point),
      onLowerPriceChanged: (value) => this.setLowerPrice(value),
    });
    this.installEvents();
    this.setDefaultDate();
  }

  public async start(): Promise<void> {
    const stored = this.campaignStore.loadActive();
    if (stored) {
      try {
        this.showLoading('Восстановление активной кампании…');
        const config = stored.replay.campaign.config;
        this.symbolInput.value = config.symbol;
        this.startInput.value = datetimeLocalValue(new Date(config.startTime * 1_000));
        this.galkaInput.value = String(config.galkaPrice);
        this.lowerInput.value = String(config.lowerPrice);
        this.depthInput.value = String(config.rangePct * 100);
        await this.campaignController.restoreActive(stored);
        this.historyDirty = false;
        this.updateRangeVisual();
        this.chart.setCandles(this.campaignController.chartCandles(), true);
        this.chart.setRangeEditable(false);
        this.render();
        this.toast('Активная кампания восстановлена', 'ok');
        return;
      } catch (error) {
        this.toast(this.message(error), 'error');
      } finally {
        this.hideLoading();
      }
    }
    await this.loadHistory(true);
  }

  private get symbolInput(): HTMLSelectElement {
    return element('symbolSelect');
  }

  private get startInput(): HTMLInputElement {
    return element('startTime');
  }

  private get galkaInput(): HTMLInputElement {
    return element('galkaPrice');
  }

  private get lowerInput(): HTMLInputElement {
    return element('lowerPrice');
  }

  private get depthInput(): HTMLInputElement {
    return element('depthPct');
  }

  private template(): string {
    return `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand"><span class="brand-mark">G</span><span><b>GALKA LAB</b><small>HISTORICAL TRAINER</small></span></div>
          <div class="mode-tabs" aria-label="Режим стратегии">
            <button class="active" type="button">POOL</button>
            <button class="soon" type="button" disabled>FAST PERP <small>ПОЗЖЕ</small></button>
          </div>
          <div class="execution-badges"><span>График <b>1h</b></span><span>Исполнение <b>5m</b></span></div>
          <div id="campaignBadge" class="campaign-badge idle">SETUP</div>
        </header>

        <main class="main-grid">
          <section class="terminal-panel">
            <div class="market-toolbar">
              <label><span>Монета</span><select id="symbolSelect"><option value="BTCUSDT">BTC</option><option value="ETHUSDT">ETH</option><option value="SOLUSDT">SOL</option></select></label>
              <label class="date-field"><span>Старт replay</span><input id="startTime" type="datetime-local" min="2023-01-01T00:00"></label>
              <button id="loadHistory" class="secondary" type="button">Загрузить историю</button>
              <span id="marketStatus" class="market-status">Ожидание</span>
              <div class="chart-actions"><button id="fitChart" type="button">Fit</button><button id="latestChart" type="button">К replay</button></div>
            </div>

            <div id="chartHost" class="chart-host">
              <div class="chart-watermark"><b id="watermarkSymbol">BTC</b><span>POOL SIMULATOR</span></div>
              <div id="chartLoading" class="chart-loading hidden"><span class="spinner"></span><b id="loadingText">Загрузка…</b></div>
              <div id="toast" class="toast hidden"></div>
            </div>

            <div class="crosshair-strip">
              <span>Курсор <b id="crosshairTime">—</b></span>
              <span>Цена <b id="crosshairPrice">—</b></span>
              <span>Replay <b id="replayTime">—</b></span>
              <span id="leakageGuard">Будущее скрыто</span>
            </div>

            <div class="replay-controls">
              <button id="stepHour" type="button">Следующая свеча</button>
              <button id="play" class="play" type="button">▶ Воспроизведение</button>
              <button id="pause" type="button">Ⅱ Пауза</button>
              <div id="speedButtons" class="speed-buttons">
                ${SPEEDS.map((value) => `<button data-speed="${value}" class="${value === 1 ? 'active' : ''}" type="button">×${value}</button>`).join('')}
              </div>
              <button id="jumpEvent" class="event-jump" type="button">До следующего события</button>
              <button id="stopCampaign" class="danger" type="button">Остановить кампанию</button>
            </div>
          </section>

          <aside class="side-panel">
            <div class="panel-tabs">
              <button id="campaignTab" class="active" type="button">Кампания</button>
              <button id="measurementTab" type="button">Измерения</button>
            </div>

            <div id="campaignPane">
              <section class="card setup-card">
                <div class="card-head"><div><small>POOL CAMPAIGN</small><b>Настройка диапазона</b></div><span class="paper-pill">SIMULATION</span></div>
                <div class="setup-grid">
                  <label><span>GALKA</span><input id="galkaPrice" type="number" min="0" step="any" inputmode="decimal"></label>
                  <label><span>Нижняя цена</span><input id="lowerPrice" type="number" min="0" step="any" inputmode="decimal"></label>
                  <label><span>Глубина, %</span><input id="depthPct" type="number" min="0.01" max="95" step="0.01" inputmode="decimal" value="15"></label>
                  <label><span>Депозит</span><input type="text" value="$1 200" readonly></label>
                </div>
                <p class="hint">Нажмите на график, чтобы зафиксировать GALKA. Красный маркер справа меняет низ диапазона.</p>
                <div id="rangeSummary" class="range-summary"></div>
                <button id="startCampaign" class="primary wide" type="button">Запустить кампанию</button>
              </section>

              <section class="card stats-card">
                <div class="card-head"><div><small>ACTIVE ACCOUNTING</small><b>Состояние кампании</b></div><span id="durationValue">0ч</span></div>
                <div class="stats-grid">
                  <span><small>USDC свободно</small><b id="freeUsdc">$1,200.00</b></span>
                  <span><small>Зафиксировано</small><b id="lockedUsdc">$0.00</b></span>
                  <span><small>Монета</small><b id="assetQuantity">0</b></span>
                  <span><small>Стоимость позиции</small><b id="positionValue">$0.00</b></span>
                  <span><small>Средняя покупка</small><b id="averageEntry">—</b></span>
                  <span><small>Реализованный PnL</small><b id="realizedPnl">$0.00</b></span>
                  <span><small>Нереализованный PnL</small><b id="unrealizedPnl">$0.00</b></span>
                  <span class="emphasis"><small>Итоговый PnL</small><b id="totalPnl">$0.00</b></span>
                  <span><small>Макс. просадка</small><b id="maxDrawdown">$0.00</b></span>
                  <span><small>Минимум кампании</small><b id="lowestPrice">—</b></span>
                </div>
                <div id="poolProgress" class="pool-progress"></div>
              </section>

              <section class="card">
                <div class="card-head"><div><small>EVENT STREAM</small><b>События</b></div><span id="eventCount">0</span></div>
                <div id="eventLog" class="event-log"><p class="empty">Кампания ещё не запущена.</p></div>
              </section>

              <section class="card">
                <div class="card-head"><div><small>LOCAL RESULTS</small><b>Последние кампании</b></div></div>
                <div id="campaignResults" class="results-list"></div>
              </section>
            </div>

            <div id="measurementPane" class="hidden">
              <section class="card measurement-guide">
                <div class="card-head"><div><small>HISTORICAL RANGE TOOL</small><b>Измерение GALKA</b></div><span id="measurementStep">1 / 2</span></div>
                <p>Первое нажатие — историческая GALKA. Второе — нижняя точка движения. Возврат к GALKA будет найден автоматически только среди уже видимых свечей.</p>
                <div id="measurementDraft" class="measurement-draft">Выберите GALKA на графике.</div>
                <div class="button-row"><button id="resetMeasurement" type="button">Сбросить точки</button><button id="saveMeasurement" class="primary" type="button">Сохранить</button></div>
              </section>
              <section class="card">
                <div class="card-head"><div><small>DEPTH DISTRIBUTION</small><b>Статистика глубины</b></div><span id="measurementCount">0</span></div>
                <div id="measurementStats" class="percentile-grid"></div>
              </section>
              <section class="card">
                <div class="card-head"><div><small>SAVED SAMPLES</small><b>Измерения</b></div></div>
                <div id="measurementList" class="measurement-list"></div>
              </section>
            </div>
          </aside>
        </main>
      </div>
    `;
  }

  private installEvents(): void {
    element('loadHistory').addEventListener('click', () => void this.loadHistory(true));
    this.symbolInput.addEventListener('change', () => {
      this.historyDirty = true;
      element('watermarkSymbol').textContent = this.symbolInput.selectedOptions[0]?.text ?? '—';
      this.updateHistoryStatus();
    });
    this.startInput.addEventListener('change', () => {
      this.historyDirty = true;
      this.updateHistoryStatus();
    });
    this.galkaInput.addEventListener('input', () => this.updateLowerFromDepth());
    this.lowerInput.addEventListener('input', () => this.updateDepthFromLower());
    this.depthInput.addEventListener('input', () => this.updateLowerFromDepth());
    element('startCampaign').addEventListener('click', () => this.startCampaign());
    element('stepHour').addEventListener('click', () => void this.stepHour());
    element('play').addEventListener('click', () => this.play());
    element('pause').addEventListener('click', () => this.pause());
    element('jumpEvent').addEventListener('click', () => void this.jumpToEvent());
    element('stopCampaign').addEventListener('click', () => this.stopCampaign());
    element('fitChart').addEventListener('click', () => this.chart.fitContent());
    element('latestChart').addEventListener('click', () => this.chart.fitContent());
    element('speedButtons').addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-speed]');
      if (!button) return;
      const speed = Number(button.dataset.speed);
      if (!SPEEDS.includes(speed as (typeof SPEEDS)[number])) return;
      this.speed = speed as (typeof SPEEDS)[number];
      for (const candidate of element('speedButtons').querySelectorAll('button')) {
        candidate.classList.toggle('active', candidate === button);
      }
    });
    element('campaignTab').addEventListener('click', () => this.setPane(false));
    element('measurementTab').addEventListener('click', () => this.setPane(true));
    element('resetMeasurement').addEventListener('click', () => {
      this.measurementController.resetDraft();
      this.chart.setMeasurement(null, null);
      this.renderMeasurements();
    });
    element('saveMeasurement').addEventListener('click', () => this.saveMeasurement());
    element('measurementList').addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-measurement]');
      if (!button?.dataset.removeMeasurement) return;
      this.measurementController.remove(button.dataset.removeMeasurement);
      this.renderMeasurements();
    });
    window.addEventListener('beforeunload', () => this.campaignController.persist());
  }

  private setDefaultDate(): void {
    const defaultDate = new Date(Date.now() - 120 * 86_400_000);
    defaultDate.setMinutes(0, 0, 0);
    this.startInput.value = datetimeLocalValue(defaultDate);
    this.startInput.max = datetimeLocalValue(new Date());
  }

  private async loadHistory(fit: boolean): Promise<void> {
    if (this.campaignController.replay?.campaign.state.status === 'ACTIVE') {
      this.toast('Сначала остановите активную кампанию.', 'error');
      return;
    }
    try {
      this.pause();
      const startTime = this.selectedStartTime();
      this.showLoading('Загрузка Binance 5m…');
      const candles = await this.campaignController.loadMarketWindow(
        this.symbolInput.value as MarketSymbol,
        startTime,
        {
          onProgress: (progress) => {
            element('loadingText').textContent = progress.source === 'cache'
              ? `Кэш: ${progress.loadedCandles.toLocaleString('en-US')} свечей`
              : `Binance: ${progress.loadedCandles.toLocaleString('en-US')} свечей`;
          },
        },
      );
      this.historyDirty = false;
      this.chart.setCandles(candles, fit);
      const last = candles.at(-1);
      if (last && !Number(this.galkaInput.value)) {
        this.galkaInput.value = String(last.close);
        this.updateLowerFromDepth();
      } else {
        this.updateRangeVisual();
      }
      this.render();
      this.toast(
        candles.length > 0
          ? `Загружено ${candles.length} часовых свечей`
          : 'Старт у начала архива: укажите GALKA вручную.',
        'ok',
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.toast(this.message(error), 'error');
    } finally {
      this.hideLoading();
    }
  }

  private startCampaign(): void {
    try {
      if (this.historyDirty) throw new Error('После смены даты или монеты загрузите историю заново.');
      const galkaPrice = Number(this.galkaInput.value);
      const lowerPrice = Number(this.lowerInput.value);
      const startTime = this.selectedStartTime();
      const config = createCampaignConfig({
        id: randomId(),
        symbol: this.symbolInput.value as MarketSymbol,
        startTime,
        galkaPrice,
        lowerPrice,
      });
      this.campaignController.startCampaign(config);
      this.chart.setRangeEditable(false);
      this.setPane(false);
      this.render();
      this.toast('Кампания запущена. Будущие свечи скрыты.', 'ok');
    } catch (error) {
      this.toast(this.message(error), 'error');
    }
  }

  private async stepHour(): Promise<void> {
    this.pause();
    if (!(await this.ensureReplayData())) return;
    try {
      this.campaignController.stepOneHour();
      this.render();
    } catch (error) {
      this.toast(this.message(error), 'error');
    }
  }

  private play(): void {
    const state = this.campaignController.replay?.campaign.state;
    if (!state || state.status !== 'ACTIVE') {
      this.toast('Сначала запустите кампанию.', 'error');
      return;
    }
    if (this.playTimer !== null) return;
    element('play').classList.add('active');
    this.playTimer = window.setInterval(() => void this.playTick(), 260);
  }

  private pause(): void {
    if (this.playTimer !== null) window.clearInterval(this.playTimer);
    this.playTimer = null;
    element('play').classList.remove('active');
  }

  private async playTick(): Promise<void> {
    if (this.playBusy) return;
    this.playBusy = true;
    try {
      if (!(await this.ensureReplayData())) {
        this.pause();
        return;
      }
      this.campaignController.stepFiveMinute(this.speed);
      this.render();
      if (this.campaignController.replay?.campaign.state.status !== 'ACTIVE') this.pause();
    } catch (error) {
      this.pause();
      this.toast(this.message(error), 'error');
    } finally {
      this.playBusy = false;
    }
  }

  private async jumpToEvent(): Promise<void> {
    this.pause();
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (!(await this.ensureReplayData())) return;
        const result = this.campaignController.jumpToNextEvent();
        this.render();
        if (result.events.length > 0 || result.campaignEnded) return;
      }
      this.toast('Следующее событие не найдено в доступной истории.', 'error');
    } catch (error) {
      this.toast(this.message(error), 'error');
    }
  }

  private stopCampaign(): void {
    const state = this.campaignController.replay?.campaign.state;
    if (!state || state.status !== 'ACTIVE') return;
    if (!window.confirm(`Остановить кампанию и продать остаток по ${price(state.currentPrice)}?`)) return;
    this.pause();
    this.campaignController.stopCampaign();
    this.chart.setRangeEditable(false);
    this.render();
  }

  private async ensureReplayData(): Promise<boolean> {
    const replay = this.campaignController.replay;
    if (!replay || replay.campaign.state.status !== 'ACTIVE') return false;
    if (!replay.exhausted) return true;
    this.showLoading('Догрузка следующих 45 дней…');
    try {
      const extended = await this.campaignController.extendMarketData({
        onProgress: (progress) => {
          element('loadingText').textContent = `Догружено ${progress.loadedCandles.toLocaleString('en-US')} свечей`;
        },
      });
      if (!extended) this.toast('Доступная история закончилась.', 'error');
      return extended;
    } finally {
      this.hideLoading();
    }
  }

  private onChartPoint(point: ChartPoint): void {
    if (this.measurementMode) {
      try {
        const draft = this.measurementController.selectPoint(point);
        this.chart.setMeasurement(draft.start, draft.bottom);
        this.renderMeasurements();
      } catch (error) {
        this.toast(this.message(error), 'error');
      }
      return;
    }
    if (this.campaignController.replay?.campaign.state.status === 'ACTIVE') return;
    this.galkaInput.value = String(point.price);
    this.updateLowerFromDepth();
  }

  private setLowerPrice(value: number): void {
    if (this.campaignController.replay?.campaign.state.status === 'ACTIVE') return;
    this.lowerInput.value = String(value);
    this.updateDepthFromLower();
  }

  private updateLowerFromDepth(): void {
    const galka = Number(this.galkaInput.value);
    const depth = Number(this.depthInput.value);
    if (galka > 0 && depth > 0 && depth < 100) {
      this.lowerInput.value = String(galka * (1 - depth / 100));
    }
    this.updateRangeVisual();
  }

  private updateDepthFromLower(): void {
    const galka = Number(this.galkaInput.value);
    const lower = Number(this.lowerInput.value);
    if (galka > 0 && lower > 0 && lower < galka) {
      this.depthInput.value = String(((galka - lower) / galka) * 100);
    }
    this.updateRangeVisual();
  }

  private updateRangeVisual(): void {
    const galka = Number(this.galkaInput.value);
    const lower = Number(this.lowerInput.value);
    if (!(galka > 0 && lower > 0 && lower < galka)) {
      this.chart.setRange(null);
      element('rangeSummary').innerHTML = '<p class="empty">Укажите корректные GALKA и нижнюю цену.</p>';
      return;
    }
    const rangePct = (galka - lower) / galka;
    const boundaries = calculatePoolBoundaries(galka, rangePct);
    this.chart.setRange({ galkaPrice: galka, lowerPrice: lower, boundaries });
    element('rangeSummary').innerHTML = boundaries.slice(0, 3).map((upper, index) => {
      const bottom = boundaries[index + 1];
      return `<div><span><i class="pool-dot p${index + 1}"></i>Пул ${index + 1}</span><b>${price(upper ?? null)}–${price(bottom ?? null)}</b><small>$400</small></div>`;
    }).join('');
  }

  private setPane(measurement: boolean): void {
    this.measurementMode = measurement;
    element('campaignPane').classList.toggle('hidden', measurement);
    element('measurementPane').classList.toggle('hidden', !measurement);
    element('campaignTab').classList.toggle('active', !measurement);
    element('measurementTab').classList.toggle('active', measurement);
    this.chart.setRangeEditable(!measurement && this.campaignController.replay?.campaign.state.status !== 'ACTIVE');
    this.renderMeasurements();
  }

  private saveMeasurement(): void {
    try {
      const saved = this.measurementController.save(
        this.symbolInput.value as MarketSymbol,
        this.campaignController.visibleAnalysisCandles(),
      );
      this.chart.setMeasurement(null, null);
      this.renderMeasurements();
      this.toast(`Измерение −${saved.depthPct.toFixed(2)}% сохранено`, 'ok');
    } catch (error) {
      this.toast(this.message(error), 'error');
    }
  }

  private render(): void {
    const replay = this.campaignController.replay;
    const state = replay?.campaign.snapshot() ?? null;
    this.chart.setCandles(this.campaignController.chartCandles());
    this.chart.setCampaign(state);
    this.updateRangeVisual();
    this.renderStats(state);
    this.renderEvents(state);
    this.renderResults();
    this.renderMeasurements();
    this.updateHistoryStatus();

    const active = state?.status === 'ACTIVE';
    for (const input of [this.symbolInput, this.startInput, this.galkaInput, this.lowerInput, this.depthInput]) {
      input.disabled = active;
    }
    element<HTMLButtonElement>('loadHistory').disabled = active;
    element<HTMLButtonElement>('startCampaign').disabled = active || this.historyDirty || !this.campaignController.window;
    for (const id of ['stepHour', 'play', 'pause', 'jumpEvent', 'stopCampaign']) {
      element<HTMLButtonElement>(id).disabled = !active;
    }
    this.chart.setRangeEditable(!active && !this.measurementMode);
    element('replayTime').textContent = state ? dateTime(state.currentTime) : dateTime(this.campaignController.window?.replayStartTime ?? null);
    const badge = element('campaignBadge');
    badge.textContent = state?.status ?? 'SETUP';
    badge.className = `campaign-badge ${(state?.status ?? 'idle').toLowerCase()}`;
    if (state && state.status !== 'ACTIVE') {
      const finalPnl = state.finalPnlUsdc ?? 0;
      this.toast(`${state.status}: ${signedMoney(finalPnl)}`, finalPnl >= 0 ? 'ok' : 'error');
    }
  }

  private renderStats(state: CampaignState | null): void {
    const currentPrice = state?.currentPrice ?? 0;
    const averageEntry = state && state.assetQuantity > 0
      ? state.remainingCostBasisUsdc / state.assetQuantity
      : null;
    element('freeUsdc').textContent = money(state?.freeUsdc ?? 1_200);
    element('lockedUsdc').textContent = money(state?.lockedUsdc ?? 0);
    element('assetQuantity').textContent = quantity(state?.assetQuantity ?? 0);
    element('positionValue').textContent = money((state?.assetQuantity ?? 0) * currentPrice);
    element('averageEntry').textContent = price(averageEntry);
    this.pnlValue('realizedPnl', state?.realizedPnlUsdc ?? 0);
    this.pnlValue('unrealizedPnl', state?.unrealizedPnlUsdc ?? 0);
    this.pnlValue('totalPnl', state?.totalPnlUsdc ?? 0);
    element('maxDrawdown').textContent = state
      ? `${money(state.maxDrawdownUsdc)} · ${state.maxDrawdownPct.toFixed(2)}%`
      : '$0.00';
    element('lowestPrice').textContent = price(state?.lowestPrice ?? null);
    element('durationValue').textContent = state
      ? duration(Math.max(0, state.currentTime - state.config.startTime))
      : '0ч';
    element('poolProgress').innerHTML = state
      ? state.pools.map((pool) => {
        const fill = poolFillPct(pool);
        const sold = poolSoldPct(pool);
        return `<div class="pool-row"><div><b>P${pool.index}</b><span>${pool.status}</span><small>${fill.toFixed(0)}% buy · ${sold.toFixed(0)}% sold</small></div><div class="progress-track"><i style="width:${Math.min(100, fill)}%"></i><em style="width:${Math.min(100, sold)}%"></em></div></div>`;
      }).join('')
      : [1, 2, 3].map((index) => `<div class="pool-row"><div><b>P${index}</b><span>BID_OPEN</span><small>0% buy · 0% sold</small></div><div class="progress-track"><i style="width:0%"></i></div></div>`).join('');
  }

  private renderEvents(state: CampaignState | null): void {
    const events = state?.events ?? [];
    element('eventCount').textContent = String(events.length);
    element('eventLog').innerHTML = events.length === 0
      ? '<p class="empty">Кампания ещё не создала событий.</p>'
      : [...events].reverse().slice(0, 80).map((event) => `
        <div class="event-row ${event.type.toLowerCase()}">
          <time>${dateTime(event.time)}</time>
          <div><b>${event.label}</b><small>${price(event.price)}${event.usdcAmount ? ` · ${money(event.usdcAmount)}` : ''}</small></div>
        </div>
      `).join('');
  }

  private renderResults(): void {
    const results = this.campaignStore.listResults().slice(0, 8);
    element('campaignResults').innerHTML = results.length === 0
      ? '<p class="empty">Завершённых кампаний пока нет.</p>'
      : results.map((result) => `
        <div class="result-row"><div><b>${result.symbol.replace('USDT', '')} · ${result.status}</b><small>${dateTime(result.startedAt)} · ${duration(result.durationSeconds)}</small></div><strong class="${result.finalPnlUsdc >= 0 ? 'positive' : 'negative'}">${signedMoney(result.finalPnlUsdc)}</strong></div>
      `).join('');
  }

  private renderMeasurements(): void {
    const draft = this.measurementController.draft;
    element('measurementStep').textContent = draft.start ? (draft.bottom ? 'ГОТОВО' : '2 / 2') : '1 / 2';
    element('measurementDraft').innerHTML = !draft.start
      ? 'Выберите GALKA на графике.'
      : !draft.bottom
        ? `<b>GALKA ${price(draft.start.price)}</b><span>${dateTime(draft.start.time)}</span><small>Теперь выберите нижнюю точку.</small>`
        : `<b>${price(draft.start.price)} → ${price(draft.bottom.price)}</b><span>−${(((draft.start.price - draft.bottom.price) / draft.start.price) * 100).toFixed(2)}%</span><small>${duration(draft.bottom.time - draft.start.time)} до минимума</small>`;
    const stats = this.measurementController.statistics();
    element('measurementCount').textContent = String(stats.count);
    element('measurementStats').innerHTML = [
      ['Средняя', stats.mean],
      ['Медиана', stats.median],
      ['P80', stats.p80],
      ['P90', stats.p90],
      ['P95', stats.p95],
      ['Максимум', stats.maximum],
    ].map(([label, value]) => `<span><small>${label}</small><b>${Number(value).toFixed(2)}%</b></span>`).join('');
    const rows = this.measurementController.list();
    element('measurementList').innerHTML = rows.length === 0
      ? '<p class="empty">Сохранённых измерений нет.</p>'
      : rows.slice(0, 100).map((row) => `
        <div class="measurement-row"><div><b>${row.symbol.replace('USDT', '')} · −${row.depthPct.toFixed(2)}%</b><small>${duration(row.durationToBottomSeconds)} до дна · ${duration(row.durationToReturnSeconds)} до возврата</small></div><button data-remove-measurement="${row.id}" type="button" aria-label="Удалить">×</button></div>
      `).join('');
  }

  private renderCrosshair(point: ChartPoint | null): void {
    element('crosshairTime').textContent = point ? dateTime(point.time) : '—';
    element('crosshairPrice').textContent = point ? price(point.price) : '—';
  }

  private updateHistoryStatus(): void {
    const status = element('marketStatus');
    if (this.historyDirty) {
      status.textContent = 'Нужно обновить';
      status.className = 'market-status dirty';
      return;
    }
    const windowState = this.campaignController.window;
    status.textContent = windowState
      ? `${dateTime(windowState.startTime)} → ${dateTime(windowState.endTime)}`
      : 'История не загружена';
    status.className = `market-status ${windowState ? 'ready' : ''}`;
  }

  private pnlValue(id: string, value: number): void {
    const target = element(id);
    target.textContent = signedMoney(value);
    target.classList.toggle('positive', value > 0);
    target.classList.toggle('negative', value < 0);
  }

  private selectedStartTime(): number {
    const timestamp = new Date(this.startInput.value).getTime() / 1_000;
    if (!Number.isFinite(timestamp)) throw new Error('Выберите дату старта replay.');
    if (timestamp < HISTORY_MIN_TIME) throw new Error('Минимальная дата — 1 января 2023 года.');
    if (timestamp >= Date.now() / 1_000) throw new Error('Дата replay должна быть в прошлом.');
    return Math.floor(timestamp / 300) * 300;
  }

  private showLoading(text: string): void {
    element('loadingText').textContent = text;
    element('chartLoading').classList.remove('hidden');
  }

  private hideLoading(): void {
    element('chartLoading').classList.add('hidden');
  }

  private toast(message: string, type: 'ok' | 'error'): void {
    const target = element('toast');
    target.textContent = message;
    target.className = `toast ${type}`;
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => target.classList.add('hidden'), 4_500);
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
