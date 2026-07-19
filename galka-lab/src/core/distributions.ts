export function rawSellWeight(index: number, count: number): number {
  if (!Number.isInteger(count) || count < 2) {
    throw new RangeError('Sell distribution requires at least two bins.');
  }
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError('Sell bin index is out of range.');
  }
  return 1 + (3 * index) / (count - 1);
}

export function normalizedSellWeights(count: number): number[] {
  const raw = Array.from({ length: count }, (_, index) => rawSellWeight(index, count));
  const sum = raw.reduce((total, weight) => total + weight, 0);
  return raw.map((weight) => weight / sum);
}
