import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';

import { poolFillPct } from '../core/pool-engine';
import { ONE_HOUR_SECONDS, type CampaignEvent, type CampaignState, type Candle } from '../core/types';
import type { MeasurementPoint } from './measurement-controller';

export interface ChartPoint {
  time: number;
  price: number;
}

export interface ChartControllerOptions {
  onPointSelected: (point: ChartPoint) => void;
  onCrosshair: (point: ChartPoint | null) => void;
  onLowerPriceChanged: (price: number) => void;
}

interface RangeOverlay {
  galkaPrice: number;
  lowerPrice: number;
  boundaries: [number, number, number, number];
}

const COLORS = {
  background: '#0b0f15',
  grid: '#1a222e',
  border: '#293241',
  text: '#8f99a8',
  green: '#16c784',
  red: '#ef5350',
  orange: '#ff9800',
  cyan: '#26c6da',
  violet: '#8b7cff',
};

function markerForEvent(event: CampaignEvent): SeriesMarker<Time> | null {
  if (event.type === 'BUY_BIN_FILLED' || event.type === 'LOWER_BOUND_REACHED') return null;
  const time = (Math.floor(event.time / ONE_HOUR_SECONDS) * ONE_HOUR_SECONDS) as UTCTimestamp;
  if (event.type === 'SELL') {
    return {
      time,
      position: 'aboveBar',
      color: COLORS.cyan,
      shape: 'arrowDown',
      text: 'SELL',
    };
  }
  if (event.type === 'POOL_FILLED') {
    return {
      time,
      position: 'belowBar',
      color: COLORS.orange,
      shape: 'circle',
      text: `P${event.poolIndex ?? ''} FILLED`,
    };
  }
  if (event.type === 'FLIPPED') {
    return {
      time,
      position: 'belowBar',
      color: COLORS.violet,
      shape: 'arrowUp',
      text: 'FLIPPED',
    };
  }
  return {
    time,
    position: 'aboveBar',
    color: event.type === 'COMPLETED' ? COLORS.green : COLORS.red,
    shape: 'square',
    text: event.type,
  };
}

export class ChartController {
  private readonly chartSurface: HTMLDivElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly lowerHandle: HTMLButtonElement;
  private readonly chart: IChartApi;
  private readonly series: ISeriesApi<'Candlestick'>;
  private readonly markerPlugin: ISeriesMarkersPluginApi<Time>;
  private readonly resizeObserver: ResizeObserver;
  private readonly priceLines: IPriceLine[] = [];
  private range: RangeOverlay | null = null;
  private campaign: CampaignState | null = null;
  private measurement: { start: MeasurementPoint; bottom: MeasurementPoint } | null = null;
  private rangeEditable = true;
  private draggingLower = false;
  private lastCrosshair: ChartPoint | null = null;
  private drawQueued = false;

