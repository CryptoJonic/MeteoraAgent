(()=>{
'use strict';
const $=id=>document.getElementById(id);
const els={notice:$('notice'),variant:$('variant'),baseline:$('baseline'),metrics:$('metrics'),chart:$('chart'),period:$('period'),coins:$('coins'),recent:$('recent'),annual:$('annual')};
let data,curves,chart,line,baseLine;
const money=v=>'$'+Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=v=>(Number(v)>=0?'+':'')+Number(v).toFixed(2)+'%';
const cls=v=>Number(v)>=0?'up':'down';
function metric(name,value,c=''){return `<article class="metric"><small>${name}</small><b class="${c}">${value}</b></article>`}
function makeChart(){
 chart=LightweightCharts.createChart(els.chart,{autoSize:true,layout:{background:{type:'solid',color:'#0b0e13'},textColor:'#8b93a4'},grid:{vertLines:{color:'#1c222d'},horzLines:{color:'#1c222d'}},rightPriceScale:{borderColor:'#2a303d'},timeScale:{borderColor:'#2a303d',timeVisible:false},crosshair:{mode:LightweightCharts.CrosshairMode.Normal},handleScale:{pinch:true,mouseWheel:true},handleScroll:{horzTouchDrag:true,mouseWheel:true,pressedMouseMove:true}});
 line=chart.addSeries(LightweightCharts.LineSeries,{color:'#2962ff',lineWidth:2,priceFormat:{type:'price',precision:2,minMove:.01}});
 baseLine=chart.addSeries(LightweightCharts.LineSeries,{color:'#8b93a4',lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false});
}
function render(){
 const id=els.variant.value,m=data.summaries[id],rows=curves[id]||[];
 line.setData(rows.map(x=>({time:x.time.slice(0,10),value:x.equity})));
 baseLine.setData(els.baseline.checked&&rows.length?rows.map(x=>({time:x.time.slice(0,10),value:1000})):[]);
 chart.timeScale().fitContent();els.period.textContent=`${data.meta.data_start} — ${data.meta.data_end}`;
 els.metrics.innerHTML=[metric('Конечный депозит',money(m.ending_equity),cls(m.ending_equity-1000)),metric('Доходность',pct(m.return_pct),cls(m.return_pct)),metric('Макс. просадка',pct(m.max_drawdown_pct),'down'),metric('Сделок',m.trades.toLocaleString('ru-RU')),metric('Win rate',m.win_rate_pct.toFixed(2)+'%'),metric('Profit factor',m.profit_factor.toFixed(2),m.profit_factor>=1?'up':'down'),metric('Ликвидаций',m.liquidations,m.liquidations?'down':'up')].join('');
 els.coins.innerHTML=['BTCUSDT','ETHUSDT','SOLUSDT'].map(s=>{const x=m.sleeves[s]||{};return `<article class="coin"><small>${s.replace('USDT','')}</small><b class="${cls((x.ending||0)-333.333)}">${money(x.ending)}</b><div>${pct(x.return_pct||0)} · сделок ${x.trades||0} · ликвидаций ${x.liquidations||0}</div></article>`}).join('');
 const o=data.oos_2026[id];els.recent.innerHTML=o?[['Конечный депозит',money(o.ending_equity),cls(o.ending_equity-1000)],['Доходность',pct(o.return_pct),cls(o.return_pct)],['Просадка',pct(o.max_drawdown_pct),'down'],['Сделок',o.trades,''],['Win rate',o.win_rate_pct.toFixed(2)+'%',''],['Profit factor',o.profit_factor.toFixed(2),o.profit_factor>=1?'up':'down']].map(x=>`<div><small>${x[0]}</small><b class="${x[2]}">${x[1]}</b></div>`).join(''):'<div><small>Нет сделок</small><b>—</b></div>';
}
async function boot(){
 try{
  const [a,b]=await Promise.all([fetch('../results/reclaim_backtest/backtest-lite.json?v=2',{cache:'no-store'}),fetch('../results/reclaim_backtest/curves-annual.json?v=2',{cache:'no-store'})]);if(!a.ok||!b.ok)throw new Error(`HTTP ${a.status}/${b.status}`);data=await a.json();curves=await b.json();
  const order=['trail075_400','trail075_300','trail075_250','trail075_200','trail075_500','trail075_1000','trail075_3333','target_3333','trail050_3333','trail100_3333','trail150_3333','trail075_2000'];
  els.variant.innerHTML=order.filter(x=>data.summaries[x]).map(x=>`<option value="${x}">${data.labels[x]}</option>`).join('');els.variant.value=data.meta.selected_variant;
  els.annual.innerHTML=data.annual_selected.map(x=>`<tr><td>${x.year}</td><td class="${cls(x.pnl)}">${money(x.pnl)}</td><td>${money(x.end_equity)}</td></tr>`).join('');makeChart();render();els.notice.textContent='Проверенный исторический replay загружен.';els.notice.className='notice ok';
 }catch(e){console.error(e);els.notice.textContent='Не удалось открыть результат: '+e.message;els.notice.className='notice error';}
}
els.variant.onchange=render;els.baseline.onchange=render;boot();
})();