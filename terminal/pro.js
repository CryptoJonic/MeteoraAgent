(()=>{
'use strict';

const LWC = window.LightweightCharts;
const VERSION = 'pro-v1.1.0-reclaim-trail';
const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT'];
const INTERVALS = ['1m','3m','5m','15m','30m','1h','4h','1d'];
const REST = 'https://fapi.binance.com';
const WS_BASE = 'wss://fstream.binance.com/stream?streams=';
const DEPTHS = [0.25,0.70,1.25,1.90,2.65,3.50];
const WEIGHTS = [0.05,0.09,0.14,0.18,0.24,0.30];
const STORAGE_KEY = 'galka-pro-v1';
const COLORS = {green:'#089981',red:'#f23645',blue:'#2962ff',orange:'#ff9800',purple:'#9c6ade',cyan:'#26c6da',gray:'#8b93a4'};
const $ = id => document.getElementById(id);
const els = Object.fromEntries([
  'symbolSelect','intervalSelect','chartTypeSelect','indicatorBtn','alertBtn','replayBtn','snapshotBtn','fullscreenBtn',
  'toggleTools','toggleSidebar','leftbar','sidebar','connectionDot','connectionText','tickerText','themeBtn','clock',
  'ohlc','zoomOut','zoomIn','autoScaleBtn','scaleMode','goDateBtn','fitBtn','latestBtn','chartStack','chartMainWrap',
  'mainChart','drawingCanvas','watermark','loading','toast','indicatorPane','paneTitle','oscChart','closePane',
  'replayPanel','replayBack','replayPlay','replayStep','replaySlider','replayLabel','replayExit',
  'watchlist','refreshBtn','compareSelect','equity','openPnl','realizedPnl','marginUsed','botTitle','botState',
  'campaignCard','fillsCount','levelsList','startingBalance','leverage','symbolNotional','maxHours','exitMode','reclaimBufferPct','trailDistancePct','savePaperSettings',
  'resetPaper','exportTrades','tradeHistory','objectsList','exportWorkspace','importWorkspace','templateName','saveTemplate',
  'templatesList','alertSymbol','alertDirection','alertPrice','alertNote','createAlert','alertsList',
  'dwTime','dwOpen','dwHigh','dwLow','dwClose','dwVolume','dwAtr','dwChange','diagnostics',
  'indicatorModal','indicatorSearch','indicatorList','goDateModal','goDateInput','goDateApply',
  'magnetBtn','lockBtn','hideDrawingsBtn','undoBtn','redoBtn','deleteBtn','clearBtn'
].map(id=>[id,$(id)]));

function defaultStore(){
  return {
    ui:{
      theme:'dark',symbol:'BTCUSDT',interval:'15m',chartType:'candles',compare:'',scaleMode:'normal',
      indicators:{sma20:false,ema20:false,ema50:false,bollinger:false,vwap:false,volume:true},
      lowerIndicator:'rsi',magnet:true,drawingsLocked:false,drawingsHidden:false,
      drawings:{},templates:{},alerts:[]
    },
    paper:{
      settings:{startingBalance:1000,leverage:10,symbolNotional:3333.33,maxHours:72,exitMode:'trail',reclaimBufferPct:0.10,trailDistancePct:0.75,makerFee:0.0002,takerFee:0.0005,slippage:0.0002,maintenanceMargin:0.0125},
      realizedPnl:0,fees:0,trades:[],symbols:Object.fromEntries(SYMBOLS.map(s=>[s,{pattern:null,campaign:null}]))
    }
  };
}
function deepMerge(base, extra){
  if(Array.isArray(base)) return Array.isArray(extra)?extra:base;
  if(base && typeof base==='object'){
    const out={...base};
    for(const [k,v] of Object.entries(extra||{})) out[k]=k in base?deepMerge(base[k],v):v;
    return out;
  }
  return extra===undefined?base:extra;
}
function loadStore(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    return raw?deepMerge(defaultStore(),raw):defaultStore();
  }catch(e){console.warn(e);return defaultStore();}
}
let store=loadStore();
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
function money(v){return '$'+num(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function signedMoney(v){return (num(v)>=0?'+':'')+money(v);}
function price(v,s=runtime.symbol){
  if(v==null||!Number.isFinite(Number(v))) return '—';
  const p=s==='SOLUSDT'?4:2; return Number(v).toFixed(p);
}
function fmtTime(ts){return ts?new Date(ts*1000).toLocaleString('ru-RU',{year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';}
function nowIso(){return new Date().toISOString();}
function key(symbol=runtime.symbol,interval=runtime.interval){return symbol+'|'+interval;}
function toast(text,kind=''){
  els.toast.textContent=text;els.toast.className='toast '+kind;clearTimeout(runtime.toastTimer);
  runtime.toastTimer=setTimeout(()=>els.toast.classList.add('hidden'),3500);
}
function download(name,blob){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}

const runtime={
  symbol:store.ui.symbol,interval:store.ui.interval,chartType:store.ui.chartType,
  mainChart:null,priceSeries:null,markerApi:null,compareSeries:null,paperLines:[],
  indicatorSeries:[],volumeSeries:null,oscChart:null,oscSeries:[],
  candles:new Map(),botCandles:Object.fromEntries(SYMBOLS.map(s=>[s,[]])),
  quotes:Object.fromEntries(SYMBOLS.map(s=>[s,{bid:null,ask:null,last:null,open24:null,change24:null,updated:null}])),
  ws:null,reconnect:null,wsAttempt:0,loading:new Set(),syncing:false,
  tool:'cursor',drawingStart:null,drawingPreview:null,selectedDrawing:null,undo:[],redo:[],
  dpr:window.devicePixelRatio||1,toastTimer:null,lastCrosshair:null,
  replay:{active:false,index:0,playing:false,timer:null,source:null},
  hiddenLiveUpdates:false
};

function chartColors(){
  const light=store.ui.theme==='light';
  return {
    background:light?'#ffffff':'#0b0e13',text:light?'#4b5565':'#a5adbd',
    grid:light?'#e8ebf0':'#1c222d',border:light?'#d0d5dd':'#2a303d'
  };
}
function createMainChart(){
  const c=chartColors();
  runtime.mainChart=LWC.createChart(els.mainChart,{
    autoSize:true,
    layout:{background:{type:'solid',color:c.background},textColor:c.text,fontFamily:'Inter,system-ui',attributionLogo:true},
    grid:{vertLines:{color:c.grid},horzLines:{color:c.grid}},
    crosshair:{mode:LWC.CrosshairMode.Normal,vertLine:{labelBackgroundColor:'#2962ff'},horzLine:{labelBackgroundColor:'#2962ff'}},
    rightPriceScale:{visible:true,borderColor:c.border,autoScale:true,scaleMargins:{top:.08,bottom:.12}},
    leftPriceScale:{visible:false,borderColor:c.border},
    timeScale:{borderColor:c.border,timeVisible:true,secondsVisible:false,rightOffset:8,barSpacing:7,fixLeftEdge:false,fixRightEdge:false},
    handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
    handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true}
  });
  runtime.mainChart.subscribeCrosshairMove(onCrosshair);
  runtime.mainChart.timeScale().subscribeVisibleTimeRangeChange(()=>drawAll());
  runtime.mainChart.timeScale().subscribeVisibleLogicalRangeChange(range=>{
    if(runtime.syncing||!runtime.oscChart||!range)return;
    runtime.syncing=true;try{runtime.oscChart.timeScale().setVisibleLogicalRange(range);}catch(_){}
    runtime.syncing=false;
  });
  createPriceSeries();
}
function createOscChart(){
  const c=chartColors();
  runtime.oscChart=LWC.createChart(els.oscChart,{
    autoSize:true,layout:{background:{type:'solid',color:c.background},textColor:c.text,attributionLogo:false},
    grid:{vertLines:{color:c.grid},horzLines:{color:c.grid}},
    rightPriceScale:{borderColor:c.border,scaleMargins:{top:.12,bottom:.12}},
    timeScale:{visible:false,borderColor:c.border,timeVisible:true},
    crosshair:{mode:LWC.CrosshairMode.Normal},
    handleScroll:{mouseWheel:false,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
    handleScale:{axisPressedMouseMove:true,mouseWheel:false,pinch:false}
  });
  runtime.oscChart.timeScale().subscribeVisibleLogicalRangeChange(range=>{
    if(runtime.syncing||!runtime.mainChart||!range)return;
    runtime.syncing=true;try{runtime.mainChart.timeScale().setVisibleLogicalRange(range);}catch(_){}
    runtime.syncing=false;
  });
}
function priceDataForType(rows,type){
  if(type==='heikin'){
    let po=null,pc=null;
    return rows.map((c,i)=>{
      const close=(c.open+c.high+c.low+c.close)/4;
      const open=i===0?(c.open+c.close)/2:(po+pc)/2;
      const out={time:c.time,open,high:Math.max(c.high,open,close),low:Math.min(c.low,open,close),close};
      po=open;pc=close;return out;
    });
  }
  if(['line','area','baseline'].includes(type)) return rows.map(c=>({time:c.time,value:c.close}));
  return rows.map(c=>({time:c.time,open:c.open,high:c.high,low:c.low,close:c.close}));
}
function createPriceSeries(){
  if(runtime.priceSeries){try{runtime.mainChart.removeSeries(runtime.priceSeries);}catch(_){}}
  const type=runtime.chartType;
  if(type==='bars') runtime.priceSeries=runtime.mainChart.addSeries(LWC.BarSeries,{upColor:COLORS.green,downColor:COLORS.red,thinBars:true});
  else if(type==='line') runtime.priceSeries=runtime.mainChart.addSeries(LWC.LineSeries,{color:COLORS.blue,lineWidth:2});
  else if(type==='area') runtime.priceSeries=runtime.mainChart.addSeries(LWC.AreaSeries,{lineColor:COLORS.blue,topColor:'rgba(41,98,255,.35)',bottomColor:'rgba(41,98,255,.02)',lineWidth:2});
  else if(type==='baseline') runtime.priceSeries=runtime.mainChart.addSeries(LWC.BaselineSeries,{baseValue:{type:'price',price:0},topLineColor:COLORS.green,topFillColor1:'rgba(8,153,129,.28)',topFillColor2:'rgba(8,153,129,.02)',bottomLineColor:COLORS.red,bottomFillColor1:'rgba(242,54,69,.02)',bottomFillColor2:'rgba(242,54,69,.28)'});
  else runtime.priceSeries=runtime.mainChart.addSeries(LWC.CandlestickSeries,{upColor:COLORS.green,downColor:COLORS.red,borderVisible:false,wickUpColor:COLORS.green,wickDownColor:COLORS.red});
  const rows=runtime.candles.get(key())||[];
  runtime.priceSeries.setData(priceDataForType(rows,type));
  updateMarkers();drawAll();
}
function applyTheme(){
  document.body.dataset.theme=store.ui.theme;
  const c=chartColors();
  runtime.mainChart?.applyOptions({layout:{background:{type:'solid',color:c.background},textColor:c.text},grid:{vertLines:{color:c.grid},horzLines:{color:c.grid}},rightPriceScale:{borderColor:c.border},leftPriceScale:{borderColor:c.border},timeScale:{borderColor:c.border}});
  runtime.oscChart?.applyOptions({layout:{background:{type:'solid',color:c.background},textColor:c.text},grid:{vertLines:{color:c.grid},horzLines:{color:c.grid}},rightPriceScale:{borderColor:c.border}});
  drawAll();
}
function applyScaleMode(){
  const M=LWC.PriceScaleMode||{};
  const map={normal:M.Normal??0,log:M.Logarithmic??1,percent:M.Percentage??2,indexed:M.IndexedTo100??3};
  runtime.mainChart.priceScale('right').applyOptions({mode:map[store.ui.scaleMode]});
}
function chartRows(){return runtime.candles.get(key())||[];}
function botRows(symbol){return runtime.botCandles[symbol]||[];}
function nearestIndex(rows,time){
  let lo=0,hi=rows.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid].time<time)lo=mid+1;else hi=mid;}
  if(lo<=0)return 0;if(lo>=rows.length)return rows.length-1;
  return Math.abs(rows[lo].time-time)<Math.abs(rows[lo-1].time-time)?lo:lo-1;
}
async function fetchKlines(symbol,interval,limit=1500){
  const url=`${REST}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${symbol} ${interval}: HTTP ${r.status}`);
  const data=await r.json();
  return data.map(x=>({time:Math.floor(x[0]/1000),open:num(x[1]),high:num(x[2]),low:num(x[3]),close:num(x[4]),volume:num(x[5])}));
}
async function ensureData(symbol,interval,force=false){
  const k=symbol+'|'+interval;
  if(!force&&runtime.candles.has(k))return runtime.candles.get(k);
  if(runtime.loading.has(k))return;
  runtime.loading.add(k);
  try{
    const rows=await fetchKlines(symbol,interval);
    runtime.candles.set(k,rows);
    if(interval==='15m')runtime.botCandles[symbol]=rows.map(x=>({...x}));
    return rows;
  }finally{runtime.loading.delete(k);}
}
async function loadCurrent(fit=true){
  els.loading.classList.remove('hidden');els.loading.textContent=`Загрузка ${runtime.symbol} ${runtime.interval}…`;
  try{
    await ensureData(runtime.symbol,runtime.interval);
    if(runtime.interval!=='15m')await ensureData(runtime.symbol,'15m');
    runtime.priceSeries.setData(priceDataForType(chartRows(),runtime.chartType));
    await updateCompare();
    updateIndicators();
    updateMarkers();
    els.watermark.textContent=runtime.symbol+' · '+runtime.interval;
    if(fit)runtime.mainChart.timeScale().fitContent();
    updateDataWindow(chartRows().at(-1));
  }catch(e){console.error(e);toast('Ошибка данных: '+e.message,'error');}
  finally{els.loading.classList.add('hidden');}
}
async function bootstrap(){
  setConnection('Загрузка данных…','warn');
  try{
    await Promise.all(SYMBOLS.map(s=>ensureData(s,'15m')));
    await ensureData(runtime.symbol,runtime.interval);
    scanRecentPatterns();
    await loadCurrent();
    connectWs();
  }catch(e){console.error(e);setConnection('Ошибка загрузки: '+e.message,'error');connectWs();}
}
function updateCandleMap(symbol,interval,c){
  const k=symbol+'|'+interval,rows=runtime.candles.get(k)||[];
  if(rows.length&&rows.at(-1).time===c.time)rows[rows.length-1]=c;
  else{rows.push(c);if(rows.length>5000)rows.splice(0,rows.length-5000);}
  runtime.candles.set(k,rows);
  if(interval==='15m')runtime.botCandles[symbol]=rows;
  if(symbol===runtime.symbol&&interval===runtime.interval&&!runtime.replay.active){
    runtime.priceSeries.update(runtime.chartType==='heikin'?priceDataForType(rows,runtime.chartType).at(-1):priceDataForType([c],runtime.chartType)[0]);
    updateIndicators(true);drawAll();
  }
}
function connectWs(){
  clearTimeout(runtime.reconnect);
  try{runtime.ws?.close();}catch(_){}
  const streams=[];
  for(const s of SYMBOLS){
    const x=s.toLowerCase();streams.push(`${x}@bookTicker`,`${x}@kline_15m`);
    if(runtime.interval!=='15m')streams.push(`${x}@kline_${runtime.interval}`);
  }
  const ws=new WebSocket(WS_BASE+streams.join('/'));runtime.ws=ws;runtime.wsAttempt++;
  setConnection('Подключение к Binance…','warn');
  ws.onopen=()=>setConnection('Онлайн · Binance USD-M Futures','ok');
  ws.onerror=()=>setConnection('Ошибка WebSocket','error');
  ws.onclose=()=>{setConnection('Переподключение…','warn');runtime.reconnect=setTimeout(connectWs,3000);};
  ws.onmessage=e=>{
    try{
      const p=JSON.parse(e.data),d=p.data||p,s=d.s;if(!SYMBOLS.includes(s))return;
      if(d.e==='bookTicker'){
        processQuote(s,num(d.b),num(d.a));
      }else if(d.e==='kline'){
        const k=d.k,interval=k.i,c={time:Math.floor(k.t/1000),open:num(k.o),high:num(k.h),low:num(k.l),close:num(k.c),volume:num(k.v)};
        updateCandleMap(s,interval,c);
        if(interval==='15m'&&k.x){detectLatestPattern(s);processBotQuote(s);}
      }
    }catch(err){console.error(err);}
  };
}
function setConnection(text,type){
  els.connectionText.textContent=text;els.connectionDot.className='dot '+type;
}
function processQuote(symbol,bid,ask){
  const q=runtime.quotes[symbol],prev=q.last;
  q.bid=bid;q.ask=ask;q.last=(bid+ask)/2;q.updated=Date.now();
  if(prev&&q.open24==null)q.open24=prev;
  if(q.open24)q.change24=q.last/q.open24-1;
  processAlerts(symbol,q.last,prev);
  processBotQuote(symbol);
  renderWatchlist();renderPaperHeader();renderTicker();
}
function renderTicker(){
  const q=runtime.quotes[runtime.symbol];
  els.tickerText.textContent=q.last?`${runtime.symbol} ${price(q.last)}  ${q.change24==null?'':(q.change24>=0?'+':'')+(q.change24*100).toFixed(2)+'%'}`:'—';
}
function renderWatchlist(){
  els.watchlist.innerHTML=SYMBOLS.map(s=>{
    const q=runtime.quotes[s],chg=q.change24;
    return `<div class="watch-row ${s===runtime.symbol?'active':''}" data-symbol="${s}">
      <div><b>${s.replace('USDT','')}</b><small>Binance Perp</small></div>
      <b>${price(q.last,s)}</b><b class="${chg==null?'':chg>=0?'up':'down'}">${chg==null?'—':(chg>=0?'+':'')+(chg*100).toFixed(2)+'%'}</b>
    </div>`;
  }).join('');
}
function onCrosshair(param){
  if(!param?.time||!runtime.priceSeries)return;
  const rows=chartRows();if(!rows.length)return;
  const t=typeof param.time==='number'?param.time:Math.floor(Date.UTC(param.time.year,param.time.month-1,param.time.day)/1000);
  const row=rows[nearestIndex(rows,t)];runtime.lastCrosshair=row;
  updateDataWindow(row);
}
function updateDataWindow(c){
  if(!c)return;const rows=chartRows(),i=rows.findIndex(x=>x.time===c.time),a=atrValue(rows,i,14),chg=c.open?c.close/c.open-1:0;
  els.ohlc.innerHTML=`O <b>${price(c.open)}</b> H <b>${price(c.high)}</b> L <b>${price(c.low)}</b> C <b class="${c.close>=c.open?'up':'down'}">${price(c.close)}</b> <span>${(chg*100).toFixed(2)}%</span>`;
  els.dwTime.textContent=fmtTime(c.time);els.dwOpen.textContent=price(c.open);els.dwHigh.textContent=price(c.high);
  els.dwLow.textContent=price(c.low);els.dwClose.textContent=price(c.close);els.dwVolume.textContent=Math.round(c.volume).toLocaleString('en-US');
  els.dwAtr.textContent=a?price(a):'—';els.dwChange.textContent=(chg>=0?'+':'')+(chg*100).toFixed(2)+'%';
}
function zoom(factor){
  const ts=runtime.mainChart.timeScale(),r=ts.getVisibleLogicalRange();if(!r)return;
  const mid=(r.from+r.to)/2,half=(r.to-r.from)*factor/2;ts.setVisibleLogicalRange({from:mid-half,to:mid+half});
}
function setRange(range){
  const rows=chartRows();if(!rows.length)return;const end=rows.at(-1).time;let start=rows[0].time;
  const day=86400,now=new Date(end*1000);
  if(range==='1D')start=end-day;else if(range==='5D')start=end-5*day;else if(range==='1M')start=end-30*day;
  else if(range==='3M')start=end-90*day;else if(range==='6M')start=end-180*day;else if(range==='1Y')start=end-365*day;
  else if(range==='YTD')start=Date.UTC(now.getUTCFullYear(),0,1)/1000;
  runtime.mainChart.timeScale().setVisibleRange({from:start,to:end});
}

/* Indicators */
function sma(rows,period){
  let sum=0;const out=[];
  for(let i=0;i<rows.length;i++){sum+=rows[i].close;if(i>=period)sum-=rows[i-period].close;if(i>=period-1)out.push({time:rows[i].time,value:sum/period});}
  return out;
}
function ema(rows,period){
  if(!rows.length)return[];const k=2/(period+1),out=[];let v=rows[0].close;
  for(let i=0;i<rows.length;i++){v=i?rows[i].close*k+v*(1-k):v;if(i>=period-1)out.push({time:rows[i].time,value:v});}
  return out;
}
function stdWindow(rows,period){
  const out=[];
  for(let i=period-1;i<rows.length;i++){const a=rows.slice(i-period+1,i+1).map(x=>x.close),m=a.reduce((x,y)=>x+y,0)/period,s=Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/period);out.push({time:rows[i].time,m,sd:s});}
  return out;
}
function vwap(rows){
  let pv=0,v=0;return rows.map(c=>{const tp=(c.high+c.low+c.close)/3;pv+=tp*c.volume;v+=c.volume;return{time:c.time,value:v?pv/v:tp};});
}
function rsi(rows,period=14){
  const out=[];let ag=0,al=0;
  for(let i=1;i<rows.length;i++){const d=rows[i].close-rows[i-1].close,g=Math.max(d,0),l=Math.max(-d,0);
    if(i<=period){ag+=g;al+=l;if(i===period){ag/=period;al/=period;out.push({time:rows[i].time,value:al===0?100:100-100/(1+ag/al)});}}
    else{ag=(ag*(period-1)+g)/period;al=(al*(period-1)+l)/period;out.push({time:rows[i].time,value:al===0?100:100-100/(1+ag/al)});}
  }return out;
}
function macd(rows){
  const fast=emaFull(rows,12),slow=emaFull(rows,26);const line=rows.map((c,i)=>({time:c.time,value:fast[i]-slow[i]}));
  const sig=emaValues(line.map(x=>x.value),9);return line.map((x,i)=>({time:x.time,macd:x.value,signal:sig[i],hist:x.value-sig[i]})).slice(25);
}
function emaFull(rows,p){return emaValues(rows.map(x=>x.close),p);}
function emaValues(vals,p){if(!vals.length)return[];const k=2/(p+1),o=[];let v=vals[0];for(let i=0;i<vals.length;i++){v=i?vals[i]*k+v*(1-k):v;o.push(v);}return o;}
function atrValue(rows,index,period=14){
  if(index<period||index>=rows.length)return null;let sum=0;
  for(let i=index-period+1;i<=index;i++){const prev=rows[i-1].close,c=rows[i];sum+=Math.max(c.high-c.low,Math.abs(c.high-prev),Math.abs(c.low-prev));}
  return sum/period;
}
function atrSeries(rows,period=14){
  const out=[];for(let i=period;i<rows.length;i++)out.push({time:rows[i].time,value:atrValue(rows,i,period)});return out;
}
function clearIndicatorSeries(){
  for(const s of runtime.indicatorSeries){try{runtime.mainChart.removeSeries(s);}catch(_){}}
  runtime.indicatorSeries=[];if(runtime.volumeSeries){try{runtime.mainChart.removeSeries(runtime.volumeSeries);}catch(_){}runtime.volumeSeries=null;}
  for(const s of runtime.oscSeries){try{runtime.oscChart.removeSeries(s);}catch(_){}}
  runtime.oscSeries=[];
}
function updateIndicators(){
  if(!runtime.mainChart||!runtime.oscChart)return;const rows=chartRows();clearIndicatorSeries();if(!rows.length)return;
  const ind=store.ui.indicators,add=(data,color,width=1)=>{
    const s=runtime.mainChart.addSeries(LWC.LineSeries,{color,lineWidth:width,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});s.setData(data);runtime.indicatorSeries.push(s);return s;
  };
  if(ind.sma20)add(sma(rows,20),'#f6c344',2);
  if(ind.ema20)add(ema(rows,20),'#42a5f5',2);
  if(ind.ema50)add(ema(rows,50),'#9c6ade',2);
  if(ind.bollinger){const b=stdWindow(rows,20);add(b.map(x=>({time:x.time,value:x.m+2*x.sd})),'#8b93a4');add(b.map(x=>({time:x.time,value:x.m})),'#607d8b');add(b.map(x=>({time:x.time,value:x.m-2*x.sd})),'#8b93a4');}
  if(ind.vwap)add(vwap(rows),'#ff7043',2);
  if(ind.volume){
    runtime.volumeSeries=runtime.mainChart.addSeries(LWC.HistogramSeries,{priceScaleId:'volume',priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false});
    runtime.mainChart.priceScale('volume').applyOptions({scaleMargins:{top:.78,bottom:0}});
    runtime.volumeSeries.setData(rows.map(c=>({time:c.time,value:c.volume,color:c.close>=c.open?'rgba(8,153,129,.45)':'rgba(242,54,69,.45)'})));
  }
  const lower=store.ui.lowerIndicator;
  if(!lower){els.indicatorPane.classList.add('hidden');return;}
  els.indicatorPane.classList.remove('hidden');
  if(lower==='rsi'){
    els.paneTitle.textContent='RSI 14';const s=runtime.oscChart.addSeries(LWC.LineSeries,{color:'#9c6ade',lineWidth:2});s.setData(rsi(rows));runtime.oscSeries.push(s);
    const hi=runtime.oscChart.addSeries(LWC.LineSeries,{color:'#8b93a4',lineStyle:LWC.LineStyle.Dashed,lastValueVisible:false,priceLineVisible:false});hi.setData(rows.map(c=>({time:c.time,value:70})));runtime.oscSeries.push(hi);
    const lo=runtime.oscChart.addSeries(LWC.LineSeries,{color:'#8b93a4',lineStyle:LWC.LineStyle.Dashed,lastValueVisible:false,priceLineVisible:false});lo.setData(rows.map(c=>({time:c.time,value:30})));runtime.oscSeries.push(lo);
  }else if(lower==='macd'){
    els.paneTitle.textContent='MACD 12 26 9';const m=macd(rows);
    const a=runtime.oscChart.addSeries(LWC.LineSeries,{color:'#42a5f5',lineWidth:2});a.setData(m.map(x=>({time:x.time,value:x.macd})));runtime.oscSeries.push(a);
    const b=runtime.oscChart.addSeries(LWC.LineSeries,{color:'#ff9800',lineWidth:1});b.setData(m.map(x=>({time:x.time,value:x.signal})));runtime.oscSeries.push(b);
    const h=runtime.oscChart.addSeries(LWC.HistogramSeries,{priceLineVisible:false,lastValueVisible:false});h.setData(m.map(x=>({time:x.time,value:x.hist,color:x.hist>=0?'rgba(8,153,129,.65)':'rgba(242,54,69,.65)'})));runtime.oscSeries.push(h);
  }else if(lower==='atr'){
    els.paneTitle.textContent='ATR 14';const s=runtime.oscChart.addSeries(LWC.LineSeries,{color:'#ff9800',lineWidth:2});s.setData(atrSeries(rows));runtime.oscSeries.push(s);
  }
  const r=runtime.mainChart.timeScale().getVisibleLogicalRange();if(r)runtime.oscChart.timeScale().setVisibleLogicalRange(r);
}
async function updateCompare(){
  if(runtime.compareSeries){try{runtime.mainChart.removeSeries(runtime.compareSeries);}catch(_){}runtime.compareSeries=null;}
  const s=store.ui.compare;if(!s||s===runtime.symbol){runtime.mainChart.priceScale('left').applyOptions({visible:false});return;}
  await ensureData(s,runtime.interval);
  runtime.mainChart.priceScale('left').applyOptions({visible:true,mode:LWC.PriceScaleMode.Percentage});
  runtime.compareSeries=runtime.mainChart.addSeries(LWC.LineSeries,{priceScaleId:'left',color:'#ff9800',lineWidth:2,priceLineVisible:false,title:s});
  runtime.compareSeries.setData((runtime.candles.get(s+'|'+runtime.interval)||[]).map(c=>({time:c.time,value:c.close})));
}

/* Drawings */
function drawingsKey(){return key();}
function drawingStore(){if(!store.ui.drawings[drawingsKey()])store.ui.drawings[drawingsKey()]=[];return store.ui.drawings[drawingsKey()];}
function snapshotDrawings(){runtime.undo.push(JSON.stringify(drawingStore()));if(runtime.undo.length>60)runtime.undo.shift();runtime.redo=[];}
function restoreDrawings(serialized){store.ui.drawings[drawingsKey()]=JSON.parse(serialized);save();drawAll();renderObjects();}
function resizeCanvas(){
  const r=els.drawingCanvas.getBoundingClientRect();runtime.dpr=window.devicePixelRatio||1;
  els.drawingCanvas.width=Math.max(1,Math.floor(r.width*runtime.dpr));els.drawingCanvas.height=Math.max(1,Math.floor(r.height*runtime.dpr));
  els.drawingCanvas.getContext('2d').setTransform(runtime.dpr,0,0,runtime.dpr,0,0);
}
function eventPoint(e){
  const r=els.drawingCanvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  let time=runtime.mainChart.timeScale().coordinateToTime(x),pr=runtime.priceSeries.coordinateToPrice(y);
  if(time==null||pr==null)return null;
  if(typeof time!=='number')time=Math.floor(Date.UTC(time.year,time.month-1,time.day)/1000);
  let p={time,price:num(pr)};
  if(store.ui.magnet){
    const rows=chartRows(),i=nearestIndex(rows,p.time),c=rows[i];
    if(c){p.time=c.time;const vals=[c.open,c.high,c.low,c.close],near=vals.sort((a,b)=>Math.abs(a-p.price)-Math.abs(b-p.price))[0];p.price=near;}
  }
  return p;
}
function coord(p){return{x:runtime.mainChart.timeScale().timeToCoordinate(p.time),y:runtime.priceSeries.priceToCoordinate(p.price)};}
function line(ctx,a,b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
function label(ctx,text,x,y,color='#dfe3eb'){
  ctx.save();ctx.font='12px system-ui';const w=ctx.measureText(text).width+10;ctx.fillStyle='rgba(17,21,29,.92)';ctx.fillRect(x,y-17,w,20);ctx.fillStyle=color;ctx.fillText(text,x+5,y-3);ctx.restore();
}
function drawShape(ctx,d,preview=false){
  if(d.hidden||store.ui.drawingsHidden)return;
  const a=coord(d.p1),b=d.p2?coord(d.p2):null;if(a.x==null||a.y==null)return;
  ctx.save();ctx.lineWidth=d.width||2;ctx.strokeStyle=preview?COLORS.orange:(d.color||COLORS.blue);ctx.fillStyle=d.fill||'rgba(41,98,255,.10)';ctx.setLineDash(preview?[6,4]:(d.dash||[]));
  const w=els.drawingCanvas.clientWidth,h=els.drawingCanvas.clientHeight;
  if(d.type==='horizontal'){line(ctx,{x:0,y:a.y},{x:w,y:a.y});label(ctx,price(d.p1.price),Math.max(0,w-82),a.y,d.color||COLORS.blue);}
  else if(d.type==='vertical'){line(ctx,{x:a.x,y:0},{x:a.x,y:h});label(ctx,fmtTime(d.p1.time),Math.max(0,a.x-65),20,d.color||COLORS.blue);}
  else if(d.type==='text'){ctx.fillStyle=d.color||COLORS.blue;ctx.font=(d.fontSize||14)+'px system-ui';ctx.fillText(d.text||'Текст',a.x,a.y);}
  else if(b&&b.x!=null&&b.y!=null){
    if(d.type==='trend')line(ctx,a,b);
    else if(d.type==='ray'){const dx=b.x-a.x,dy=b.y-a.y,t=dx===0?0:(w-a.x)/dx;line(ctx,a,{x:w,y:a.y+dy*t});}
    else if(d.type==='rect'){ctx.beginPath();ctx.rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y));ctx.fill();ctx.stroke();}
    else if(d.type==='channel'){
      const off=(d.offsetPct||1)/100*((d.p1.price+d.p2.price)/2),a2=coord({time:d.p1.time,price:d.p1.price+off}),b2=coord({time:d.p2.time,price:d.p2.price+off});
      line(ctx,a,b);line(ctx,a2,b2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(b2.x,b2.y);ctx.lineTo(a2.x,a2.y);ctx.closePath();ctx.fill();
    }else if(d.type==='fib'){
      const lv=[0,.236,.382,.5,.618,.786,1];for(const f of lv){const y=a.y+(b.y-a.y)*f;line(ctx,{x:Math.min(a.x,b.x),y},{x:Math.max(a.x,b.x),y});label(ctx,String(f),Math.min(a.x,b.x),y,d.color||COLORS.blue);}
    }else if(d.type==='measure'){
      ctx.beginPath();ctx.rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y));ctx.stroke();
      const pct=(d.p2.price/d.p1.price-1)*100,bars=Math.round(Math.abs(d.p2.time-d.p1.time)/(intervalSeconds(runtime.interval)||60));
      label(ctx,`${pct>=0?'+':''}${pct.toFixed(2)}% · ${bars} бар.`,Math.min(a.x,b.x),Math.min(a.y,b.y),pct>=0?COLORS.green:COLORS.red);
    }else if(d.type==='longPosition'){
      const entry=d.p1.price,target=d.p2.price,stop=d.stopPrice??entry-(target-entry)/2,sc=coord({time:d.p2.time,price:stop});
      ctx.fillStyle='rgba(8,153,129,.18)';ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y));
      ctx.strokeStyle=COLORS.green;line(ctx,{x:Math.min(a.x,b.x),y:b.y},{x:Math.max(a.x,b.x),y:b.y});
      ctx.fillStyle='rgba(242,54,69,.18)';ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,sc.y),Math.abs(b.x-a.x),Math.abs(sc.y-a.y));
      ctx.strokeStyle=COLORS.red;line(ctx,{x:Math.min(a.x,b.x),y:sc.y},{x:Math.max(a.x,b.x),y:sc.y});
      const rr=Math.abs((target-entry)/(entry-stop));label(ctx,`Long · R:R ${rr.toFixed(2)}`,Math.min(a.x,b.x),a.y,COLORS.green);
    }
  }
  if(runtime.selectedDrawing===d.id){ctx.strokeStyle=COLORS.orange;ctx.setLineDash([3,3]);ctx.strokeRect(a.x-4,a.y-4,8,8);if(b)ctx.strokeRect(b.x-4,b.y-4,8,8);}
  ctx.restore();
}
function drawAll(){
  if(!runtime.mainChart)return;resizeCanvas();const ctx=els.drawingCanvas.getContext('2d');ctx.clearRect(0,0,els.drawingCanvas.clientWidth,els.drawingCanvas.clientHeight);
  for(const d of drawingStore())drawShape(ctx,d);if(runtime.drawingPreview)drawShape(ctx,runtime.drawingPreview,true);
}
function setTool(tool){
  runtime.tool=tool;runtime.drawingStart=null;runtime.drawingPreview=null;
  els.leftbar.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  els.drawingCanvas.classList.toggle('drawing',tool!=='cursor'&&tool!=='crosshair'&&!store.ui.drawingsLocked);
  if(tool==='crosshair')runtime.mainChart.applyOptions({crosshair:{mode:LWC.CrosshairMode.Normal}});
  drawAll();
}
function addDrawing(d){
  snapshotDrawings();d.id='D'+Date.now()+Math.random().toString(16).slice(2,6);drawingStore().push(d);save();renderObjects();drawAll();
}
function drawingDown(e){
  if(['cursor','crosshair'].includes(runtime.tool)||store.ui.drawingsLocked)return;
  const p=eventPoint(e);if(!p)return;
  if(runtime.tool==='horizontal'||runtime.tool==='vertical'){addDrawing({type:runtime.tool,p1:p,color:COLORS.blue});return;}
  if(runtime.tool==='text'){const text=prompt('Текст на графике:');if(text)addDrawing({type:'text',p1:p,text,color:COLORS.blue,fontSize:14});return;}
  runtime.drawingStart=p;runtime.drawingPreview={type:runtime.tool,p1:p,p2:p,color:COLORS.blue};els.drawingCanvas.setPointerCapture(e.pointerId);
}
function drawingMove(e){
  if(!runtime.drawingStart)return;const p=eventPoint(e);if(!p)return;
  runtime.drawingPreview={type:runtime.tool,p1:runtime.drawingStart,p2:p,color:COLORS.blue};drawAll();
}
function drawingUp(e){
  if(!runtime.drawingStart)return;const p=eventPoint(e);
  if(p)addDrawing({type:runtime.tool,p1:runtime.drawingStart,p2:p,color:COLORS.blue});
  runtime.drawingStart=null;runtime.drawingPreview=null;try{els.drawingCanvas.releasePointerCapture(e.pointerId);}catch(_){}
  drawAll();
}
function renderObjects(){
  const rows=drawingStore();
  els.objectsList.innerHTML=rows.length?rows.map(d=>`<div class="object-row ${runtime.selectedDrawing===d.id?'active':''}" data-id="${esc(d.id)}">
    <span>${esc(d.type)} <small>${d.locked?'🔒':''}</small></span>
    <button data-action="toggle">${d.hidden?'○':'◉'}</button><button data-action="remove">×</button>
  </div>`).join(''):'<div class="card muted">Объектов нет.</div>';
}

