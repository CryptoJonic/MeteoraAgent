export const SHADOW_SCHEMA_VERSION = 1;
export const SHADOW_DEFAULT_PROFILE = 'Balanced';
export const SHADOW_MAX_RECORDS = 500;
export const SHADOW_MAX_HOURS = 48;

const finite = (value) => Number.isFinite(Number(value));
const number = (value, fallback = 0) => (finite(value) ? Number(value) : fallback);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function iso(value = Date.now()) {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number(value);
  return new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString();
}

function timeMs(value) {
  if (typeof value === 'string') return Date.parse(value);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
  return parsed < 10_000_000_000 ? parsed * 1_000 : parsed;
}

export function createShadowState() {
  return {
    version: SHADOW_SCHEMA_VERSION,
    enabled: false,
    profile: SHADOW_DEFAULT_PROFILE,
    startedAt: null,
    modelVersion: null,
    modelHash: null,
    records: [],
  };
}

export function normalizeShadowState(raw) {
  const source = raw && typeof raw === 'object' ? clone(raw) : {};
  const state = { ...createShadowState(), ...source };
  state.enabled = source.enabled === true;
  state.profile = ['Conservative', 'Balanced', 'Aggressive'].includes(source.profile)
    ? source.profile
    : SHADOW_DEFAULT_PROFILE;
  state.startedAt = source.startedAt && Number.isFinite(Date.parse(source.startedAt))
    ? source.startedAt
    : null;
  state.records = Array.isArray(source.records)
    ? source.records.filter((record) => record && typeof record === 'object').slice(-SHADOW_MAX_RECORDS)
    : [];
  state.version = SHADOW_SCHEMA_VERSION;
  return state;
}

export function setShadowEnabled(state, enabled, nowMs = Date.now(), model = {}) {
  if (!state || typeof state !== 'object') throw new Error('Shadow state отсутствует');
  const next = enabled === true;
  if (next && !state.enabled) state.startedAt = iso(nowMs);
  state.enabled = next;
  state.version = SHADOW_SCHEMA_VERSION;
  if (model.modelVersion) state.modelVersion = model.modelVersion;
  if (model.modelHash) state.modelHash = model.modelHash;
  return state;
}

function validProfile(profile) {
  return profile?.paper_only === true
    && Array.isArray(profile.depths_pct)
    && Array.isArray(profile.weights)
    && profile.depths_pct.length > 0
    && profile.depths_pct.length === profile.weights.length
    && profile.depths_pct.every((value) => number(value) > 0)
    && profile.weights.every((value) => number(value) >= 0)
    && profile.weights.reduce((sum, value) => sum + number(value), 0) > 0;
}

export function registerShadowCandidate(
  state,
  candidate,
  profile,
  { nowMs = Date.now(), modelVersion = null, modelHash = null } = {},
) {
  if (!state?.enabled) return { registered: false, reason: 'disabled', record: null };
  if (!validProfile(profile)) return { registered: false, reason: 'unsafe_profile', record: null };
  const candidateId = String(candidate?.candidateId || candidate?.patternId || '');
  const symbol = String(candidate?.symbol || '');
  const interval = String(candidate?.interval || '');
  const type = String(candidate?.type || '');
  const level = number(candidate?.level, NaN);
  const confirmationMs = timeMs(candidate?.confirmationAt ?? candidate?.confirmationTime);
  const startedMs = Date.parse(state.startedAt || '');
  if (!candidateId || !symbol || !interval || !type || !(level > 0) || !Number.isFinite(confirmationMs)) {
    return { registered: false, reason: 'invalid_candidate', record: null };
  }
  if (!Number.isFinite(startedMs) || confirmationMs < startedMs) {
    return { registered: false, reason: 'before_shadow_start', record: null };
  }
  const duplicate = state.records.find((record) => record.candidateId === candidateId);
  if (duplicate) return { registered: false, reason: 'duplicate', record: duplicate };

  const weightTotal = profile.weights.reduce((sum, value) => sum + number(value), 0);
  const record = {
    id: `S-${candidateId}`,
    candidateId,
    symbol,
    interval,
    type,
    level,
    score: finite(candidate.score) ? Number(candidate.score) : null,
    radarDecision: 'captured',
    manualMatch: candidate.manualMatch === true,
    manualLabel: candidate.manualLabel || null,
    manualLabeledAt: candidate.manualLabeledAt || null,
    profile: candidate.profile || state.profile || SHADOW_DEFAULT_PROFILE,
    stressTestOnly: profile.stress_test_only === true,
    modelVersion: modelVersion || state.modelVersion || null,
    modelHash: modelHash || state.modelHash || null,
    confirmationAt: iso(confirmationMs),
    registeredAt: iso(nowMs),
    expiresAt: iso(confirmationMs + SHADOW_MAX_HOURS * 3_600_000),
    status: 'waiting',
    levels: profile.depths_pct.map((depth, index) => ({
      index: index + 1,
      depthPct: number(depth),
      weight: number(profile.weights[index]) / weightTotal,
      price: level * (1 - number(depth) / 100),
      status: 'pending',
      fillPrice: null,
      fillTime: null,
      qty: 0,
      fee: 0,
    })),
    filledNotional: 0,
    qty: 0,
    averageEntry: null,
    entryFees: 0,
    minPrice: level,
    maxPrice: level,
    maxDepthPct: 0,
    maePct: 0,
    mfePct: 0,
    returnedAt: null,
    returnMinutes: null,
    trailArmed: false,
    reclaimAt: null,
    trailHigh: null,
    trailStop: null,
    exitAt: null,
    exitPrice: null,
    exitReason: null,
    netReturnPct: null,
    paperBalanceImpact: 0,
  };
  state.records.push(record);
  if (state.records.length > SHADOW_MAX_RECORDS) state.records.splice(0, state.records.length - SHADOW_MAX_RECORDS);
  return { registered: true, reason: 'registered', record };
}

