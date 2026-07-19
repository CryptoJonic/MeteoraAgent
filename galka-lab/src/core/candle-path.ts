import type { Candle, PricePathPoint } from './types';

export function candlePath(candle: Candle): PricePathPoint[] {
  if (candle.close >= candle.open) {
    return [
      { kind: 'open', price: candle.open },
      { kind: 'low', price: candle.low },
      { kind: 'high', price: candle.high },
      { kind: 'close', price: candle.close },
    ];
  }

  return [
    { kind: 'open', price: candle.open },
    { kind: 'high', price: candle.high },
    { kind: 'low', price: candle.low },
    { kind: 'close', price: candle.close },
  ];
}

export function crossesDown(fromPrice: number, toPrice: number, level: number): boolean {
  return toPrice < fromPrice && level <= fromPrice && level >= toPrice;
}

export function crossesUp(fromPrice: number, toPrice: number, level: number): boolean {
  return toPrice > fromPrice && level >= fromPrice && level <= toPrice;
}

export function touchesLevel(fromPrice: number, toPrice: number, level: number): boolean {
  const lower = Math.min(fromPrice, toPrice);
  const upper = Math.max(fromPrice, toPrice);
  return level >= lower && level <= upper;
}
