export const GALKA_STATS_SCHEMA = '1.2';
export const GALKA_STATS_MODEL = 'galka-lab-v0.3.0';
export const GALKA_STATS_ASSET = './data/galka-stats-v1.json.gz';
export const GALKA_STATS_ASSET_SHA256 = '828175607d3619c4af1eea24776ee3d2312e0641962fbc016179bc71f0b830f6';
export const GALKA_STATS_PAYLOAD_CHECKSUM = 'sha256:1379ea0d78dfb292e4cc1b909a29e25c9cec37e7d317a8d87ab7dc4af41d665d';
export const STAT_INTERVALS = ['5m', '15m', '30m', '1h'];

const finite = (value) => Number.isFinite(Number(value));
const number = (value, fallback = 0) => (finite(value) ? Number(value) : fallback);

export async function sha256Hex(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto недоступен: checksum Galka Lab нельзя проверить');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', source);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function browserGunzip(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Этот браузер не поддерживает gzip DecompressionStream');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function validateGalkaStatsPack(pack) {
  if (!pack || pack.schemaVersion !== GALKA_STATS_SCHEMA) throw new Error('Неподдерживаемая schema Galka Lab');
  if (pack.modelVersion !== GALKA_STATS_MODEL) throw new Error('Неподдерживаемая model version Galka Lab');
  if (pack.checksum !== GALKA_STATS_PAYLOAD_CHECKSUM) throw new Error('Checksum payload Galka Lab не совпал');
  if (pack.safety?.paperOnly !== true || pack.safety?.autoPaperDefault !== false || pack.safety?.realOrders !== false) {
    throw new Error('Нарушены safety flags Galka Lab');
  }
  if (pack.safety?.liveShadowRequiredBeforeAutoPaper !== true) throw new Error('Shadow gate отсутствует');
  if (!Array.isArray(pack.data?.symbols) || !['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].every((symbol) => pack.data.symbols.includes(symbol))) {
    throw new Error('Pack не содержит все обязательные рынки');
  }
  if (!Array.isArray(pack.data?.intervals) || !STAT_INTERVALS.every((interval) => pack.data.intervals.includes(interval))) {
    throw new Error('Pack не содержит все обязательные таймфреймы');
  }
  const typeCount = number(pack.model?.selected_k);
  if (typeCount < 4 || typeCount > 7) throw new Error('Некорректное число типов Galka Lab');
  if (!pack.profiles || !pack.statistics?.global || !pack.statistics?.blockBootstrap) throw new Error('Pack неполный');
  return pack;
}

export async function parseGalkaStatsBytes(
  compressed,
  { expectedSha256 = GALKA_STATS_ASSET_SHA256, gunzip = browserGunzip } = {},
) {
  const bytes = compressed instanceof Uint8Array ? compressed : new Uint8Array(compressed);
  const digest = await sha256Hex(bytes);
  if (digest !== expectedSha256) throw new Error(`Checksum файла Galka Lab не совпал: ${digest.slice(0, 12)}`);
  const decoded = await gunzip(bytes);
  const pack = JSON.parse(new TextDecoder().decode(decoded));
  return validateGalkaStatsPack(pack);
}

export async function loadGalkaStatsPack(
  url = GALKA_STATS_ASSET,
  { fetchImpl = globalThis.fetch, expectedSha256 = GALKA_STATS_ASSET_SHA256, gunzip } = {},
) {
  const response = await fetchImpl(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Galka Lab pack: HTTP ${response.status}`);
  return parseGalkaStatsBytes(new Uint8Array(await response.arrayBuffer()), {
    expectedSha256,
    gunzip: gunzip || browserGunzip,
  });
}

export function classifyGalka(pack, features = {}) {
  validateGalkaStatsPack(pack);
  const model = pack.model;
  const names = model.type_names || {};
  const means = model.scaler_mean || [];
  const scales = model.scaler_scale || [];
  const centers = model.centers_scaled || [];
  let provided = 0;
  const values = model.features.map((feature, index) => {
    if (finite(features[feature])) {
      provided += 1;
      return Number(features[feature]);
    }
    return number(model.feature_medians?.[feature], means[index]);
  });
  const scaled = values.map((value, index) => (value - number(means[index])) / Math.max(1e-12, number(scales[index], 1)));
  let clusterId = -1;
  let distance = Infinity;
  centers.forEach((center, index) => {
    const candidateDistance = Math.sqrt(center.reduce((sum, value, featureIndex) => {
      const delta = scaled[featureIndex] - number(value);
      return sum + delta * delta;
    }, 0));
    if (candidateDistance < distance) {
      clusterId = index;
      distance = candidateDistance;
    }
  });
  if (clusterId < 0) throw new Error('В pack отсутствуют центроиды');
  return {
    clusterId,
    type: names[String(clusterId)] || `Type ${clusterId + 1}`,
    distance,
    featureCoverage: provided / Math.max(1, model.features.length),
    providedFeatures: provided,
    totalFeatures: model.features.length,
    modelHash: model.model_hash,
  };
}

function intervalMinutes(interval) {
  return { '5m': 5, '15m': 15, '30m': 30, '1h': 60 }[interval] || null;
}

function atrAt(rows, index, period = 14) {
  if (index < period || index >= rows.length) return null;
  let total = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    const previous = rows[cursor - 1]?.close;
    const candle = rows[cursor];
    if (!finite(previous) || !candle) return null;
    total += Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previous),
      Math.abs(candle.low - previous),
    );
  }
  return total / period;
}

function emaSeries(rows, endIndex, span = 20) {
  const alpha = 2 / (span + 1);
  const output = new Array(endIndex + 1).fill(null);
  let value = null;
  for (let index = 0; index <= endIndex; index += 1) {
    const close = number(rows[index]?.close, NaN);
    if (!Number.isFinite(close)) continue;
    value = value == null ? close : alpha * close + (1 - alpha) * value;
    if (index >= span - 1) output[index] = value;
  }
  return output;
}

function median(values) {
  const sorted = values.filter(finite).map(Number).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function researchFeaturesAt(rows, pivotIndex, interval, { marketReturn1h = null } = {}) {
  const minutes = intervalMinutes(interval);
  const left = 6;
  const right = 6;
  if (!minutes || pivotIndex < 50 || pivotIndex + right >= rows.length) return null;
  const pivot = rows[pivotIndex];
  const atr = atrAt(rows, pivotIndex);
  if (!pivot || !(atr > 0)) return null;
  const window = rows.slice(pivotIndex - left, pivotIndex + right + 1);
  if (pivot.low > Math.min(...window.map((row) => row.low)) + Math.max(1e-12, Math.abs(pivot.low) * 1e-10)) return null;
  const leftRows = rows.slice(pivotIndex - left, pivotIndex);
  const rightRows = rows.slice(pivotIndex + 1, pivotIndex + right + 1);
  const leftHigh = Math.max(...leftRows.map((row) => row.high));
  const rightHigh = Math.max(...rightRows.map((row) => row.high));
  const drop = leftHigh - pivot.low;
  const recovery = (rightHigh - pivot.low) / Math.max(drop, 1e-12);
  if (drop < 0.8 * atr || recovery < 0.25) return null;
  const leftHighOffset = leftRows.findIndex((row) => row.high === leftHigh);
  const rightHighOffset = rightRows.findIndex((row) => row.high === rightHigh);
  const leftBars = left - leftHighOffset;
  const rightBars = rightHighOffset + 1;
  const nearBand = pivot.low + 0.25 * atr;
  const nearCount = window.filter((row) => row.low <= nearBand).length;
  const candleRange = Math.max(pivot.high - pivot.low, 1e-12);
  const lowerWick = Math.max(0, Math.min(pivot.open, pivot.close) - pivot.low);
  const secondTests = rightRows.filter((row) => row.low <= pivot.low + 0.15 * atr).length;
  const contextStart = Math.max(0, pivotIndex - 288);
  const priorTouches = rows.slice(contextStart, pivotIndex).filter((row) => Math.abs(row.low - pivot.low) <= 0.15 * atr).length;
  const confirmation = pivotIndex + right;
  const expectedSeconds = minutes * 60;
  for (let index = Math.max(1, pivotIndex - 288); index <= confirmation; index += 1) {
    if (number(rows[index]?.time, NaN) - number(rows[index - 1]?.time, NaN) !== expectedSeconds) return null;
  }
  const confirmationAtr = atrAt(rows, confirmation) || atr;
  const volumeMedian = median(rows.slice(Math.max(0, confirmation - 20), confirmation).map((row) => row.volume));
  const oneHourBars = Math.max(1, Math.round(60 / minutes));
  const slopeBars = Math.max(1, Math.round(180 / minutes));
  const ema = emaSeries(rows, confirmation, 20);
  const priorReturn1h = confirmation >= oneHourBars
    ? rows[confirmation].close / rows[confirmation - oneHourBars].close - 1
    : null;
  const trendSlope = ema[confirmation] != null && ema[confirmation - slopeBars] != null
    ? (ema[confirmation] - ema[confirmation - slopeBars]) / confirmationAtr / slopeBars
    : null;
  return {
    drop_atr: drop / atr,
    recovery_ratio: recovery,
    shoulder_balance: Math.min(leftBars, rightBars) / Math.max(leftBars, rightBars),
    fall_speed_atr: drop / atr / Math.max(leftBars, 1),
    recovery_speed_atr: (rightHigh - pivot.low) / atr / Math.max(rightBars, 1),
    sharpness_atr: Math.max(0, Math.min(rows[pivotIndex - 1].low, rows[pivotIndex + 1].low) - pivot.low) / atr,
    base_width_bars: nearCount,
    near_low_bars: nearCount,
    wick_ratio: lowerWick / candleRange,
    close_lift_atr: Math.max(0, pivot.close - pivot.low) / atr,
    second_tests: secondTests,
    prior_touches: priorTouches,
    atr_pct: confirmationAtr / rows[confirmation].close * 100,
    volume_ratio: volumeMedian > 0 ? rows[confirmation].volume / volumeMedian : 1,
    trend_slope_atr: trendSlope,
    local_vs_market_1h: finite(priorReturn1h) && finite(marketReturn1h) ? priorReturn1h - marketReturn1h : null,
  };
}

export function typeSummary(pack, { symbol, interval, type, window = 'all', split = 'all' }) {
  if (split === 'final_oos' && window === 'all') {
    return finalOosSummary(pack, { symbol, interval, type });
  }
  return pack.statistics.global.find((row) =>
    row.symbol === symbol && row.interval === interval && row.galka_type === type && row.window === window && row.split === split
  ) || null;
}

export function finalOosSummary(pack, { symbol, interval, type }) {
  return pack.statistics.finalOos.find((row) =>
    row.symbol === symbol && row.interval === interval && row.galka_type === type
  ) || null;
}

export function aggregateFinalOos(pack, type) {
  const rows = pack.statistics.finalOos.filter((row) => row.galka_type === type);
  if (!rows.length) return null;
  const total = (field) => rows.reduce((sum, row) => sum + number(row[field]), 0);
  const weighted = (field, weightField = 'strategy_evaluable_count') => {
    const denominator = total(weightField);
    return denominator
      ? rows.reduce((sum, row) => sum + number(row[field]) * number(row[weightField]), 0) / denominator
      : null;
  };
  return {
    galka_type: type,
    split: 'final_oos',
    symbol: 'ALL',
    interval: 'ALL',
    count_candidates: total('count_candidates'),
    count_activated: total('count_activated'),
    count_complete: total('count_complete'),
    count_returned: total('count_returned'),
    strategy_evaluable_count: total('strategy_evaluable_count'),
    conservative_net_return_pct_mean: weighted('conservative_net_return_pct_mean'),
    balanced_net_return_pct_mean: weighted('balanced_net_return_pct_mean'),
    aggressive_net_return_pct_mean: weighted('aggressive_net_return_pct_mean'),
    mae_mean_pct: weighted('mae_mean_pct', 'count_complete'),
    mfe_after_reclaim_mean_pct: weighted('mfe_after_reclaim_mean_pct', 'count_complete'),
    return_minutes_p50: weighted('return_minutes_p50', 'count_returned'),
    return_minutes_p75: weighted('return_minutes_p75', 'count_returned'),
    return_minutes_p90: weighted('return_minutes_p90', 'count_returned'),
  };
}

export function recentSummary(pack, { type, window }) {
  return pack.statistics.recent.find((row) =>
    row.galka_type === type && row.window === window
  ) || null;
}

export function blockSummary(pack, { symbol = 'ALL', type, split = 'final_oos' }) {
  const scope = symbol === 'ALL' ? 'cross_symbol' : 'symbol';
  return pack.statistics.blockBootstrap.find((row) =>
    row.scope === scope && row.symbol === symbol && row.galka_type === type && row.split === split
  ) || null;
}

export function conditionalSummary(pack, { symbol, interval, type, window = 'all' }) {
  return pack.statistics.conditional.find((row) =>
    row.symbol === symbol && row.interval === interval && row.type === type && row.window === window
  ) || null;
}

export function probabilityCliff(pack, { symbol, interval, type, window = 'all' }) {
  return pack.statistics.cliffs
    .filter((row) => row.symbol === symbol && row.interval === interval && row.galka_type === type && row.window === window)
    .sort((a, b) => number(b.probability_drop) - number(a.probability_drop))[0] || null;
}

export function gridComparison(pack, { type, split = 'all' }) {
  return pack.gridComparison.filter((row) => row.galka_type === type && row.split === split);
}

export function stopComparison(pack, { type, split = 'all' }) {
  return pack.stopComparison.filter((row) => row.galka_type === type && row.split === split);
}

export function exitComparison(pack, { type, split = 'all' }) {
  return pack.exitComparison.filter((row) => row.galka_type === type && row.split === split);
}

export function galkaInsight(pack, options) {
  const profileName = options.profile || 'Balanced';
  return {
    type: options.type,
    summary: typeSummary(pack, options),
    finalOos: finalOosSummary(pack, options),
    finalOosAggregate: aggregateFinalOos(pack, options.type),
    block: blockSummary(pack, { symbol: options.blockSymbol || 'ALL', type: options.type }),
    conditional: conditionalSummary(pack, options),
    cliff: probabilityCliff(pack, options),
    profile: pack.profiles?.[options.type]?.[profileName] || null,
    grids: gridComparison(pack, { type: options.type }),
    stops: stopComparison(pack, { type: options.type }),
    exits: exitComparison(pack, { type: options.type }),
    recent: recentSummary(pack, { type: options.type, window: options.window }),
  };
}