  public constructor(
    private readonly host: HTMLElement,
    private readonly options: ChartControllerOptions,
  ) {
    this.chartSurface = document.createElement('div');
    this.chartSurface.className = 'chart-surface';
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'chart-overlay';
    this.lowerHandle = document.createElement('button');
    this.lowerHandle.className = 'range-handle hidden';
    this.lowerHandle.type = 'button';
    this.lowerHandle.setAttribute('aria-label', 'Изменить нижнюю границу');
    this.host.append(this.chartSurface, this.overlay, this.lowerHandle);

    this.chart = createChart(this.chartSurface, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.background },
        textColor: COLORS.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: COLORS.grid, visible: false },
        horzLines: { color: COLORS.grid, visible: true },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#69788c', labelBackgroundColor: '#303c4d' },
        horzLine: { color: '#69788c', labelBackgroundColor: '#303c4d' },
      },
      rightPriceScale: {
        borderColor: COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.1 },
      },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 7,
        minBarSpacing: 2,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });
    this.series = this.chart.addSeries(CandlestickSeries, {
      upColor: COLORS.green,
      downColor: COLORS.red,
      borderVisible: false,
      wickUpColor: COLORS.green,
      wickDownColor: COLORS.red,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    this.markerPlugin = createSeriesMarkers(this.series, []);

    this.chart.subscribeCrosshairMove((parameter) => this.handleCrosshair(parameter));
    this.chart.subscribeClick((parameter) => this.handleClick(parameter));
    this.chart.timeScale().subscribeVisibleTimeRangeChange(() => this.queueDraw());
    this.resizeObserver = new ResizeObserver(() => this.queueDraw());
    this.resizeObserver.observe(this.host);
    this.installHandleDrag();
  }

  public setCandles(candles: readonly Candle[], fit = false): void {
    this.series.setData(candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })));
    if (fit) this.chart.timeScale().fitContent();
    this.queueDraw();
  }

  public setRange(range: RangeOverlay | null): void {
    this.range = range;
    this.rebuildPriceLines();
    this.queueDraw();
  }

  public setCampaign(state: CampaignState | null): void {
    this.campaign = state ? structuredClone(state) : null;
    const events = state?.events
      .map(markerForEvent)
      .filter((marker): marker is SeriesMarker<Time> => marker !== null)
      .sort((left, right) => Number(left.time) - Number(right.time)) ?? [];
    this.markerPlugin.setMarkers(events);
    this.rebuildPriceLines();
    this.queueDraw();
  }

  public setMeasurement(start: MeasurementPoint | null, bottom: MeasurementPoint | null): void {
    this.measurement = start && bottom ? { start, bottom } : null;
    this.queueDraw();
  }

  public setRangeEditable(editable: boolean): void {
    this.rangeEditable = editable;
    this.lowerHandle.classList.toggle('locked', !editable);
  }

  public pinCrosshair(point: ChartPoint): void {
    this.chart.setCrosshairPosition(point.price, point.time as UTCTimestamp, this.series);
  }

  public fitContent(): void {
    this.chart.timeScale().fitContent();
    this.queueDraw();
  }

  public destroy(): void {
    this.resizeObserver.disconnect();
    this.chart.remove();
  }

  private handleCrosshair(parameter: MouseEventParams<Time>): void {
    if (!parameter.point || typeof parameter.time !== 'number') {
      this.lastCrosshair = null;
      this.options.onCrosshair(null);
      return;
    }
    const value = this.series.coordinateToPrice(parameter.point.y);
    if (value === null) return;
    this.lastCrosshair = { time: Number(parameter.time), price: Number(value) };
    this.options.onCrosshair(this.lastCrosshair);
  }

  private handleClick(parameter: MouseEventParams<Time>): void {
    if (this.draggingLower || !parameter.point || typeof parameter.time !== 'number') return;
    const value = this.series.coordinateToPrice(parameter.point.y);
    if (value === null) return;
    const point = { time: Number(parameter.time), price: Number(value) };
    this.lastCrosshair = point;
    this.pinCrosshair(point);
    this.options.onPointSelected(point);
  }

  private rebuildPriceLines(): void {
    for (const line of this.priceLines.splice(0)) this.series.removePriceLine(line);
    if (this.range) {
      this.priceLines.push(this.series.createPriceLine({
        price: this.range.galkaPrice,
        color: COLORS.orange,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'GALKA',
      }));
      this.priceLines.push(this.series.createPriceLine({
        price: this.range.lowerPrice,
        color: COLORS.red,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'LOW',
      }));
    }
    if (this.campaign && this.campaign.assetQuantity > 0) {
      const average = this.campaign.remainingCostBasisUsdc / this.campaign.assetQuantity;
      this.priceLines.push(this.series.createPriceLine({
        price: average,
        color: COLORS.cyan,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'AVG',
      }));
    }
  }

  private installHandleDrag(): void {
    this.lowerHandle.addEventListener('pointerdown', (event) => {
      if (!this.rangeEditable || !this.range) return;
      event.preventDefault();
      this.draggingLower = true;
      this.lowerHandle.setPointerCapture(event.pointerId);
    });
    this.lowerHandle.addEventListener('pointermove', (event) => {
      if (!this.draggingLower || !this.range) return;
      const rectangle = this.host.getBoundingClientRect();
      const coordinate = event.clientY - rectangle.top;
      const value = this.series.coordinateToPrice(coordinate);
      if (value === null) return;
      const maximum = this.range.galkaPrice * 0.9999;
      const minimum = this.range.galkaPrice * 0.05;
      this.options.onLowerPriceChanged(Math.min(maximum, Math.max(minimum, Number(value))));
    });
    const finish = (event: PointerEvent) => {
      if (!this.draggingLower) return;
      this.draggingLower = false;
      if (this.lowerHandle.hasPointerCapture(event.pointerId)) {
        this.lowerHandle.releasePointerCapture(event.pointerId);
      }
    };
    this.lowerHandle.addEventListener('pointerup', finish);
    this.lowerHandle.addEventListener('pointercancel', finish);
  }

  private queueDraw(): void {
    if (this.drawQueued) return;
    this.drawQueued = true;
    requestAnimationFrame(() => {
      this.drawQueued = false;
      this.drawOverlay();
    });
  }

  private drawOverlay(): void {
    const rectangle = this.host.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rectangle.width));
    const height = Math.max(1, Math.floor(rectangle.height));
    this.overlay.width = Math.floor(width * ratio);
    this.overlay.height = Math.floor(height * ratio);
    this.overlay.style.width = `${width}px`;
    this.overlay.style.height = `${height}px`;
    const context = this.overlay.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);

    if (this.range) {
      const colors = ['rgba(255,152,0,.10)', 'rgba(38,198,218,.08)', 'rgba(139,124,255,.09)'];
      for (let index = 0; index < 3; index += 1) {
        const upper = this.range.boundaries[index];
        const lower = this.range.boundaries[index + 1];
        if (upper === undefined || lower === undefined) continue;
        const upperY = this.series.priceToCoordinate(upper);
        const lowerY = this.series.priceToCoordinate(lower);
        if (upperY === null || lowerY === null) continue;
        context.fillStyle = colors[index] ?? colors[0] ?? 'rgba(255,255,255,.05)';
        context.fillRect(0, upperY, width, lowerY - upperY);
        context.fillStyle = 'rgba(240,244,250,.45)';
        context.font = '700 10px Inter, system-ui, sans-serif';
        context.fillText(`POOL ${index + 1}`, 10, upperY + 15);
      }
      const handleY = this.series.priceToCoordinate(this.range.lowerPrice);
      if (handleY !== null) {
        this.lowerHandle.classList.remove('hidden');
        this.lowerHandle.style.top = `${Math.max(0, Math.min(height - 28, handleY - 14))}px`;
        this.lowerHandle.textContent = this.range.lowerPrice.toLocaleString('en-US', { maximumFractionDigits: 4 });
      }
    } else {
      this.lowerHandle.classList.add('hidden');
    }

    if (this.campaign) this.drawCampaignBins(context, width);
    if (this.measurement) this.drawMeasurement(context);
  }

  private drawCampaignBins(context: CanvasRenderingContext2D, width: number): void {
    if (!this.campaign) return;
    const startX = Math.max(0, width * 0.58);
    for (const pool of this.campaign.pools) {
      for (const bin of pool.buyBins) {
        const y = this.series.priceToCoordinate(bin.price);
        if (y === null) continue;
        context.beginPath();
        context.moveTo(startX, y);
        context.lineTo(width - 60, y);
        context.strokeStyle = bin.status === 'FILLED'
          ? 'rgba(22,199,132,.52)'
          : bin.status === 'OPEN'
            ? 'rgba(255,255,255,.10)'
            : 'rgba(255,255,255,.035)';
        context.lineWidth = bin.status === 'FILLED' ? 1.2 : 0.6;
        context.stroke();
      }
      for (const bin of pool.sellBins) {
        if (bin.status !== 'OPEN') continue;
        const y = this.series.priceToCoordinate(bin.price);
        if (y === null) continue;
        context.beginPath();
        context.moveTo(width * 0.25, y);
        context.lineTo(width - 60, y);
        context.strokeStyle = 'rgba(38,198,218,.46)';
        context.lineWidth = 0.7 + bin.weight * 22;
        context.stroke();
      }
      const lowerY = this.series.priceToCoordinate(pool.lowerPrice);
      if (lowerY !== null) {
        context.fillStyle = 'rgba(255,255,255,.62)';
        context.font = '700 9px Inter, system-ui, sans-serif';
        context.fillText(`${poolFillPct(pool).toFixed(0)}%`, width - 52, lowerY - 3);
      }
    }
  }

  private drawMeasurement(context: CanvasRenderingContext2D): void {
    if (!this.measurement) return;
    const startX = this.chart.timeScale().timeToCoordinate(this.measurement.start.time as UTCTimestamp);
    const bottomX = this.chart.timeScale().timeToCoordinate(this.measurement.bottom.time as UTCTimestamp);
    const startY = this.series.priceToCoordinate(this.measurement.start.price);
    const bottomY = this.series.priceToCoordinate(this.measurement.bottom.price);
    if (startX === null || bottomX === null || startY === null || bottomY === null) return;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(bottomX, bottomY);
    context.strokeStyle = COLORS.violet;
    context.lineWidth = 2;
    context.setLineDash([6, 4]);
    context.stroke();
    context.setLineDash([]);
    const depth = ((this.measurement.start.price - this.measurement.bottom.price) / this.measurement.start.price) * 100;
    context.fillStyle = COLORS.violet;
    context.font = '800 11px Inter, system-ui, sans-serif';
    context.fillText(`−${depth.toFixed(2)}%`, bottomX + 7, bottomY - 7);
  }
}
