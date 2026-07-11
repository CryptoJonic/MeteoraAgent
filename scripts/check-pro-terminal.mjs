import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const paths = {
  html: 'terminal/pro.html',
  css: 'terminal/pro.css',
  app: 'terminal/pro.js',
  store: 'terminal/modules/store.js',
  paper: 'terminal/modules/paper-engine.js',
  radar: 'terminal/modules/radar-engine.js',
  backup: 'terminal/modules/backup.js',
  sw: 'terminal/sw.js',
  manifest: 'terminal/manifest.webmanifest',
};

for (const path of Object.values(paths)) assert.ok(fs.existsSync(path), `Missing ${path}`);
for (const path of [paths.app, paths.store, paths.paper, paths.radar, paths.backup, paths.sw]) {
  execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
}

const html = fs.readFileSync(paths.html, 'utf8');
const css = fs.readFileSync(paths.css, 'utf8');
const app = fs.readFileSync(paths.app, 'utf8');
const store = fs.readFileSync(paths.store, 'utf8');
const paper = fs.readFileSync(paths.paper, 'utf8');
const radar = fs.readFileSync(paths.radar, 'utf8');
const backup = fs.readFileSync(paths.backup, 'utf8');
const sw = fs.readFileSync(paths.sw, 'utf8');
const manifest = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'));
const clientSource = [html, app, store, paper, radar, backup, sw].join('\n');

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');

const requiredIds = [
  'mainChart', 'drawingCanvas', 'symbolSelect', 'intervalSelect', 'radarBtn', 'radarLegend',
  'paperPortfolioCards', 'manualGalkaPrice', 'pretradeModal', 'confirmPretrade',
  'radarCandidatesList', 'radarPositive', 'radarNegative', 'sessionStatus',
  'exportSnapshot', 'importSnapshot', 'onboardingModal', 'activityLog', 'mobile-nav',
];
for (const id of requiredIds) {
  if (id === 'mobile-nav') assert.ok(html.includes('class="mobile-nav"'));
  else assert.ok(ids.includes(id), `Missing #${id}`);
}

const checks = [
  ['module entrypoint', /<script type="module" src="pro\.js\?v=6"><\/script>/.test(html)],
  ['three paper symbols', /export const SYMBOLS = \['BTCUSDT', 'ETHUSDT', 'SOLUSDT'\]/.test(store)],
  ['storage key unchanged', /export const STORAGE_KEY = 'galka-pro-v1'/.test(store)],
  ['additive migration', /migrateStore/.test(store) && /deepMerge\(createDefaultStore\(\), source\)/.test(store)],
  ['paper long only', /side:'long'/.test(app) && !/side:'short'/.test(clientSource)],
  ['manual 0.15 ladder', /ladderStepPct: 0\.15/.test(store) && /manualDepthPct: 1\.5/.test(store)],
  ['legacy auto ladder', /LEGACY_DEPTHS = \[0\.25, 0\.7, 1\.25, 1\.9, 2\.65, 3\.5\]/.test(paper)],
  ['deterministic paper engine', /processCampaignQuote/.test(paper) && /nowMs = Date\.now\(\)/.test(paper)],
  ['trailing floor', /Math\.max\(campaign\.vLow, nextHigh \* \(1 - distance\)\)/.test(paper)],
  ['idempotent fills', /level\.status !== 'pending'/.test(paper)],
  ['safe pre-trade preview', /previewCampaign/.test(app) && /PAPER PREVIEW/.test(html)],
  ['Radar visual only', !/createCampaign|paper\.symbols/.test(radar) && /EXPLAINABLE SCORE/.test(html)],
  ['positive and negative labels', /labelRadarCandidate\('positive'\)/.test(app) && /labelRadarCandidate\('negative'\)/.test(app)],
  ['Radar filters', ['all', 'strong', 'medium'].every((value) => html.includes(`data-radar-filter="${value}"`))],
  ['drawing tool set', ['cursor','crosshair','trend','ray','horizontal','vertical','rect','channel','fib','measure','longPosition','text'].every((tool) => html.includes(`data-tool="${tool}"`))],
  ['drawing selection and handles', /drawingHitAt/.test(app) && /openSelectedDrawingProperties/.test(app) && /editing-object/.test(css)],
  ['session health and REST catch-up', /catchUpAfterReconnect/.test(app) && /sessionQuoteAge/.test(html)],
  ['full backup restore', /createBackupSnapshot/.test(app) && /validateBackupSnapshot/.test(app) && /PRE_RESTORE_BACKUP_KEY/.test(app)],
  ['installable PWA', manifest.display === 'standalone' && manifest.icons.length >= 2 && /serviceWorker\.register/.test(app)],
  ['service worker is shell-only', /service worker never runs the paper engine/i.test(sw) && !/processCampaignQuote|createCampaign/.test(sw)],
  ['onboarding', /onboardingSteps/.test(app) && /ШАГ 1 ИЗ 5/.test(html)],
  ['training replay', /markReplayGalka/.test(app) && /replayExamples/.test(store) && /future=replay\.source/.test(app)],
  ['mobile navigation', ['chart','paper','radar','watchlist','more'].every((panel) => html.includes(`data-mobile-panel="${panel}"`))],
  ['bottom sheet snaps', /\.sidebar\.snap-low/.test(css) && /\.sidebar\.snap-high/.test(css) && /beginSheetGesture/.test(app)],
  ['chart-first shell', /\.chart-main-wrap[\s\S]*height: 100%/.test(css) && /translateY\(calc\(100% \+ 12px\)\)/.test(css)],
  ['no chart grid', /vertLines:\{visible:false\}/.test(app) && /horzLines:\{visible:false\}/.test(app)],
  ['TradingView attribution', /TradingView/.test(html) && /attributionLogo:true/.test(app)],
  ['Termux direct launch remains', /terminal\/pro\.html/.test(fs.readFileSync('scripts/start-termux.sh', 'utf8'))],
  ['no exchange credentials', !/(?:api|secret)[_-]?key\s*[:=]/i.test(clientSource)],
];

for (const [name, ok] of checks) assert.ok(ok, `Galka Pro check failed: ${name}`);

console.log(`Galka Pro: ${checks.length} architecture checks passed; app ${(app.length / 1024).toFixed(1)} KiB; ${ids.length} unique IDs`);
