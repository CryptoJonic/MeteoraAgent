import assert from 'node:assert/strict';

import {
  SHADOW_DEFAULT_PROFILE,
  createShadowState,
  normalizeShadowState,
  labelShadowCandidate,
  processShadowBook,
  processShadowQuote,
  registerShadowCandidate,
  setShadowEnabled,
  summarizeShadow,
} from '../terminal/modules/shadow-engine.js';

const profile = {
  depths_pct: [0.15, 0.3],
  weights: [0.6, 0.4],
  paper_only: true,
  stress_test_only: false,
};
const settings = {
  makerFee: 0.0002,
  takerFee: 0.0005,
  slippage: 0.0002,
  reclaimBufferPct: 0.1,
  trailDistancePct: 0.75,
};
const paper = {
  realizedPnl: 42.5,
  symbols: {
    BTCUSDT: { campaign: { campaignId: 'paper-must-not-change', levels: [{ status: 'filled' }] } },
  },
};
const paperBefore = JSON.stringify(paper);

const state = createShadowState();
assert.equal(state.enabled, false);
assert.equal(state.profile, SHADOW_DEFAULT_PROFILE);
assert.deepEqual(state.records, []);
assert.equal(
  registerShadowCandidate(state, {}, profile).reason,
  'disabled',
  'shadow must never capture candidates before explicit opt-in',
);

const startedAt = Date.UTC(2026, 6, 12, 12, 0, 0);
setShadowEnabled(state, true, startedAt, {
  modelVersion: 'galka-lab-v0.3.0',
  modelHash: 'model-test',
});
assert.equal(state.startedAt, new Date(startedAt).toISOString());

const historical = registerShadowCandidate(
  state,
  {
    candidateId: 'historical',
    symbol: 'BTCUSDT',
    interval: '15m',
    type: 'Fast V',
    level: 100,
    confirmationAt: startedAt - 1,
  },
  profile,
);
assert.equal(historical.reason, 'before_shadow_start');

const registered = registerShadowCandidate(
  state,
  {
    candidateId: 'R-BTCUSDT-live',
    symbol: 'BTCUSDT',
    interval: '15m',
    type: 'Fast V',
    level: 100,
    score: 81,
    profile: 'Balanced',
    confirmationAt: startedAt,
  },
  profile,
  { nowMs: startedAt + 10 },
);
assert.equal(registered.registered, true);
assert.equal(registered.record.paperBalanceImpact, 0);
assert.equal(registered.record.status, 'waiting');
assert.ok(Math.abs(registered.record.levels.reduce((sum, level) => sum + level.weight, 0) - 1) < 1e-12);
assert.equal(
  registerShadowCandidate(
    state,
    {
      candidateId: 'R-BTCUSDT-live',
      symbol: 'BTCUSDT',
      interval: '15m',
      type: 'Fast V',
      level: 100,
      confirmationAt: startedAt,
    },
    profile,
  ).reason,
  'duplicate',
);

const record = registered.record;
const fill = processShadowBook(
  state,
  'BTCUSDT',
  { bid: 99.69, ask: 99.69 },
  settings,
  startedAt + 60_000,
);
assert.equal(fill.events.filter((event) => event.type === 'shadow_fill').length, 2);
assert.equal(record.status, 'open');
assert.equal(record.levels.every((level) => level.status === 'filled'), true);
assert.ok(record.averageEntry < 100);

const repeated = processShadowQuote(record, { bid: 99.69, ask: 99.69 }, settings, startedAt + 61_000);
assert.equal(repeated.events.filter((event) => event.type === 'shadow_fill').length, 0);

const reclaim = processShadowQuote(record, { bid: 101.5, ask: 101.51 }, settings, startedAt + 120_000);
assert.equal(record.trailArmed, true);
assert.equal(record.reclaimAt, new Date(startedAt + 120_000).toISOString());
assert.ok(reclaim.events.some((event) => event.type === 'shadow_return'));
assert.ok(reclaim.events.some((event) => event.type === 'shadow_trail_armed'));
assert.ok(record.trailStop > record.level);

const stop = record.trailStop;
const closed = processShadowQuote(
  record,
  { bid: stop - 0.01, ask: stop },
  settings,
  startedAt + 180_000,
);
assert.equal(closed.closed, true);
assert.equal(record.status, 'closed');
assert.equal(record.exitReason, 'reclaim_trailing_stop');
assert.ok(Number.isFinite(record.netReturnPct));
assert.equal(record.paperBalanceImpact, 0);
assert.equal(labelShadowCandidate(state, record.candidateId, 'positive', startedAt + 181_000), true);
assert.equal(record.manualLabel, 'positive');

const summary = summarizeShadow(state);
assert.deepEqual(
  { total: summary.total, active: summary.active, completed: summary.completed, filled: summary.filled, returned: summary.returned },
  { total: 1, active: 0, completed: 1, filled: 1, returned: 1 },
);
assert.equal(summary.paperBalanceImpact, 0);
assert.equal(summary.manualCompared, 1);
assert.equal(summary.manualPositive, 1);

const noFill = registerShadowCandidate(
  state,
  {
    candidateId: 'R-SOLUSDT-no-fill',
    symbol: 'SOLUSDT',
    interval: '5m',
    type: 'Rounded recovery',
    level: 200,
    confirmationAt: startedAt + 1_000,
  },
  profile,
  { nowMs: startedAt + 1_001 },
).record;
const expiredAt = Date.parse(noFill.expiresAt);
processShadowQuote(noFill, { bid: 150, ask: 150 }, settings, expiredAt);
assert.equal(noFill.status, 'expired');
assert.equal(noFill.exitReason, 'no_fill_48h');
assert.equal(noFill.netReturnPct, 0, 'no-fill remains a zero candidate return');
assert.equal(noFill.levels.every((level) => level.status === 'pending'), true, 'an expired candidate cannot fill late');

setShadowEnabled(state, false, expiredAt + 1);
const recordsBeforeDisabledQuote = JSON.stringify(state.records);
processShadowBook(state, 'BTCUSDT', { bid: 1, ask: 1 }, settings, expiredAt + 2);
assert.equal(JSON.stringify(state.records), recordsBeforeDisabledQuote);
assert.equal(JSON.stringify(paper), paperBefore, 'shadow operations must not mutate paper state');

const normalized = normalizeShadowState({ enabled: true, profile: 'invalid', records: 'bad' });
assert.equal(normalized.profile, SHADOW_DEFAULT_PROFILE);
assert.deepEqual(normalized.records, []);
assert.equal(normalized.enabled, true);

assert.equal(registerShadowCandidate(state, {}, { ...profile, paper_only: false }).reason, 'disabled');
setShadowEnabled(state, true, expiredAt + 3);
assert.equal(
  registerShadowCandidate(state, {}, { ...profile, paper_only: false }).reason,
  'unsafe_profile',
);

console.log('Shadow engine: opt-in, live-only capture, lifecycle and paper isolation passed');
