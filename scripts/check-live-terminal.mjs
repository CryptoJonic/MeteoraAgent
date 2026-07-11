import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('terminal/live.html', 'utf8');
const css = fs.readFileSync('terminal/live.css', 'utf8');
const js = fs.readFileSync('terminal/live.js', 'utf8');
const launcher = fs.readFileSync('scripts/start-termux.sh', 'utf8');

const checks = [
  ['paper badge', html.includes('PAPER')],
  ['BTC selector', html.includes('data-symbol="BTCUSDT"')],
  ['ETH selector', html.includes('data-symbol="ETHUSDT"')],
  ['SOL selector', html.includes('data-symbol="SOLUSDT"')],
  ['zoom controls', html.includes('id="zoomIn"') && html.includes('id="zoomOut"')],
  ['trend tool', html.includes('data-tool="trend"')],
  ['horizontal tool', html.includes('data-tool="horizontal"')],
  ['rectangle tool', html.includes('data-tool="rect"')],
  ['long only', js.includes("side:'long'") && !js.includes("side:'short'" )],
  ['six ladder depths', js.includes('0.25,0.70,1.25,1.90,2.65,3.50')],
  ['ladder weights total 100%', js.includes('0.05,0.09,0.14,0.18,0.24,0.30')],
  ['Binance current websocket', js.includes('fstream.binance.com/public/stream')],
  ['Binance REST bootstrap', js.includes('/fapi/v1/klines')],
  ['persistent paper state', js.includes("localStorage.setItem('galka-live-paper-v1'")],
  ['no exchange keys', !js.match(/api[_-]?key|secretKey|signature/i)],
  ['Termux opens live page', launcher.includes('/terminal/live.html?v=')],
  ['mobile canvas overlay', html.includes('id="drawingCanvas"') && css.includes('touch-action:none')],
];

for (const [name, ok] of checks) {
  if (!ok) throw new Error(`Live terminal check failed: ${name}`);
}
new vm.Script(js, { filename: 'terminal/live.js' });
console.log(`Live paper terminal: ${checks.length} checks passed`);
