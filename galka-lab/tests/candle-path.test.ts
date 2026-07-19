import { describe, expect, it } from 'vitest';

import { candlePath } from '../src/core/candle-path';
import type { Candle } from '../src/core/types';

function candle(open: number, high: number, low: number, close: number): Candle {
  return { time: 1_700_000_000, open, high, low, close, volume: 1 };
}

describe('deterministic five-minute candle path', () => {
  it('uses open → low → high → close for a green candle', () => {
    expect(candlePath(candle(100, 110, 90, 105))).toEqual([
      { kind: 'open', price: 100 },
      { kind: 'low', price: 90 },
      { kind: 'high', price: 110 },
      { kind: 'close', price: 105 },
    ]);
  });

  it('uses open → high → low → close for a red candle', () => {
    expect(candlePath(candle(100, 110, 90, 95))).toEqual([
      { kind: 'open', price: 100 },
      { kind: 'high', price: 110 },
      { kind: 'low', price: 90 },
      { kind: 'close', price: 95 },
    ]);
  });
});
