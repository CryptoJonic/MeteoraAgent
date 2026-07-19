import type { Candle, ManualMeasurement, MarketSymbol } from '../core/types';
import { measurementStatistics } from '../core/statistics';
import { MeasurementStore } from '../storage/measurement-store';

export interface MeasurementPoint {
  time: number;
  price: number;
}

export interface MeasurementDraft {
  start: MeasurementPoint | null;
  bottom: MeasurementPoint | null;
}

function makeId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `measurement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class MeasurementController {
  private draftValue: MeasurementDraft = { start: null, bottom: null };

  public constructor(private readonly store: MeasurementStore) {}

  public get draft(): Readonly<MeasurementDraft> {
    return this.draftValue;
  }

  public list(): ManualMeasurement[] {
    return this.store.list();
  }

  public statistics() {
    return measurementStatistics(this.list());
  }

  public resetDraft(): void {
    this.draftValue = { start: null, bottom: null };
  }

  public selectPoint(point: MeasurementPoint): MeasurementDraft {
    const start = this.draftValue.start;
    if (!start || (start && this.draftValue.bottom)) {
      this.draftValue = { start: point, bottom: null };
      return this.draftValue;
    }
    if (point.time <= start.time) throw new Error('Нижняя точка должна быть позже GALKA.');
    if (point.price >= start.price) throw new Error('Нижняя точка должна быть ниже GALKA.');
    this.draftValue = { start, bottom: point };
    return this.draftValue;
  }

  public save(symbol: MarketSymbol, visibleCandles: readonly Candle[]): ManualMeasurement {
    const { start, bottom } = this.draftValue;
    if (!start || !bottom) throw new Error('Укажите GALKA и нижнюю точку двумя нажатиями на график.');
    const returnCandle = visibleCandles.find(
      (candle) => candle.time > bottom.time && candle.high >= start.price,
    );
    const returnTime = returnCandle?.time ?? null;
    const measurement: ManualMeasurement = {
      id: makeId(),
      symbol,
      galkaPrice: start.price,
      bottomPrice: bottom.price,
      depthPct: ((start.price - bottom.price) / start.price) * 100,
      startTime: start.time,
      bottomTime: bottom.time,
      returnTime,
      durationToBottomSeconds: bottom.time - start.time,
      durationToReturnSeconds: returnTime === null ? null : returnTime - start.time,
      createdAt: Date.now(),
    };
    this.store.save(measurement);
    this.resetDraft();
    return measurement;
  }

  public remove(id: string): void {
    this.store.remove(id);
  }
}