function recalculate(record) {
  const filled = record.levels.filter((level) => level.status === 'filled');
  record.qty = filled.reduce((sum, level) => sum + number(level.qty), 0);
  record.filledNotional = filled.reduce(
    (sum, level) => sum + number(level.fillPrice) * number(level.qty),
    0,
  );
  record.averageEntry = record.qty ? record.filledNotional / record.qty : null;
  record.entryFees = filled.reduce((sum, level) => sum + number(level.fee), 0);
}

function closeRecord(record, exitPrice, reason, nowMs, settings) {
  const slip = Math.max(0, number(settings.slippage, 0.0002));
  const takerFee = Math.max(0, number(settings.takerFee, 0.0005));
  const executablePrice = exitPrice * (1 - slip);
  const exitNotional = record.qty * executablePrice;
  const gross = exitNotional - record.filledNotional;
  const fees = record.entryFees + exitNotional * takerFee;
  record.status = 'closed';
  record.exitAt = iso(nowMs);
  record.exitPrice = executablePrice;
  record.exitReason = reason;
  record.netReturnPct = (gross - fees) * 100;
}

export function processShadowQuote(
  record,
  quote,
  settings = {},
  nowMs = Date.now(),
) {
  const result = { changed: false, events: [], closed: false };
  if (!record || !['waiting', 'open', 'trailing'].includes(record.status)) return result;
  const bid = number(quote?.bid, NaN);
  const ask = number(quote?.ask, NaN);
  if (!(bid > 0) || !(ask > 0)) return result;
  const at = iso(nowMs);
  const makerFee = Math.max(0, number(settings.makerFee, 0.0002));

  const previousMin = number(record.minPrice, record.level);
  const previousMax = number(record.maxPrice, record.level);
  const previousDepth = number(record.maxDepthPct);
  record.minPrice = Math.min(previousMin, bid, ask);
  record.maxPrice = Math.max(previousMax, bid, ask);
  record.maxDepthPct = Math.max(previousDepth, (record.level - record.minPrice) / record.level * 100);
  if (record.minPrice !== previousMin || record.maxPrice !== previousMax || record.maxDepthPct !== previousDepth) {
    result.changed = true;
  }

  if (nowMs >= Date.parse(record.expiresAt)) {
    recalculate(record);
    if (record.qty) {
      record.maePct = Math.max(number(record.maePct), (record.averageEntry - record.minPrice) / record.averageEntry * 100);
      record.mfePct = Math.max(number(record.mfePct), (record.maxPrice - record.averageEntry) / record.averageEntry * 100);
      closeRecord(record, bid, 'time_exit_48h', nowMs, settings);
    } else {
      record.status = 'expired';
      record.exitAt = at;
      record.exitReason = 'no_fill_48h';
      record.netReturnPct = 0;
    }
    result.changed = true;
    result.closed = true;
    result.events.push({ type: 'shadow_closed', reason: record.exitReason });
    return result;
  }

  if (!record.trailArmed) {
    for (const level of record.levels) {
      if (level.status !== 'pending' || ask > level.price) continue;
      level.status = 'filled';
      level.fillPrice = level.price;
      level.fillTime = at;
      level.qty = level.weight / level.fillPrice;
      level.fee = level.weight * makerFee;
      record.status = 'open';
      result.changed = true;
      result.events.push({ type: 'shadow_fill', level: level.index, price: level.price });
    }
  }

  recalculate(record);
  if (record.qty) {
    const previousMae = number(record.maePct);
    const previousMfe = number(record.mfePct);
    record.maePct = Math.max(
      previousMae,
      (record.averageEntry - record.minPrice) / record.averageEntry * 100,
    );
    record.mfePct = Math.max(
      previousMfe,
      (record.maxPrice - record.averageEntry) / record.averageEntry * 100,
    );
    if (record.maePct !== previousMae || record.mfePct !== previousMfe) result.changed = true;
    if (!record.returnedAt && bid >= record.level) {
      record.returnedAt = at;
      record.returnMinutes = (nowMs - Date.parse(record.confirmationAt)) / 60_000;
      result.changed = true;
      result.events.push({ type: 'shadow_return', minutes: record.returnMinutes });
    }
    const reclaimPrice = record.level * (1 + number(settings.reclaimBufferPct, 0.1) / 100);
    if (!record.trailArmed && bid >= reclaimPrice) {
      record.trailArmed = true;
      record.reclaimAt = at;
      record.status = 'trailing';
      record.trailHigh = bid;
      record.trailStop = record.level;
      result.changed = true;
      result.events.push({ type: 'shadow_trail_armed', stop: record.trailStop });
    }
    if (record.trailArmed) {
      record.trailHigh = Math.max(number(record.trailHigh, bid), bid);
      const distance = Math.max(0.05, Math.min(10, number(settings.trailDistancePct, 0.75))) / 100;
      const nextStop = Math.max(record.level, record.trailHigh * (1 - distance));
      if (nextStop > number(record.trailStop, record.level)) {
        record.trailStop = nextStop;
        result.changed = true;
        result.events.push({ type: 'shadow_trail_raised', stop: nextStop });
      }
      if (bid <= record.trailStop) {
        closeRecord(record, record.trailStop, 'reclaim_trailing_stop', nowMs, settings);
        result.changed = true;
        result.closed = true;
        result.events.push({ type: 'shadow_closed', reason: record.exitReason });
      }
    }
  }

  return result;
}

