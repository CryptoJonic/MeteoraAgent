export interface InteractionPoint {
  time: number;
  price: number;
}

export interface LiveMeasurement {
  active: boolean;
  start: InteractionPoint | null;
  current: InteractionPoint | null;
}

export interface InteractionSnapshot {
  crosshair: InteractionPoint | null;
  galkaPrice: number | null;
  lowerPrice: number | null;
  measurement: LiveMeasurement;
}

const DEFAULT_RANGE_PCT = 0.15;

function clonePoint(point: InteractionPoint | null): InteractionPoint | null {
  return point ? { ...point } : null;
}

function assertPrice(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} должна быть положительным числом.`);
  }
}

/**
 * Pure interaction state shared by the UI and tests. Crosshair movement is
 * deliberately independent from campaign range mutation.
 */
export class InteractionState {
  private crosshairValue: InteractionPoint | null = null;
  private galkaValue: number | null = null;
  private lowerValue: number | null = null;
  private rememberedRangePct = DEFAULT_RANGE_PCT;
  private measurementValue: LiveMeasurement = {
    active: false,
    start: null,
    current: null,
  };

  public get snapshot(): InteractionSnapshot {
    return {
      crosshair: clonePoint(this.crosshairValue),
      galkaPrice: this.galkaValue,
      lowerPrice: this.lowerValue,
      measurement: {
        active: this.measurementValue.active,
        start: clonePoint(this.measurementValue.start),
        current: clonePoint(this.measurementValue.current),
      },
    };
  }

  public moveCrosshair(point: InteractionPoint | null): InteractionSnapshot {
    if (point) {
      this.crosshairValue = clonePoint(point);
      if (this.measurementValue.active) {
        this.measurementValue.current = clonePoint(point);
      }
    }
    return this.snapshot;
  }

  public fixGalkaFromCrosshair(): InteractionSnapshot {
    if (!this.crosshairValue) {
      throw new Error('Сначала установите crosshair на нужную цену.');
    }
    const nextGalka = this.crosshairValue.price;
    assertPrice(nextGalka, 'GALKA');
    this.galkaValue = nextGalka;
    this.lowerValue = nextGalka * (1 - this.rememberedRangePct);
    return this.snapshot;
  }

  public setGalkaPrice(value: number): InteractionSnapshot {
    assertPrice(value, 'GALKA');
    this.galkaValue = value;
    if (this.lowerValue === null || this.lowerValue >= value) {
      this.lowerValue = value * (1 - this.rememberedRangePct);
    } else {
      this.rememberedRangePct = (value - this.lowerValue) / value;
    }
    return this.snapshot;
  }

  public setLowerPrice(value: number): InteractionSnapshot {
    assertPrice(value, 'Нижняя цена');
    if (this.galkaValue === null) {
      throw new Error('Сначала установите GALKA.');
    }
    if (value >= this.galkaValue) {
      throw new RangeError('Нижняя цена должна быть ниже GALKA.');
    }
    this.lowerValue = value;
    this.rememberedRangePct = (this.galkaValue - value) / this.galkaValue;
    return this.snapshot;
  }

  public setRange(galkaPrice: number, lowerPrice: number): InteractionSnapshot {
    assertPrice(galkaPrice, 'GALKA');
    assertPrice(lowerPrice, 'Нижняя цена');
    if (lowerPrice >= galkaPrice) {
      throw new RangeError('Нижняя цена должна быть ниже GALKA.');
    }
    this.galkaValue = galkaPrice;
    this.lowerValue = lowerPrice;
    this.rememberedRangePct = (galkaPrice - lowerPrice) / galkaPrice;
    return this.snapshot;
  }

  public clearRange(): InteractionSnapshot {
    this.galkaValue = null;
    this.lowerValue = null;
    return this.snapshot;
  }

  public toggleMeasurement(): InteractionSnapshot {
    if (this.measurementValue.active) {
      this.measurementValue.active = false;
      return this.snapshot;
    }
    if (!this.crosshairValue) {
      throw new Error('Сначала установите crosshair в начальную точку.');
    }
    this.measurementValue = {
      active: true,
      start: clonePoint(this.crosshairValue),
      current: clonePoint(this.crosshairValue),
    };
    return this.snapshot;
  }

  public clearMeasurement(): InteractionSnapshot {
    this.measurementValue = { active: false, start: null, current: null };
    return this.snapshot;
  }
}