/* Alerts */
function renderAlerts(){
  const a=store.ui.alerts;
  els.alertsList.innerHTML=a.length?a.map(x=>`<div class="alert-row"><span><b>${esc(x.symbol)}</b><small>${x.direction==='above'?'выше':'ниже'} ${price(x.price,x.symbol)} ${esc(x.note||'')}</small></span><button data-alert-toggle="${x.id}">${x.active?'●':'○'}</button><button data-alert-delete="${x.id}">×</button></div>`).join(''):'<div class="card muted">Алертов нет.</div>';
}
function processAlerts(symbol,current,previous){
  if(previous==null)return;
  let changed=false;
  for(const a of store.ui.alerts){
    if(!a.active||a.symbol!==symbol)continue;
    const hit=a.direction==='above'?(previous<a.price&&current>=a.price):(previous>a.price&&current<=a.price);
    if(hit){a.active=false;a.triggeredAt=nowIso();changed=true;toast(`Алерт ${symbol}: ${a.direction==='above'?'выше':'ниже'} ${price(a.price,symbol)}`,'alert');beep();if('Notification' in window&&Notification.permission==='granted')new Notification('Galka Alert',{body:`${symbol} ${a.direction==='above'?'выше':'ниже'} ${price(a.price,symbol)}`});}
  }
  if(changed){save();renderAlerts();}
}
function beep(){
  try{const ac=new (window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.frequency.value=880;g.gain.value=.08;o.start();o.stop(ac.currentTime+.15);}catch(_){}
}

/* Galka paper bot */
function atrAt(rows,index,period=14){return atrValue(rows,index,period);}
function evaluatePattern(rows,index,symbol){
  const L=4,R=4;if(index<L||index+R>=rows.length)return null;const cur=rows[index],w=rows.slice(index-L,index+R+1);
  if(cur.low!==Math.min(...w.map(x=>x.low)))return null;const a=atrAt(rows,index);if(!a)return null;
  const left=Math.max(...rows.slice(index-L,index).map(x=>x.high)),right=Math.max(...rows.slice(index+1,index+R+1).map(x=>x.high)),drop=left-cur.low,recovery=(right-cur.low)/Math.max(drop,1e-12);
  if(drop<1.5*a||recovery<.65)return null;
  return{patternId:`${symbol}-${cur.time}`,vLow:cur.low,vLowTime:cur.time,confirmedTime:rows[index+R].time,atr:a,dropAtr:drop/a,recovery,status:'watching',createdAt:nowIso()};
}
function scanRecentPatterns(){
  for(const s of SYMBOLS){
    const rows=botRows(s);let found=null;
    for(let i=Math.max(14,rows.length-350);i<rows.length-4;i++){const p=evaluatePattern(rows,i,s);if(p)found=p;}
    if(found&&(Date.now()/1000-found.confirmedTime)/3600<=336)store.paper.symbols[s].pattern=found;
  }save();renderPaper();
}
function detectLatestPattern(symbol){
  const rows=botRows(symbol),i=rows.length-5,p=evaluatePattern(rows,i,symbol);if(!p)return;
  const ss=store.paper.symbols[symbol];if(ss.pattern?.patternId!==p.patternId){ss.pattern=p;save();renderPaper();updateMarkers();}
}
function createCampaign(symbol,p){
  const st=store.paper.settings,maxNotional=st.symbolNotional;
  return{campaignId:`C-${symbol}-${Date.now()}`,symbol,patternId:p.patternId,status:'waiting',vLow:p.vLow,target:p.vLow,createdAt:nowIso(),expiresAt:Date.now()+st.maxHours*3600000,
    exitMode:st.exitMode||'trail',reclaimPrice:p.vLow*(1+num(st.reclaimBufferPct,.10)/100),trailArmed:false,trailHigh:null,trailStop:null,trailActivatedAt:null,
    levels:DEPTHS.map((d,i)=>({index:i+1,depthPct:d,weight:WEIGHTS[i],price:p.vLow*(1-d/100),notional:maxNotional*WEIGHTS[i],status:'pending',fillPrice:null,fillTime:null,qty:0,fee:0})),
    qty:0,filledNotional:0,averageEntry:null,entryFees:0,unrealizedPnl:0};
}
function recalcCampaign(c){
  const f=c.levels.filter(x=>x.status==='filled');c.qty=f.reduce((a,x)=>a+x.qty,0);c.filledNotional=f.reduce((a,x)=>a+x.fillPrice*x.qty,0);c.averageEntry=c.qty?c.filledNotional/c.qty:null;c.entryFees=f.reduce((a,x)=>a+x.fee,0);
}
function closeCampaign(symbol,rawExit,reason){
  const ss=store.paper.symbols[symbol],c=ss.campaign;if(!c?.qty)return;
  const st=store.paper.settings,exit=reason==='v_low_target'?rawExit:rawExit*(1-st.slippage),exitNotional=c.qty*exit,exitFee=exitNotional*(reason==='v_low_target'?st.makerFee:st.takerFee),gross=c.qty*(exit-c.averageEntry),net=gross-c.entryFees-exitFee;
  const trade={tradeId:'P'+String(store.paper.trades.length+1).padStart(6,'0'),campaignId:c.campaignId,patternId:c.patternId,symbol,side:'long',entryTime:c.levels.find(x=>x.status==='filled')?.fillTime||c.createdAt,exitTime:nowIso(),averageEntry:c.averageEntry,exitPrice:exit,qty:c.qty,filledNotional:c.filledNotional,levelsFilled:c.levels.filter(x=>x.status==='filled').length,grossPnl:gross,fees:c.entryFees+exitFee,netPnl:net,reason,vLow:c.vLow,exitMode:c.exitMode||'target',trailActivatedAt:c.trailActivatedAt||null,trailHigh:c.trailHigh||null,trailStop:c.trailStop||null};
  store.paper.trades.push(trade);store.paper.realizedPnl+=net;store.paper.fees+=trade.fees;ss.campaign=null;if(ss.pattern?.patternId===c.patternId)ss.pattern.status=reason;
  save();renderPaper();updateMarkers();
}
function accountSnapshot(){
  let unreal=0,notional=0,maintenance=0;
  for(const s of SYMBOLS){const c=store.paper.symbols[s].campaign,q=runtime.quotes[s];if(c?.qty&&q.bid){const gross=c.qty*(q.bid-c.averageEntry);c.unrealizedPnl=gross-c.entryFees;unreal+=c.unrealizedPnl;notional+=c.filledNotional;maintenance+=c.filledNotional*store.paper.settings.maintenanceMargin;}}
  return{unreal,notional,maintenance,equity:store.paper.settings.startingBalance+store.paper.realizedPnl+unreal,margin:notional/store.paper.settings.leverage};
}
function checkGlobalLiquidation(){
  const snap=accountSnapshot();if(!snap.notional||snap.equity>snap.maintenance)return;
  for(const s of SYMBOLS){const c=store.paper.symbols[s].campaign,q=runtime.quotes[s];if(c?.qty&&q.bid)closeCampaign(s,q.bid,'paper_liquidation');}
}
function processBotQuote(symbol){
  const q=runtime.quotes[symbol];if(!q.bid||!q.ask)return;
  const ss=store.paper.symbols[symbol],p=ss.pattern;let changed=false;
  if(!ss.campaign&&p&&p.status==='watching'){
    const age=(Date.now()/1000-p.confirmedTime)/3600;
    if(age<=336&&q.bid<p.vLow-.10*p.atr){ss.campaign=createCampaign(symbol,p);p.status='trading';changed=true;}
  }
  const c=ss.campaign;
  if(c&&['waiting','open','trailing'].includes(c.status)){
    if(!c.trailArmed)for(const l of c.levels)if(l.status==='pending'&&q.ask<=l.price){
      l.status='filled';l.fillPrice=l.price;l.fillTime=nowIso();l.qty=l.notional/l.fillPrice;l.fee=l.notional*store.paper.settings.makerFee;c.status='open';changed=true;
    }
    recalcCampaign(c);
    if(c.qty){
      const st=store.paper.settings,mode=c.exitMode||st.exitMode||'trail';
      if(mode==='target'){
        if(q.bid>=c.target){closeCampaign(symbol,c.target,'v_low_target');return;}
      }else{
        const reclaimPrice=c.reclaimPrice||c.vLow*(1+num(st.reclaimBufferPct,.10)/100);
        if(!c.trailArmed&&q.bid>=reclaimPrice){
          c.trailArmed=true;c.status='trailing';c.trailHigh=q.bid;c.trailStop=c.vLow;c.trailActivatedAt=nowIso();
          c.expiresAt=Date.now()+st.maxHours*3600000;changed=true;toast(`${symbol}: trailing активирован, стоп ${price(c.trailStop,symbol)}`,'alert');
        }
        if(c.trailArmed){
          const oldHigh=num(c.trailHigh,q.bid),newHigh=Math.max(oldHigh,q.bid);
          if(newHigh>oldHigh){c.trailHigh=newHigh;changed=true;}
          const distance=clamp(num(st.trailDistancePct,.75),.05,10)/100;
          const nextStop=Math.max(c.vLow,newHigh*(1-distance));
          if(nextStop>num(c.trailStop,c.vLow)){c.trailStop=nextStop;changed=true;}
          if(q.bid<=c.trailStop){closeCampaign(symbol,q.bid,'reclaim_trailing_stop');return;}
        }
      }
    }
    if(Date.now()>=c.expiresAt){if(c.qty)closeCampaign(symbol,q.bid,'time_exit');else{ss.campaign=null;p.status='expired';changed=true;}}
  }
  if(changed){save();renderPaper();updateMarkers();}
  checkGlobalLiquidation();
}
function renderPaperHeader(){
  const s=accountSnapshot();els.equity.textContent=money(s.equity);els.openPnl.textContent=signedMoney(s.unreal);els.openPnl.className=s.unreal>=0?'up':'down';els.realizedPnl.textContent=signedMoney(store.paper.realizedPnl);els.realizedPnl.className=store.paper.realizedPnl>=0?'up':'down';els.marginUsed.textContent=money(s.margin);
}
function renderPaper(){
  renderPaperHeader();const symbol=runtime.symbol,ss=store.paper.symbols[symbol],p=ss.pattern,c=ss.campaign;
  els.botTitle.textContent=`Galka bot · ${symbol.replace('USDT','')}`;els.botState.textContent=c?(c.status==='trailing'?'Трейлинг':c.status==='open'?'Позиция':'Лимитки'):p?'Галка найдена':'Ожидание';
  if(c){
    const trail=c.trailArmed?`<div>Максимум: <b>${price(c.trailHigh)}</b></div><div>Trailing-stop: <b class="up">${price(c.trailStop)}</b></div>`:`<div>Активация trail: <b>${price(c.reclaimPrice||c.vLow)}</b></div>`;
    els.campaignCard.innerHTML=`<div><b>${esc(c.status.toUpperCase())}</b> · V-low ${price(c.vLow)}</div><div>Средний вход: <b>${price(c.averageEntry)}</b></div><div>Выход: <b>${c.exitMode==='target'?'V-low target':'Reclaim trail'}</b></div>${trail}<div>Номинал: <b>${money(c.filledNotional)}</b> · PnL <b class="${c.unrealizedPnl>=0?'up':'down'}">${signedMoney(c.unrealizedPnl)}</b></div>`;
    els.levelsList.innerHTML=c.levels.map(l=>`<div class="level-row ${l.status==='filled'?'filled':''}"><span class="level-index">${l.index}</span><span><b>${price(l.price)}</b><small>−${l.depthPct}% · ${money(l.notional)}</small></span><b>${l.status==='filled'?'FILLED':'WAIT'}</b></div>`).join('');
    els.fillsCount.textContent=c.levels.filter(x=>x.status==='filled').length+'/6';
  }else{
    els.campaignCard.innerHTML=p?`Последняя галка: V-low <b>${price(p.vLow)}</b><br>Drop ${p.dropAtr.toFixed(2)} ATR · recovery ${(p.recovery*100).toFixed(0)}%<br><span class="muted">${esc(p.status)}</span>`:'Активной кампании нет.';
    els.levelsList.innerHTML='';els.fillsCount.textContent='0/6';
  }
  els.tradeHistory.innerHTML=store.paper.trades.length?store.paper.trades.slice().reverse().slice(0,100).map(t=>`<div class="trade-item"><div><b>${esc(t.symbol)}</b><b class="${t.netPnl>=0?'up':'down'}">${signedMoney(t.netPnl)}</b></div><small>${fmtTime(Math.floor(Date.parse(t.exitTime)/1000))} · ${esc(t.reason)} · ${t.levelsFilled}/6</small></div>`).join(''):'<div class="muted">Сделок пока нет.</div>';
}
function updateMarkers(){
  if(!runtime.priceSeries)return;
  for(const line of runtime.paperLines){try{runtime.priceSeries.removePriceLine(line);}catch(_){}}runtime.paperLines=[];
  const addPaperLine=(value,color,title)=>{if(value>0)runtime.paperLines.push(runtime.priceSeries.createPriceLine({price:value,color,lineWidth:2,lineStyle:LWC.LineStyle.Dashed,axisLabelVisible:true,title}));};
  const markers=[],symbol=runtime.symbol,ss=store.paper.symbols[symbol],p=ss.pattern,c=ss.campaign;
  if(p)addPaperLine(p.vLow,COLORS.blue,'V-low');
  if(c?.trailArmed&&c.trailStop)addPaperLine(c.trailStop,COLORS.red,'TRAIL STOP');
  if(p)markers.push({time:p.vLowTime,position:'belowBar',color:COLORS.blue,shape:'circle',text:'V-low'});
  for(const t of store.paper.trades.filter(x=>x.symbol===symbol).slice(-100)){
    const a=Math.floor(Date.parse(t.entryTime)/1000),b=Math.floor(Date.parse(t.exitTime)/1000);
    if(a)markers.push({time:a,position:'belowBar',color:COLORS.green,shape:'arrowUp',text:'BUY'});
    if(b)markers.push({time:b,position:'aboveBar',color:t.netPnl>=0?COLORS.green:COLORS.red,shape:'square',text:signedMoney(t.netPnl)});
  }
  if(c)for(const l of c.levels.filter(x=>x.status==='filled')){const t=Math.floor(Date.parse(l.fillTime)/1000);markers.push({time:t,position:'belowBar',color:COLORS.green,shape:'arrowUp',text:'L'+l.index});}
  markers.sort((a,b)=>a.time-b.time);
  try{runtime.markerApi?.setMarkers([]);}catch(_){}
  runtime.markerApi=LWC.createSeriesMarkers(runtime.priceSeries,markers);
}

/* Replay */
function startReplay(){
  const rows=chartRows();if(rows.length<100)return;runtime.replay.active=true;runtime.replay.source=rows.map(x=>({...x}));runtime.replay.index=Math.max(50,Math.floor(rows.length*.7));
  els.replaySlider.min=50;els.replaySlider.max=rows.length-1;els.replaySlider.value=runtime.replay.index;els.replayPanel.classList.remove('hidden');applyReplay();
}
function applyReplay(){
  const r=runtime.replay;if(!r.active)return;const rows=r.source.slice(0,r.index+1);runtime.priceSeries.setData(priceDataForType(rows,runtime.chartType));els.replayLabel.textContent=fmtTime(rows.at(-1).time);els.replaySlider.value=r.index;runtime.mainChart.timeScale().scrollToRealTime();updateIndicatorsReplay(rows);
}
function updateIndicatorsReplay(rows){
  const original=runtime.candles.get(key());runtime.candles.set(key(),rows);updateIndicators();runtime.candles.set(key(),original);
}
function replayStep(delta=1){runtime.replay.index=clamp(runtime.replay.index+delta,50,runtime.replay.source.length-1);applyReplay();if(runtime.replay.index>=runtime.replay.source.length-1)pauseReplay();}
function playReplay(){if(runtime.replay.playing){pauseReplay();return;}runtime.replay.playing=true;els.replayPlay.textContent='Ⅱ';runtime.replay.timer=setInterval(()=>replayStep(1),350);}
function pauseReplay(){runtime.replay.playing=false;clearInterval(runtime.replay.timer);els.replayPlay.textContent='▶';}
function exitReplay(){pauseReplay();runtime.replay.active=false;runtime.replay.source=null;els.replayPanel.classList.add('hidden');runtime.priceSeries.setData(priceDataForType(chartRows(),runtime.chartType));updateIndicators();runtime.mainChart.timeScale().scrollToRealTime();}

/* Workspace, templates, screenshot */
function workspacePayload(){return{version:VERSION,createdAt:nowIso(),ui:store.ui};}
function renderTemplates(){
  const t=store.ui.templates;els.templatesList.innerHTML=Object.keys(t).length?Object.entries(t).map(([name])=>`<div class="template-item"><span>${esc(name)}</span><span><button data-template-load="${esc(name)}">Открыть</button><button data-template-delete="${esc(name)}">×</button></span></div>`).join(''):'<div class="card muted">Шаблонов нет.</div>';
}
async function takeSnapshot(){
  try{
    let canvas=runtime.mainChart.takeScreenshot?.();
    if(!canvas)throw new Error('takeScreenshot недоступен');
    const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const ctx=out.getContext('2d');ctx.drawImage(canvas,0,0);
    const overlay=els.drawingCanvas;ctx.drawImage(overlay,0,0,out.width,out.height);
    out.toBlob(b=>download(`galka-${runtime.symbol}-${runtime.interval}-${Date.now()}.png`,b),'image/png');
  }catch(e){toast('Снимок не создан: '+e.message,'error');}
}
function exportTradesCsv(){
  const cols=['tradeId','symbol','entryTime','exitTime','averageEntry','exitPrice','filledNotional','levelsFilled','fees','netPnl','reason'];
  const lines=[cols.join(','),...store.paper.trades.map(t=>cols.map(c=>csvEscape(t[c])).join(','))];
  download('galka-paper-trades.csv',new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}));
}

