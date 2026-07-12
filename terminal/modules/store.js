export const STORAGE_KEY = 'galka-manual-auto-v1';
export const STORE_SCHEMA_VERSION = 3;
export const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
export const PAPER_RECOVERY_POLICY = 'closed-1m-directional-v1';

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
        volume: true,
      },
      lowerIndicator: 'rsi',
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
      onboarding: {
        completed: false,
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
        manualDepthPct: 1.5,
        exitMode: 'trail',
        reclaimBufferPct: 0.1,
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
