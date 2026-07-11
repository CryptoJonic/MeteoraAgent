import fs from 'node:fs';
import vm from 'node:vm';

const htmlPath = 'terminal/index.html';
const historyPath = 'results/BTCUSDT_15m_dual_failure_v5.galka.zip';
const startPath = 'scripts/start-termux.sh';

const html = fs.readFileSync(htmlPath, 'utf8');
const start = fs.readFileSync(startPath, 'utf8');
const checks = [
  ['mobile viewport', /viewport-fit=cover/.test(html)],
  ['vertical mobile header', /class="top"/.test(html)],
  ['history button', /id="historyBtn"/.test(html)],
  ['automatic bundled load', /setTimeout\(openBundled/.test(html)],
  ['bundled history path', html.includes('../results/BTCUSDT_15m_dual_failure_v5.galka.zip')],
  ['final OOS default', /option value="final_oos" selected/.test(html)],
  ['previous navigation', /id="prevBtn"/.test(html)],
  ['next navigation', /id="nextBtn"/.test(html)],
  ['trade search', /id="searchInput"/.test(html)],
  ['long-short filter', /id="modeFilter"/.test(html)],
  ['paged trade list', /PAGE_SIZE=40/.test(html)],
  ['windowed candle rendering', /WINDOW_BEFORE=160/.test(html) && /slice\(startIndex,endIndex\)/.test(html)],
  ['trade leg parsing', /JSON\.parse\(t\.legs_json/.test(html)],
  ['branch-safe launcher', /CURRENT_BRANCH.*main/s.test(start) && /Galka запускается из ветки/.test(start) && !/reset --hard|git stash push -u/.test(start)],
  ['cache-busted Termux URL', /terminal\/(?:pro|live)?(?:\.html)?\?v=/.test(start)],
];

for (const [name, ok] of checks) {
  if (!ok) throw new Error(`Mobile check failed: ${name}`);
}
if (!fs.existsSync(historyPath)) throw new Error(`Missing bundled history: ${historyPath}`);
if (fs.statSync(historyPath).size < 1_000_000) throw new Error('Bundled history unexpectedly small');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
if (!inline) throw new Error('Inline application script not found');
new vm.Script(inline, { filename: htmlPath });
console.log(`Mobile terminal: ${checks.length} checks passed; history ${(fs.statSync(historyPath).size / 1_048_576).toFixed(1)} MiB`);