/* Rendering and UI */
function renderDiagnostics(){
  const s=accountSnapshot();
  els.diagnostics.textContent=JSON.stringify({version:VERSION,symbol:runtime.symbol,interval:runtime.interval,chartType:runtime.chartType,ws:runtime.ws?.readyState,rows:chartRows().length,botRows:Object.fromEntries(SYMBOLS.map(x=>[x,botRows(x).length])),drawings:drawingStore().length,alerts:store.ui.alerts.filter(x=>x.active).length,equity:s.equity},null,2);
}
function renderAll(){renderWatchlist();renderPaper();renderObjects();renderAlerts();renderTemplates();renderDiagnostics();renderTicker();}
function changeSymbol(symbol){
  runtime.selectedDrawing=null;runtime.symbol=symbol;store.ui.symbol=symbol;els.symbolSelect.value=symbol;els.watermark.textContent=symbol+' · '+runtime.interval;save();
  loadCurrent(false);renderAll();runtime.mainChart.timeScale().scrollToRealTime();
}
async function changeInterval(interval){
  runtime.selectedDrawing=null;runtime.interval=interval;store.ui.interval=interval;els.intervalSelect.value=interval;save();connectWs();await loadCurrent();renderAll();
}
function changeChartType(type){runtime.chartType=type;store.ui.chartType=type;save();createPriceSeries();loadCurrent(false);}
function openPanel(name){
  document.querySelectorAll('.side-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
  document.querySelectorAll('.side-panel').forEach(p=>p.classList.toggle('active',p.dataset.panelId===name));
}
function openModal(el){el.classList.remove('hidden');}
function closeModals(){document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));}
const indicatorDefs=[
  ['sma20','SMA 20','Простая средняя на графике','price'],['ema20','EMA 20','Экспоненциальная средняя','price'],
  ['ema50','EMA 50','Среднесрочная EMA','price'],['bollinger','Bollinger Bands','Полосы 20 / 2σ','price'],
  ['vwap','VWAP','Средняя по объёму','price'],['volume','Volume','Объём под свечами','price'],
  ['rsi','RSI 14','Осциллятор 0–100','lower'],['macd','MACD','12 / 26 / 9','lower'],['atr','ATR 14','Истинный диапазон','lower']
];
function renderIndicatorList(filter=''){
  const q=filter.toLowerCase();
  els.indicatorList.innerHTML=indicatorDefs.filter(x=>(x[1]+' '+x[2]).toLowerCase().includes(q)).map(([id,name,desc,type])=>{
    const active=type==='lower'?store.ui.lowerIndicator===id:!!store.ui.indicators[id];
    return `<div class="indicator-item"><span><b>${esc(name)}</b><small>${esc(desc)}</small></span><button data-indicator="${id}" data-kind="${type}" class="${active?'active':''}">${active?'Добавлен':'Добавить'}</button></div>`;
  }).join('');
}
function intervalSeconds(i){const n=parseInt(i,10);if(i.endsWith('m'))return n*60;if(i.endsWith('h'))return n*3600;if(i.endsWith('d'))return n*86400;return 60;}

