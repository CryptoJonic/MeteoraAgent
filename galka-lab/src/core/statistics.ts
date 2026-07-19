import type { ManualMeasurement, MeasurementStatistics } from './types';

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  if (percentileValue < 0 || percentileValue > 1) {
    throw new RangeError('Percentile must be between 0 and 1.');
  }

  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * percentileValue;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  if (lower === undefined || upper === undefined) return 0;
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

export function measurementStatistics(
  measurements: readonly ManualMeasurement[],
): MeasurementStatistics {
  const depths = measurements.map((measurement) => measurement.depthPct);
  return {
    count: depths.length,
    mean: mean(depths),
    median: percentile(depths, 0.5),
    p80: percentile(depths, 0.8),
    p90: percentile(depths, 0.9),
    p95: percentile(depths, 0.95),
    maximum: depths.length > 0 ? Math.max(...depths) : 0,
  };
}
