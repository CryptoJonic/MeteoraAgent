import fs from 'node:fs';
const p='examples/demo.galka.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
for(const k of ['meta','candles','trades'])if(!(k in d))throw new Error(`Missing ${k}`);
if(!Array.isArray(d.candles)||!d.candles.length)throw new Error('No candles');
if(!Array.isArray(d.trades))throw new Error('Trades must be array');
for(const t of d.trades){for(const k of ['id','v_low','break_time','risk_money','pnl'])if(!(k in t))throw new Error(`Trade ${t.id??'?'} missing ${k}`);if((t.fills||[]).some(f=>f.price<t.last_limit))throw new Error(`Trade ${t.id} fills below last_limit`)}
console.log(`Validated ${p}: ${d.candles.length} candles, ${d.trades.length} trades`);
