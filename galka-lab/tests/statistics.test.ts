import { describe, expect, it } from 'vitest';

import { measurementStatistics, percentile } from '../src/core/statistics';
import type { ManualMeasurement } from '../src/core/types';

function measurement(depthPct: number, index: number): ManualMeasurement {
  return {
    id: String(index),
    symbol: 'BTCUSDT',
    galkaPrice: 100,
    bottomPrice: 100 * (1 - depthPct / 100),
    depthPct,
    startTime: index * 10,
    bottomTime: index * 10 + 5,
    returnTime: index * 10 + 9,
    durationToBottomSeconds: 5,
    durationToReturnSeconds: 9,
    createdAt: index,
  };
}

describe('measurement statistics', () => {
  it('calculates mean, median, percentiles and maximum deterministically', () => {
    const rows = [1, 2, 3, 4, 5].map(measurement);
    const result = measurementStatistics(rows);
    expect(result).toEqual({
      count: 5,
      mean: 3,
      median: 3,
      p80: 4.2,
      p90: 4.6,
      p95: 4.8,
      maximum: 5,
    });
  });

  it('interpolates percentiles and handles an empty set', () => {
    expect(percentile([10, 20], 0.5)).toBe(15);
    expect(measurementStatistics([]).count).toBe(0);
    expect(measurementStatistics([]).maximum).toBe(0);
  });
});
