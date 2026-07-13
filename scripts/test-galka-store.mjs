import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  STORE_SCHEMA_VERSION,
  createDefaultStore,
  createMemoryStorage,
  loadStore,
  migrateStore,
  saveStore,
} from '../terminal/modules/store.js';
import {
  createBackupSnapshot,
  summarizeBackupSnapshot,
  validateBackupSnapshot,
} from '../terminal/modules/backup.js';

const oldCampaign = {
  campaignId: 'C-BTC-legacy',
  symbol: 'BTCUSDT',
  status: 'trailing',
  vLow: 60_000,
  trailArmed: true,
  trailHigh: 61_500,
  trailStop: 60_900,
  qty: 0.012,
  levels: [
    { index: 1, price: 59_910, status: 'filled', qty: 0.006, fillTime: '2026-01-01T00:00:00.000Z' },
    { index: 2, price: 59_820, status: 'pending', qty: 0 },
  ],
  futureField: { preserve: true },
};

const legacyStore = {
  ui: {
    symbol: 'ETHUSDT',
    drawings: { 'BTCUSDT|15m': [{ id: 'D1', type: 'trend' }] },
    radar: { enabled: true, minScore: 67 },
  },
  paper: {
    settings: { startingBalance: 2_000, symbolNotional: 700 },
    realizedPnl: 42.5,
    trades: [{ tradeId: 'P000001', symbol: 'SOLUSDT', netPnl: 42.5 }],
    symbols: {
      BTCUSDT: { pattern: { patternId: 'legacy-pattern' }, campaign: oldCampaign },
      ETHUSDT: { pattern: null, campaign: { campaignId: 'C-ETH', status: 'waiting', levels: [] } },
      SOLUSDT: { pattern: null, campaign: null },
    },
  },
  training: {
    manualExamples: [{ id: 'M1', symbol: 'BTCUSDT', status: 'active' }],
  },
  unknownFutureSection: { mustSurvive: true },
};

const migrated = migrateStore(legacyStore);
assert.equal(migrated.schemaVersion, STORE_SCHEMA_VERSION);
assert.deepEqual(migrated.paper.symbols.BTCUSDT.campaign, oldCampaign);
assert.deepEqual(migrated.ui.drawings, legacyStore.ui.drawings);
assert.deepEqual(migrated.paper.trades, legacyStore.paper.trades);
assert.deepEqual(migrated.training.manualExamples, legacyStore.training.manualExamples);
assert.deepEqual(migrated.unknownFutureSection, legacyStore.unknownFutureSection);
assert.equal(migrated.ui.radar.enabled, false);
assert.equal(migrated.ui.radar.filter, 'all');
assert.deepEqual(migrated.training.radarLabels, []);
assert.equal(migrated.paper.recovery.policy, 'closed-1m-directional-v1');
assert.deepEqual(Object.keys(migrated.paper.recovery.symbols), ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
assert.equal(migrated.paper.recovery.symbols.BTCUSDT.lastMarketAt, null);
assert.equal(migrated.shadow.enabled, false);
assert.equal(migrated.shadow.profile, 'Balanced');
assert.deepEqual(migrated.shadow.records, []);
assert.equal(migrated.ui.lab.window, 'all');
assert.equal(migrated.ui.lab.regime, 'all');
assert.equal(migrated.paper.settings.signalMode, 'manual');
assert.equal(migrated.paper.settings.manualDepthPct, 2);
assert.equal(migrated.paper.settings.exitMode, 'target');

const paperBeforeShadow = JSON.stringify(migrated.paper);
migrated.shadow.enabled = true;
migrated.shadow.startedAt = '2026-07-12T00:00:00.000Z';
migrated.shadow.records.push({ id: 'S-test', paperBalanceImpact: 0 });
assert.equal(JSON.stringify(migrated.paper), paperBeforeShadow);

const memory = createMemoryStorage();
saveStore(migrated, memory);
assert.ok(memory.getItem(STORAGE_KEY));
const roundTrip = loadStore(memory);
assert.deepEqual(roundTrip.paper.symbols, migrated.paper.symbols);
assert.deepEqual(roundTrip.ui.drawings, migrated.ui.drawings);
assert.deepEqual(roundTrip.training.manualExamples, migrated.training.manualExamples);
assert.deepEqual(roundTrip.paper.recovery, migrated.paper.recovery);
assert.equal(roundTrip.shadow.enabled, false, 'simple terminal disables shadow on every load');
assert.deepEqual(roundTrip.shadow.records, migrated.shadow.records, 'shadow records are preserved');
assert.equal(roundTrip.shadow.startedAt, migrated.shadow.startedAt, 'shadow history metadata is preserved');

const blank = createDefaultStore();
assert.deepEqual(Object.keys(blank.paper.symbols), ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
assert.equal(blank.paper.settings.manualDepthPct, 2);
assert.equal(blank.paper.settings.exitMode, 'target');

const snapshot = createBackupSnapshot(migrated, 'test', '2026-07-11T00:00:00.000Z');
const summary = summarizeBackupSnapshot(snapshot);
assert.deepEqual(summary, {
  createdAt: '2026-07-11T00:00:00.000Z',
  campaigns: 2,
  filledLevels: 1,
  trades: 1,
  drawings: 1,
  manualExamples: 1,
  radarLabels: 0,
  shadowRecords: 1,
  shadowEnabled: true,
});
assert.deepEqual(validateBackupSnapshot(snapshot).paper.symbols, migrated.paper.symbols);
assert.throws(() => validateBackupSnapshot({}), /не полный snapshot/);

console.log('Galka store: simple migration, localStorage round-trip and backup checks passed');
