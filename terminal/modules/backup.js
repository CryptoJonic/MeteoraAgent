import { migrateStore, STORE_SCHEMA_VERSION } from './store.js';

export function createBackupSnapshot(store, appVersion, createdAt = new Date().toISOString()) {
  return {
    kind: 'galka-pro-snapshot',
    schemaVersion: STORE_SCHEMA_VERSION,
    appVersion,
    createdAt,
    store: JSON.parse(JSON.stringify(store)),
  };
}

export function validateBackupSnapshot(snapshot) {
  if (!snapshot || snapshot.kind !== 'galka-pro-snapshot' || !snapshot.store) {
    throw new Error('Это не полный snapshot Galka Pro');
  }
  if (!snapshot.store.paper?.symbols || !snapshot.store.ui || !snapshot.store.training) {
    throw new Error('В snapshot отсутствуют обязательные разделы');
  }
  return migrateStore(snapshot.store);
}

export function summarizeBackupSnapshot(snapshot) {
  const store = validateBackupSnapshot(snapshot);
  const campaigns = Object.values(store.paper.symbols).filter((item) => item.campaign).length;
  const filledLevels = Object.values(store.paper.symbols).reduce(
    (sum, item) => sum + (item.campaign?.levels || []).filter((level) => level.status === 'filled').length,
    0,
  );
  const drawings = Object.values(store.ui.drawings || {}).reduce(
    (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
    0,
  );
  return {
    createdAt: snapshot.createdAt || null,
    campaigns,
    filledLevels,
    trades: store.paper.trades.length,
    drawings,
    manualExamples: store.training.manualExamples.length,
    radarLabels: store.training.radarLabels.length,
  };
}

