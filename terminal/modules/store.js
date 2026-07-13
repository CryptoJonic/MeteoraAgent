import { createShadowState, normalizeShadowState } from './shadow-engine.js';

export const STORAGE_KEY = 'galka-pro-v1';
export const STORE_SCHEMA_VERSION = 5;
export const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
export const PAPER_RECOVERY_POLICY = 'closed-1m-directional-v1';

const SIMPLE_MANUAL_DEPTHS = [0.15, 0.3, 0.45, 0.6, 0.9, 1.2, 1.5, 2.0];
const SIMPLE_MANUAL_WEIGHTS = [0.42, 0.22, 0.12, 0.08, 0.06, 0.04, 0.03, 0.03];

export function createPaperRecoveryState() {
  return {
    version: 1,
    policy: PAPER_RECOVERY_POLICY,
    checkpointAt: null,
    gapStartedAt: null,
    gapReason: null,
    gapSequence: 0,
    lastRecoveryAt: null,
    lastRecoveryStatus: 'idle',
    symbols: Object.fromEntries(
      SYMBOLS.map((symbol) => [
        symbol,
        {
          lastMarketAt: null,
          lastRecoveredCloseAt: null,
          lastRecoveryAt: null,
          lastRecoveryStatus: 'idle',
          recoveredCandles: 0,
          boundaryCandles: 0,
        },
      ]),
    ),
  };
}

export function createDefaultStore() {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    ui: {
      theme: 'dark',
      symbol: 'BTCUSDT',
      interval: '15m',
      chartType: 'candles',
      compare: '',
      scaleMode: 'normal',
      indicators: {
        sma20: false,
        ema20: false,
        ema50: false,
        bollinger: false,
        vwap: false,
        volume: false,
      },
      lowerIndicator: null,
      magnet: true,
      drawingsLocked: false,
      drawingsHidden: false,
      showLevels: true,
      drawings: {},
      templates: {},
      alerts: [],
      radar: {
        enabled: false,
        minScore: 45,
        filter: 'all',
        visibleOnly: false,
      },
      lab: {
        symbol: 'BTCUSDT',
        interval: '15m',
        type: 'Deep capitulation',
        window: 'all',
        profile: 'Balanced',
        regime: 'all',
      },
      onboarding: {
        completed: true,
        version: 1,
      },
      sheet: {
        panel: 'chart',
        snap: 'medium',
      },
    },
    paper: {
      settings: {
        startingBalance: 1000,
        leverage: 10,
        symbolNotional: 400,
        maxHours: 72,
        signalMode: 'manual',
        ladderStepPct: 0.15,
        manualDepthPct: 2.0,
        exitMode: 'target',
        reclaimBufferPct: 0,
        trailDistancePct: 0.75,
        makerFee: 0.0002,
        takerFee: 0.0005,
        slippage: 0.0002,
        maintenanceMargin: 0.0125,
      },
      realizedPnl: 0,
      fees: 0,
      trades: [],
      recovery: createPaperRecoveryState(),
      symbols: Object.fromEntries(
        SYMBOLS.map((symbol) => [symbol, { pattern: null, campaign: null }]),
      ),
    },
    training: {
      manualExamples: [],
      radarLabels: [],
      replayExamples: [],
    },
    shadow: createShadowState(),
    activity: [],
  };
}

