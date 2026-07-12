import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  filterRadarCandidates,
  scanRadarCandidates,
} from '../terminal/modules/radar-engine.js';

const rows = Array.from({ length: 45 }, (_, index) => ({
  time: 1_700_000_000 + index * 900,
  open: 110,
  high: 110.5,
  low: 109.5,
  close: 110,
  volume: 100,
}));
Object.assign(rows[20], { open: 109, high: 109.2, low: 100, close: 106 });
Object.assign(rows[21], { open: 106, high: 108, low: 104, close: 107 });
Object.assign(rows[22], { open: 107, high: 110, low: 106, close: 109 });
Object.assign(rows[23], { open: 109, high: 110.4, low: 108, close: 110 });
Object.assign(rows[24], { open: 110, high: 110.5, low: 109, close: 110 });

const manualExamples = [{
  symbol: 'BTCUSDT',
  interval: '15m',
  selectedCandleTime: rows[20].time,
}];
const candidates = scanRadarCandidates({
  rows,
  symbol: 'BTCUSDT',
  interval: '15m',
  minScore: 45,
  manualExamples,
  intervalSeconds: 900,
});
assert.ok(candidates.length >= 1);
const candidate = candidates.find((item) => item.time === rows[20].time);
assert.ok(candidate);
assert.equal(candidate.manualMatch, true);
assert.ok(candidate.score >= 75);
assert.ok(candidate.dropAtr > 1);
assert.ok(candidate.recovery > 0.5);
assert.equal(filterRadarCandidates(candidates, 'strong').every((item) => item.strength === 'strong'), true);

const source = fs.readFileSync('terminal/modules/radar-engine.js', 'utf8');
assert.equal(source.includes('createCampaign'), false, 'Radar must stay visual-only');
assert.equal(source.includes('paper.symbols'), false, 'Radar must not mutate paper state');

console.log('Radar engine: explainable score, filters, manual match and visual-only checks passed');

