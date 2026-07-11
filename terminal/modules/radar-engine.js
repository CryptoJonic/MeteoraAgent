const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function atrAt(rows, index, period = 14) {
  if (index < period || index >= rows.length) return null;
  let sum = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    const previousClose = rows[cursor - 1].close;
    const candle = rows[cursor];
    sum += Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  }
  return sum / period;
}

export function radarFeatureAt(rows, index) {
  const left = 4;
  const right = 4;
  if (index < left || index + right >= rows.length) return null;
  const candle = rows[index];
  const windowRows = rows.slice(index - left, index + right + 1);
  const minimum = Math.min(...windowRows.map((row) => row.low));
  if (candle.low > minimum + Math.max(1e-12, Math.abs(candle.low) * 1e-10)) return null;
  const atr = atrAt(rows, index, 14);
  if (!atr) return null;
  const leftRows = rows.slice(index - left, index);
  const rightRows = rows.slice(index + 1, index + right + 1);
  const leftHigh = Math.max(...leftRows.map((row) => row.high));
  const rightHigh = Math.max(...rightRows.map((row) => row.high));
  const leftDepth = leftHigh - candle.low;
  const rightDepth = rightHigh - candle.low;
  if (leftDepth <= 0 || rightDepth <= 0) return null;
  const neighbourLow = Math.min(rows[index - 1].low, rows[index + 1].low);
  return {
    time: candle.time,
    level: candle.low,
    index,
    atr,
    dropAtr: leftDepth / atr,
    recovery: rightDepth / leftDepth,
    balance: Math.min(leftDepth, rightDepth) / Math.max(leftDepth, rightDepth),
    sharpness: Math.max(0, (neighbourLow - candle.low) / atr),
    closeLift: Math.max(0, (candle.close - candle.low) / atr),
    leftHigh,
    rightHigh,
  };
}

export function scoreRadarPattern({
  rows,
  index,
  symbol,
  interval,
  minScore = 45,
  manualExamples = [],
  intervalSeconds = 900,
}) {
  const feature = radarFeatureAt(rows, index);
  if (!feature) return null;
  const score =
    20 * clamp((feature.dropAtr - 0.6) / 2.4, 0, 1) +
    30 * clamp((feature.recovery - 0.25) / 0.85, 0, 1) +
    20 * clamp(feature.balance, 0, 1) +
    20 * clamp(feature.sharpness / 0.9, 0, 1) +
    10 * clamp(feature.closeLift / 0.7, 0, 1);
  if (score < clamp(number(minScore, 45), 25, 90)) return null;
  const strength = score >= 75 ? 'strong' : score >= 60 ? 'medium' : 'weak';
  const manualMatch = manualExamples.some(
    (example) =>
      example.symbol === symbol &&
      example.interval === interval &&
      Math.abs(number(example.selectedCandleTime) - feature.time) <= intervalSeconds * 2,
  );
  return {
    ...feature,
    patternId: `R-${symbol}-${feature.time}`,
    score: Number(score.toFixed(1)),
    strength,
    manualMatch,
  };
}

export function scanRadarCandidates(options) {
  const rows = options.rows || [];
  const raw = [];
  const from = Math.max(14, options.fromIndex || 14);
  const to = Math.min(rows.length - 4, options.toIndex ?? rows.length - 4);
  for (let index = from; index < to; index += 1) {
    const candidate = scoreRadarPattern({ ...options, rows, index });
    if (candidate) raw.push(candidate);
  }
  const merged = [];
  for (const candidate of raw) {
    const previous = merged.at(-1);
    if (previous && candidate.index - previous.index <= 3) {
      if (candidate.score > previous.score) merged[merged.length - 1] = candidate;
    } else {
      merged.push(candidate);
    }
  }
  return merged;
}

export function filterRadarCandidates(candidates, filter = 'all') {
  if (filter === 'strong') return candidates.filter((item) => item.strength === 'strong');
  if (filter === 'medium') {
    return candidates.filter((item) => ['strong', 'medium'].includes(item.strength));
  }
  return candidates;
}

