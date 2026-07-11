import fs from 'node:fs';
import vm from 'node:vm';

const htmlPath='terminal/pro.html';
const cssPath='terminal/pro.css';
const jsPath='terminal/pro.js';
for(const p of [htmlPath,cssPath,jsPath])if(!fs.existsSync(p))throw new Error(`Missing ${p}`);
const html=fs.readFileSync(htmlPath,'utf8');
const css=fs.readFileSync(cssPath,'utf8');
const js=fs.readFileSync(jsPath,'utf8');

new vm.Script(js,{filename:jsPath});

const checks=[
  ['three symbols', /const SYMBOLS = \['BTCUSDT','ETHUSDT','SOLUSDT'\]/.test(js)],
  ['multiple timeframes', /'1m','3m','5m','15m','30m','1h','4h','1d'/.test(js)],
  ['six chart types', ['candles','bars','heikin','line','area','baseline'].every(x=>html.includes(`value="${x}"`))],
  ['paper long only', /side:'long'/.test(js) && !/side:'short'/.test(js)],
  ['six averaging levels', /const DEPTHS = \[0\.25,0\.70,1\.25,1\.90,2\.65,3\.50\]/.test(js)],
  ['paper account', /startingBalance:1000/.test(js) && /symbolNotional:3333\.33/.test(js)],
  ['drawing tools', ['trend','ray','horizontal','vertical','rect','channel','fib','measure','longPosition','text'].every(x=>html.includes(`data-tool="${x}"`))],
  ['undo redo', /id="undoBtn"/.test(html)&&/id="redoBtn"/.test(html)],
  ['indicators', ['sma20','ema20','ema50','bollinger','vwap','volume','rsi','macd','atr'].every(x=>js.includes(`'${x}'`))],
  ['compare symbol', /id="compareSelect"/.test(html)&&/updateCompare/.test(js)],
  ['alerts', /id="createAlert"/.test(html)&&/processAlerts/.test(js)],
  ['bar replay', /id="replayPanel"/.test(html)&&/startReplay/.test(js)],
  ['templates', /id="saveTemplate"/.test(html)&&/templates/.test(js)],
  ['workspace import export', /id="exportWorkspace"/.test(html)&&/id="importWorkspace"/.test(html)],
  ['screenshot', /takeScreenshot/.test(js)],
  ['mobile layout', /@media\(max-width:700px\)/.test(css)&&/mobile-nav/.test(css)],
  ['TradingView attribution', /TradingView/.test(html)&&/attributionLogo:true/.test(js)],
  ['no exchange keys', !/api[_-]?key|secret[_-]?key/i.test(js)],
];
for(const [name,ok] of checks)if(!ok)throw new Error(`Galka Pro check failed: ${name}`);
console.log(`Galka Pro: ${checks.length} checks passed; JS ${(js.length/1024).toFixed(1)} KiB`);