/* Events */
els.symbolSelect.value=runtime.symbol;els.intervalSelect.value=runtime.interval;els.chartTypeSelect.value=runtime.chartType;els.compareSelect.value=store.ui.compare;els.scaleMode.value=store.ui.scaleMode;
els.startingBalance.value=store.paper.settings.startingBalance;els.leverage.value=store.paper.settings.leverage;els.symbolNotional.value=store.paper.settings.symbolNotional;els.maxHours.value=store.paper.settings.maxHours;els.exitMode.value=store.paper.settings.exitMode;els.reclaimBufferPct.value=store.paper.settings.reclaimBufferPct;els.trailDistancePct.value=store.paper.settings.trailDistancePct;
els.symbolSelect.onchange=e=>changeSymbol(e.target.value);
els.intervalSelect.onchange=e=>changeInterval(e.target.value);
els.chartTypeSelect.onchange=e=>changeChartType(e.target.value);
els.compareSelect.onchange=async e=>{store.ui.compare=e.target.value;save();await updateCompare();};
els.themeBtn.onclick=()=>{store.ui.theme=store.ui.theme==='dark'?'light':'dark';save();applyTheme();};
els.zoomIn.onclick=()=>zoom(.72);els.zoomOut.onclick=()=>zoom(1.38);
els.fitBtn.onclick=()=>runtime.mainChart.timeScale().fitContent();els.latestBtn.onclick=()=>runtime.mainChart.timeScale().scrollToRealTime();
els.autoScaleBtn.onclick=()=>{const active=!els.autoScaleBtn.classList.contains('active');els.autoScaleBtn.classList.toggle('active',active);runtime.mainChart.priceScale('right').applyOptions({autoScale:active});};
els.scaleMode.onchange=e=>{store.ui.scaleMode=e.target.value;save();applyScaleMode();};
document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>setRange(b.dataset.range));
els.indicatorBtn.onclick=()=>{renderIndicatorList();openModal(els.indicatorModal);};
els.indicatorSearch.oninput=e=>renderIndicatorList(e.target.value);
els.indicatorList.onclick=e=>{const b=e.target.closest('[data-indicator]');if(!b)return;const id=b.dataset.indicator,kind=b.dataset.kind;if(kind==='lower')store.ui.lowerIndicator=store.ui.lowerIndicator===id?null:id;else store.ui.indicators[id]=!store.ui.indicators[id];save();renderIndicatorList(els.indicatorSearch.value);updateIndicators();};
els.closePane.onclick=()=>{store.ui.lowerIndicator=null;save();updateIndicators();};
els.alertBtn.onclick=()=>{openPanel('alerts');els.sidebar.classList.add('open');};
els.createAlert.onclick=async()=>{const p=num(els.alertPrice.value);if(!p)return toast('Укажи цену алерта','error');store.ui.alerts.push({id:'A'+Date.now(),symbol:els.alertSymbol.value,direction:els.alertDirection.value,price:p,note:els.alertNote.value.trim(),active:true,createdAt:nowIso()});save();renderAlerts();els.alertPrice.value='';els.alertNote.value='';if('Notification' in window&&Notification.permission==='default')try{await Notification.requestPermission();}catch(_){}};
els.alertsList.onclick=e=>{const tid=e.target.dataset.alertToggle,did=e.target.dataset.alertDelete;if(tid){const a=store.ui.alerts.find(x=>x.id===tid);if(a)a.active=!a.active;}if(did)store.ui.alerts=store.ui.alerts.filter(x=>x.id!==did);save();renderAlerts();};
els.watchlist.onclick=e=>{const r=e.target.closest('[data-symbol]');if(r)changeSymbol(r.dataset.symbol);};
els.refreshBtn.onclick=()=>Promise.all(SYMBOLS.map(s=>ensureData(s,'15m',true))).then(()=>{scanRecentPatterns();renderAll();});
els.leftbar.onclick=e=>{const b=e.target.closest('[data-tool]');if(b)setTool(b.dataset.tool);};
els.magnetBtn.onclick=()=>{store.ui.magnet=!store.ui.magnet;els.magnetBtn.classList.toggle('active',store.ui.magnet);save();};
els.lockBtn.onclick=()=>{store.ui.drawingsLocked=!store.ui.drawingsLocked;els.lockBtn.classList.toggle('active',store.ui.drawingsLocked);setTool(runtime.tool);save();};
els.hideDrawingsBtn.onclick=()=>{store.ui.drawingsHidden=!store.ui.drawingsHidden;els.hideDrawingsBtn.classList.toggle('active',store.ui.drawingsHidden);save();drawAll();};
els.undoBtn.onclick=()=>{if(!runtime.undo.length)return;runtime.redo.push(JSON.stringify(drawingStore()));restoreDrawings(runtime.undo.pop());};
els.redoBtn.onclick=()=>{if(!runtime.redo.length)return;runtime.undo.push(JSON.stringify(drawingStore()));restoreDrawings(runtime.redo.pop());};
els.deleteBtn.onclick=()=>{if(!runtime.selectedDrawing)return;snapshotDrawings();store.ui.drawings[drawingsKey()]=drawingStore().filter(x=>x.id!==runtime.selectedDrawing);runtime.selectedDrawing=null;save();renderObjects();drawAll();};
els.clearBtn.onclick=()=>{if(confirm('Удалить все рисунки этого графика?')){snapshotDrawings();store.ui.drawings[drawingsKey()]=[];save();renderObjects();drawAll();}};
els.drawingCanvas.addEventListener('pointerdown',drawingDown);els.drawingCanvas.addEventListener('pointermove',drawingMove);els.drawingCanvas.addEventListener('pointerup',drawingUp);
els.objectsList.onclick=e=>{const row=e.target.closest('[data-id]');if(!row)return;const id=row.dataset.id,d=drawingStore().find(x=>x.id===id);if(!d)return;const act=e.target.dataset.action;if(act==='toggle'){d.hidden=!d.hidden;save();drawAll();renderObjects();}else if(act==='remove'){snapshotDrawings();store.ui.drawings[drawingsKey()]=drawingStore().filter(x=>x.id!==id);save();drawAll();renderObjects();}else{runtime.selectedDrawing=id;renderObjects();drawAll();}};
els.replayBtn.onclick=()=>runtime.replay.active?exitReplay():startReplay();
els.replayPlay.onclick=playReplay;els.replayStep.onclick=()=>replayStep(1);els.replayBack.onclick=()=>replayStep(-1);els.replayExit.onclick=exitReplay;els.replaySlider.oninput=e=>{runtime.replay.index=num(e.target.value);applyReplay();};
els.snapshotBtn.onclick=takeSnapshot;
els.fullscreenBtn.onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
els.goDateBtn.onclick=()=>openModal(els.goDateModal);
els.goDateApply.onclick=()=>{const t=Date.parse(els.goDateInput.value)/1000;if(!Number.isFinite(t))return;const span=intervalSeconds(runtime.interval)*100;runtime.mainChart.timeScale().setVisibleRange({from:t-span/2,to:t+span/2});closeModals();};
document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=closeModals);document.querySelectorAll('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)closeModals();});
document.querySelector('.side-tabs').onclick=e=>{const b=e.target.closest('[data-panel]');if(b)openPanel(b.dataset.panel);};
els.savePaperSettings.onclick=()=>{const s=store.paper.settings;s.startingBalance=Math.max(100,num(els.startingBalance.value,1000));s.leverage=clamp(num(els.leverage.value,10),1,20);s.symbolNotional=clamp(num(els.symbolNotional.value,3333.33),100,10000);s.maxHours=clamp(num(els.maxHours.value,72),1,336);s.exitMode=els.exitMode.value==='target'?'target':'trail';s.reclaimBufferPct=clamp(num(els.reclaimBufferPct.value,.10),0,5);s.trailDistancePct=clamp(num(els.trailDistancePct.value,.75),.05,10);save();renderPaper();toast('Paper-настройки сохранены');};
els.resetPaper.onclick=()=>{if(!confirm('Удалить позиции, сделки и PnL paper-счёта?'))return;const settings=store.paper.settings;store.paper=defaultStore().paper;store.paper.settings=settings;save();renderPaper();updateMarkers();};
els.exportTrades.onclick=exportTradesCsv;
els.exportWorkspace.onclick=()=>download(`galka-workspace-${Date.now()}.json`,new Blob([JSON.stringify(workspacePayload(),null,2)],{type:'application/json'}));
els.importWorkspace.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!x.ui)throw new Error('Нет ui');store.ui=deepMerge(defaultStore().ui,x.ui);save();location.reload();}catch(err){toast('Ошибка импорта: '+err.message,'error');}};
els.saveTemplate.onclick=()=>{const name=els.templateName.value.trim();if(!name)return;store.ui.templates[name]={chartType:runtime.chartType,interval:runtime.interval,scaleMode:store.ui.scaleMode,indicators:store.ui.indicators,lowerIndicator:store.ui.lowerIndicator,theme:store.ui.theme};save();els.templateName.value='';renderTemplates();};
els.templatesList.onclick=e=>{const load=e.target.dataset.templateLoad,del=e.target.dataset.templateDelete;if(del){delete store.ui.templates[del];save();renderTemplates();}if(load){const t=store.ui.templates[load];Object.assign(store.ui,t);save();location.reload();}};
els.toggleTools.onclick=()=>els.leftbar.classList.toggle('open');els.toggleSidebar.onclick=()=>els.sidebar.classList.toggle('open');
document.querySelector('.mobile-nav').onclick=e=>{const b=e.target.closest('[data-mobile-panel]');if(!b)return;const p=b.dataset.mobilePanel;if(p==='tools')els.leftbar.classList.toggle('open');else if(p==='chart'){els.leftbar.classList.remove('open');els.sidebar.classList.remove('open');}else{openPanel(p==='more'?'data':p);els.sidebar.classList.add('open');}};
window.addEventListener('resize',()=>{resizeCanvas();drawAll();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(!runtime.ws||runtime.ws.readyState>1))connectWs();});
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea'))return;
  if(e.key==='Escape'){closeModals();setTool('cursor');els.leftbar.classList.remove('open');els.sidebar.classList.remove('open');}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();els.undoBtn.click();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();els.redoBtn.click();}
  if(e.key==='Delete')els.deleteBtn.click();
  if(e.key==='+'||e.key==='=')zoom(.75);if(e.key==='-')zoom(1.35);
  if(e.key.toLowerCase()==='f')els.fitBtn.click();if(e.key.toLowerCase()==='l')setTool('trend');
});
setInterval(()=>{els.clock.textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});renderDiagnostics();renderPaperHeader();},1000);

/* Init */
document.body.dataset.theme=store.ui.theme;
els.magnetBtn.classList.toggle('active',store.ui.magnet);els.lockBtn.classList.toggle('active',store.ui.drawingsLocked);els.hideDrawingsBtn.classList.toggle('active',store.ui.drawingsHidden);
createMainChart();createOscChart();applyScaleMode();renderIndicatorList();renderAll();resizeCanvas();bootstrap();
})();