export function deepMerge(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
  if (base && typeof base === 'object') {
    const output = { ...base };
    for (const [key, value] of Object.entries(extra || {})) {
      output[key] = key in base ? deepMerge(base[key], value) : value;
    }
    return output;
  }
  return extra === undefined ? base : extra;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeSimpleManualCampaign(campaign, settings) {
  if (!campaign || campaign.source !== 'manual') return campaign;
  campaign.target = campaign.vLow;
  campaign.exitMode = 'target';
  campaign.reclaimPrice = campaign.vLow;
  campaign.trailArmed = false;
  campaign.trailHigh = null;
  campaign.trailStop = null;
  campaign.trailActivatedAt = null;
  campaign.l1Cycles = Math.max(0, Number(campaign.l1Cycles) || 0);
  campaign.l1CycleRealizedPnl = Number(campaign.l1CycleRealizedPnl) || 0;
  if (campaign.status === 'trailing') campaign.status = campaign.qty ? 'open' : 'waiting';

  const hasFill = Number(campaign.qty) > 0 || campaign.levels?.some((level) => level.status === 'filled');
  if (!hasFill) {
    const notional = Math.max(0, Number(settings.symbolNotional) || 0);
    campaign.levels = SIMPLE_MANUAL_DEPTHS.map((depthPct, index) => ({
      index: index + 1,
      depthPct,
      weight: SIMPLE_MANUAL_WEIGHTS[index],
      price: campaign.vLow * (1 - depthPct / 100),
      notional: notional * SIMPLE_MANUAL_WEIGHTS[index],
      status: 'pending',
      fillPrice: null,
      fillTime: null,
      qty: 0,
      fee: 0,
    }));
    campaign.qty = 0;
    campaign.filledNotional = 0;
    campaign.averageEntry = null;
    campaign.entryFees = 0;
    campaign.unrealizedPnl = 0;
  }
  return campaign;
}

export function migrateStore(rawStore) {
  const source = rawStore && typeof rawStore === 'object' ? clone(rawStore) : {};
  const migrated = deepMerge(createDefaultStore(), source);

  // Keep the three engines present without replacing any existing symbol state.
  migrated.paper.symbols ||= {};
  for (const symbol of SYMBOLS) {
    migrated.paper.symbols[symbol] = deepMerge(
      { pattern: null, campaign: null },
      migrated.paper.symbols[symbol],
    );
  }

  migrated.paper.settings.signalMode = 'manual';
  migrated.paper.settings.ladderStepPct = 0.15;
  migrated.paper.settings.manualDepthPct = 2.0;
  migrated.paper.settings.exitMode = 'target';
  migrated.paper.settings.reclaimBufferPct = 0;
  for (const symbol of SYMBOLS) {
    migrated.paper.symbols[symbol].campaign = normalizeSimpleManualCampaign(
      migrated.paper.symbols[symbol].campaign,
      migrated.paper.settings,
    );
  }

  migrated.paper.recovery = deepMerge(
    createPaperRecoveryState(),
    migrated.paper.recovery,
  );
  migrated.paper.recovery.policy = PAPER_RECOVERY_POLICY;
  migrated.paper.recovery.symbols ||= {};
  for (const symbol of SYMBOLS) {
    migrated.paper.recovery.symbols[symbol] = deepMerge(
      createPaperRecoveryState().symbols[symbol],
      migrated.paper.recovery.symbols[symbol],
    );
  }

  migrated.training.manualExamples = Array.isArray(migrated.training.manualExamples)
    ? migrated.training.manualExamples
    : [];
  migrated.training.radarLabels = Array.isArray(migrated.training.radarLabels)
    ? migrated.training.radarLabels
    : [];
  migrated.training.replayExamples = Array.isArray(migrated.training.replayExamples)
    ? migrated.training.replayExamples
    : [];
  if (migrated.ui.radar.filter === 'medium') migrated.ui.radar.filter = 'strong';
  if (!['all', 'strong', 'mine', 'profitable', 'losing'].includes(migrated.ui.radar.filter)) {
    migrated.ui.radar.filter = 'all';
  }
  migrated.ui.radar.enabled = false;
  migrated.ui.indicators.volume = false;
  migrated.ui.lowerIndicator = null;
  migrated.ui.onboarding.completed = true;
  migrated.ui.sheet.panel = 'chart';
  migrated.shadow = normalizeShadowState(migrated.shadow);
  migrated.shadow.enabled = false;
  migrated.activity = Array.isArray(migrated.activity) ? migrated.activity : [];
  migrated.schemaVersion = STORE_SCHEMA_VERSION;
  return migrated;
}

export function loadStore(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    return migrateStore(raw);
  } catch (error) {
    console.warn('Galka store recovery:', error);
    return createDefaultStore();
  }
}

export function saveStore(store, storage = globalThis.localStorage) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
}

export function appendActivity(store, event, now = new Date().toISOString()) {
  store.activity ||= [];
  store.activity.push({
    id: `A-${Date.parse(now) || Date.now()}-${store.activity.length + 1}`,
    at: now,
    ...event,
  });
  if (store.activity.length > 500) store.activity.splice(0, store.activity.length - 500);
}

export function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}