export function processShadowBook(state, symbol, quote, settings = {}, nowMs = Date.now()) {
  const result = { changed: false, events: [], closed: 0 };
  if (!state?.enabled) return result;
  for (const record of state.records) {
    if (record.symbol !== symbol) continue;
    const step = processShadowQuote(record, quote, settings, nowMs);
    result.changed = result.changed || step.changed;
    result.closed += step.closed ? 1 : 0;
    result.events.push(...step.events.map((event) => ({ ...event, recordId: record.id, symbol })));
  }
  return result;
}

export function labelShadowCandidate(state, candidateId, label, nowMs = Date.now()) {
  const record = state?.records?.find((item) => item.candidateId === candidateId);
  if (!record) return false;
  record.manualLabel = label || null;
  record.manualLabeledAt = label ? iso(nowMs) : null;
  return true;
}

export function summarizeShadow(state, { type = null } = {}) {
  const records = (state?.records || []).filter((record) => !type || record.type === type);
  const completed = records.filter((record) => ['closed', 'expired'].includes(record.status));
  const returned = records.filter((record) => record.returnedAt);
  const filled = records.filter((record) => number(record.filledNotional) > 0);
  const net = completed.map((record) => number(record.netReturnPct));
  const compared = records.filter((record) => record.manualLabel);
  return {
    total: records.length,
    active: records.filter((record) => ['waiting', 'open', 'trailing'].includes(record.status)).length,
    completed: completed.length,
    filled: filled.length,
    returned: returned.length,
    manualCompared: compared.length,
    manualPositive: compared.filter((record) => record.manualLabel === 'positive').length,
    fillRate: records.length ? filled.length / records.length : null,
    returnRate: records.length ? returned.length / records.length : null,
    meanNetReturnPct: net.length ? net.reduce((sum, value) => sum + value, 0) / net.length : null,
    paperBalanceImpact: 0,
  };
}
