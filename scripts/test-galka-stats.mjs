import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import {
  GALKA_STATS_ASSET_SHA256,
  GALKA_STATS_MODEL,
  GALKA_STATS_PAYLOAD_CHECKSUM,
  GALKA_STATS_SCHEMA,
  aggregateFinalOos,
  blockSummary,
  classifyGalka,
  galkaInsight,
  parseGalkaStatsBytes,
  researchFeaturesAt,
  typeSummary,
  validateGalkaStatsPack,
} from '../terminal/modules/galka-stats.js';

const compressed = new Uint8Array(
  await readFile(new URL('../terminal/data/galka-stats-v1.json.gz', import.meta.url)),
);
const pack = await parseGalkaStatsBytes(compressed, {
  gunzip: async (bytes) => new Uint8Array(gunzipSync(bytes)),
});

assert.equal(pack.schemaVersion, GALKA_STATS_SCHEMA);
assert.equal(pack.modelVersion, GALKA_STATS_MODEL);
assert.equal(pack.checksum, GALKA_STATS_PAYLOAD_CHECKSUM);
assert.equal(GALKA_STATS_ASSET_SHA256.length, 64);
assert.deepEqual(pack.data.symbols, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
assert.deepEqual(pack.data.intervals, ['5m', '15m', '30m', '1h']);
assert.equal(pack.safety.paperOnly, true);
assert.equal(pack.safety.autoPaperDefault, false);
assert.equal(pack.safety.realOrders, false);
assert.equal(pack.safety.liveShadowRequiredBeforeAutoPaper, true);

assert.throws(
  () => validateGalkaStatsPack({ ...pack, safety: { ...pack.safety, realOrders: true } }),
  /safety flags/,
);
await assert.rejects(
  () => parseGalkaStatsBytes(compressed, {
    expectedSha256: '0'.repeat(64),
    gunzip: async (bytes) => new Uint8Array(gunzipSync(bytes)),
  }),
  /Checksum файла/,
);

for (const [cluster, type] of Object.entries(pack.model.type_names)) {
  const clusterId = Number(cluster);
  const features = Object.fromEntries(
    pack.model.features.map((feature, index) => [
      feature,
      pack.model.scaler_mean[index]
        + pack.model.centers_scaled[clusterId][index] * pack.model.scaler_scale[index],
    ]),
  );
  const classified = classifyGalka(pack, features);
  assert.equal(classified.clusterId, clusterId);
  assert.equal(classified.type, type);
  assert.equal(classified.featureCoverage, 1);
  assert.ok(classified.distance < 1e-9);
}

const firstType = pack.model.type_names['0'];
for (const type of Object.values(pack.model.type_names)) {
  const aggregate = aggregateFinalOos(pack, type);
  assert.ok(aggregate.count_candidates > 0);
  assert.ok(aggregate.strategy_evaluable_count > 0);
  assert.ok(aggregate.conservative_net_return_pct_mean < 0, `${type} Conservative must remain promotion-blocked`);
  assert.ok(aggregate.balanced_net_return_pct_mean < 0, `${type} Balanced must remain promotion-blocked`);
}
const globalRow = typeSummary(pack, {
  symbol: 'BTCUSDT',
  interval: '15m',
  type: firstType,
  window: 'all',
});
assert.ok(globalRow?.count_candidates > 0);
assert.ok(globalRow.return_24h_probability >= globalRow.return_1h_probability);

const blockRow = blockSummary(pack, { type: firstType });
assert.equal(blockRow.scope, 'cross_symbol');
assert.equal(blockRow.split, 'final_oos');
assert.ok(blockRow.block_count >= 40);

const insight = galkaInsight(pack, {
  symbol: 'BTCUSDT',
  interval: '15m',
  type: firstType,
  window: 'all',
  profile: 'Balanced',
});
assert.equal(insight.summary, globalRow);
assert.equal(insight.block, blockRow);
assert.equal(insight.profile.paper_only, true);
assert.equal(insight.profile.stress_test_only, false);
assert.deepEqual(insight.profile.depths_pct.length, insight.profile.weights.length);
assert.equal(insight.grids.length, 3);
assert.ok(insight.stops.length >= 6);
assert.ok(insight.exits.length >= 4);

const rows = Array.from({ length: 82 }, (_, index) => ({
  time: index * 300,
  open: 100,
  high: 100.2,
  low: 99.8,
  close: 100,
  volume: 100 + index,
}));
rows[60] = { ...rows[60], open: 98, high: 99, low: 97, close: 98.5, volume: 320 };
for (let index = 61; index <= 66; index += 1) {
  rows[index] = {
    ...rows[index],
    open: 98.5 + (index - 61) * 0.1,
    high: 99 + (index - 61) * 0.2,
    low: 97.8 + (index - 61) * 0.1,
    close: 98.8 + (index - 61) * 0.15,
  };
}
const researchFeatures = researchFeaturesAt(rows, 60, '5m', { marketReturn1h: 0 });
assert.ok(researchFeatures);
assert.ok(researchFeatures.drop_atr >= 0.8);
assert.ok(researchFeatures.recovery_ratio >= 0.25);
assert.equal(Object.hasOwn(researchFeatures, 'local_vs_market_1h'), true);
const rowsWithGap = rows.map((row) => ({ ...row }));
rowsWithGap[58].time += 60;
assert.equal(researchFeaturesAt(rowsWithGap, 60, '5m'), null, 'live classification must not cross a source gap');

console.log('Galka stats: signed pack, classifier, queries and research features passed');
