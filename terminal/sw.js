const CACHE_NAME = 'galka-final-integration-shell-v6';
const APP_SHELL = [
  './pro.html',
  './pro.css?v=7',
  './pro.js?v=8',
  './manifest.webmanifest',
  './icons/galka-mark.svg',
  './icons/galka-192.png',
  './icons/galka-512.png',
  './modules/store.js',
  './modules/paper-engine.js',
  './modules/radar-engine.js',
  './modules/backup.js',
  './modules/galka-stats.js',
  './modules/shadow-engine.js',
  'https://unpkg.com/lightweight-charts@5.2.0/dist/lightweight-charts.standalone.production.js',
];

const PATCH_VERSION = 'final-integration-v2-simple-terminal';

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) {
    console.error(`Galka integration patch missing: ${label}`);
    return source;
  }
  return source.replace(oldText, newText);
}

function simpleUiSource() {
  return String.raw`
function renderSimpleTradeBar(){
  const root=document.getElementById('simpleTradeBar');if(!root)return;
  const input=document.getElementById('simpleGalkaPrice'),status=document.getElementById('simpleTradeStatus'),launch=document.getElementById('simpleGalkaLaunch');
  const symbol=runtime.symbol,ss=store.paper.symbols[symbol],c=ss?.campaign,filled=c?.levels?.filter(level=>level.status==='filled').length||0,total=c?.levels?.length||8,q=runtime.quotes[symbol],pnl=c?.qty&&q?.bid?c.qty*(q.bid-c.averageEntry)-c.entryFees:0;
  if(document.activeElement!==input)input.value=c?.vLow?price(c.vLow,symbol):'';
  input.placeholder=symbol.replace('USDT','')+' · цена GALKA';
  if(!c){status.textContent=symbol.replace('USDT','')+' · нет GALKA';status.className='simple-trade-status idle';launch.textContent='Запустить';launch.disabled=false;input.disabled=false;return;}
  if(c.qty||filled){status.textContent=symbol.replace('USDT','')+' · '+filled+'/'+total+' · '+signedMoney(pnl);status.className='simple-trade-status '+(pnl>=0?'up-state':'down-state');launch.textContent='Активна';launch.disabled=true;input.disabled=true;return;}
  status.textContent=symbol.replace('USDT','')+' · ждём 0/'+total;status.className='simple-trade-status waiting';launch.textContent='Перенести';launch.disabled=false;input.disabled=false;
}
function installSimpleGalkaUi(){
  if(document.getElementById('simpleTradeBar'))return;
  const style=document.createElement('style');style.id='simpleGalkaStyle';style.textContent=\`
    :root{--simple-bar:74px;--bottom-nav:0px}
    .mobile-nav,.side-tabs,#radarBtn,#toggleSidebar,.chart-actions,.chart-health,.ohlc,.radar-legend,.chart-attribution{display:none!important}
    #connectionText{display:none!important}.connection-button{width:36px!important;padding:0!important}
    .terminal-grid{height:calc(100dvh - var(--top) - var(--safe-top) - var(--simple-bar) - var(--safe-bottom))!important;grid-template-columns:1fr!important}
    .drawing-pill{bottom:10px!important}
    .sidebar{display:none!important}
    .sidebar.open{display:flex!important;position:fixed!important;z-index:180!important;left:8px!important;right:8px!important;top:auto!important;bottom:calc(var(--simple-bar) + var(--safe-bottom) + 8px)!important;width:auto!important;height:min(68dvh,680px)!important;max-height:calc(100dvh - var(--top) - var(--simple-bar) - 20px)!important;transform:none!important;border:1px solid var(--line)!important;border-radius:20px!important;box-shadow:var(--shadow)!important;background:var(--panel)!important}
    .sidebar .side-panel{display:none!important}.sidebar .side-panel[data-panel-id="paper"].active{display:block!important}
    .sidebar [data-panel-id="paper"] .training-row{display:none!important}
    .sidebar label:has(#signalMode),.sidebar label:has(#ladderStepPct),.sidebar label:has(#manualDepthPct),.sidebar label:has(#exitMode),.sidebar label:has(#reclaimBufferPct),.sidebar label:has(#trailDistancePct){display:none!important}
    .campaign-metrics span:nth-child(4),.campaign-metrics span:nth-child(5){display:none!important}
    .leftbar{display:none!important;position:fixed!important;z-index:190!important;left:max(8px,var(--safe-left))!important;top:calc(var(--top) + var(--safe-top) + 8px)!important;width:58px!important;height:auto!important;max-height:calc(100dvh - var(--top) - var(--simple-bar) - 24px)!important;padding:6px!important;border:1px solid var(--line)!important;border-radius:16px!important;background:var(--panel-glass)!important;box-shadow:var(--shadow)!important;overflow:auto!important}
    .leftbar.open{display:flex!important}.leftbar button{display:none!important}
    .leftbar [data-tool="cursor"],.leftbar [data-tool="ray"],.leftbar [data-tool="measure"],.leftbar #deleteBtn,.leftbar #clearBtn{display:flex!important}
    .leftbar .tool-separator,.leftbar #magnetBtn,.leftbar #lockBtn,.leftbar #hideDrawingsBtn,.leftbar #undoBtn,.leftbar #redoBtn{display:none!important}
    #simpleTradeBar{position:fixed;z-index:170;left:0;right:0;bottom:0;height:calc(var(--simple-bar) + var(--safe-bottom));padding:8px max(8px,var(--safe-right)) calc(8px + var(--safe-bottom)) max(8px,var(--safe-left));display:grid;grid-template-columns:minmax(96px,.8fr) minmax(118px,1.25fr) minmax(100px,.9fr);gap:7px;align-items:center;border-top:1px solid var(--line);background:color-mix(in srgb,var(--panel) 96%,transparent);backdrop-filter:blur(22px);box-shadow:0 -12px 32px rgba(0,0,0,.28)}
    #simpleTradeBar input,#simpleTradeBar button{height:50px;min-height:50px;border-radius:13px}
    #simpleGalkaPrice{font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}
    #simpleGalkaLaunch{border-color:color-mix(in srgb,var(--galka) 62%,var(--line));background:var(--galka);color:#231504;font-weight:900}
    #simpleGalkaLaunch:disabled{background:var(--panel-2);color:var(--muted)}
    .simple-trade-status{padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;font-size:11px;font-weight:850}
    .simple-trade-status.idle{color:var(--muted)}.simple-trade-status.waiting{color:var(--galka);background:var(--galka-dim)}.simple-trade-status.up-state{color:var(--green);background:var(--green-dim)}.simple-trade-status.down-state{color:var(--red);background:var(--red-dim)}
    @media(max-width:480px){.brand-copy{display:none!important}.brand{min-width:auto!important}.live-price{font-size:10px}.simple-trade-status{font-size:10px;padding:0 6px}#simpleTradeBar{grid-template-columns:minmax(82px,.72fr) minmax(108px,1.2fr) minmax(92px,.82fr)}}
  \`;document.head.append(style);
  document.body.insertAdjacentHTML('beforeend','<div id="simpleTradeBar" aria-label="Быстрый запуск GALKA"><button id="simpleTradeStatus" class="simple-trade-status idle" type="button">Нет GALKA</button><input id="simpleGalkaPrice" type="number" step="any" inputmode="decimal" placeholder="Цена GALKA" aria-label="Цена GALKA"><button id="simpleGalkaLaunch" type="button">Запустить</button></div>');
  const input=document.getElementById('simpleGalkaPrice'),launch=document.getElementById('simpleGalkaLaunch'),status=document.getElementById('simpleTradeStatus');
  const submit=()=>{const value=num(input.value);if(!(value>0))return toast('Введи цену GALKA','error');els.manualGalkaPrice.value=String(value);applyManualPrice();};
  launch.onclick=submit;input.onkeydown=event=>{if(event.key==='Enter')submit();};status.onclick=()=>showMobilePanel('paper');
  const toolLabel=els.toggleTools?.querySelector('span:last-child');if(toolLabel)toolLabel.textContent='Инструменты';
  const toolHead=els.leftbar?.querySelector('.tool-rail-head > span');if(toolHead)toolHead.textContent='TOOLS';
  const ray=els.leftbar?.querySelector('[data-tool="ray"]');if(ray){ray.title='Луч от GALKA';ray.setAttribute('aria-label','Луч от GALKA');}
  const measure=els.leftbar?.querySelector('[data-tool="measure"]');if(measure){measure.title='Линейка процентов';measure.setAttribute('aria-label','Линейка процентов');}
  renderSimpleTradeBar();
}
`;
}

function patchProSource(originalSource) {
  let source = originalSource;

  const oldMarketSwitch = [
    'function changeSymbol(symbol){',
    "  runtime.selectedDrawing=null;syncDrawingInteraction();runtime.radarSelected=null;runtime.symbol=symbol;store.ui.symbol=symbol;els.symbolSelect.value=symbol;els.watermark.textContent=symbol+' · '+runtime.interval;save();",
    '  loadCurrent(false);renderAll();runtime.mainChart.timeScale().scrollToRealTime();',
    '}',
    'async function changeInterval(interval){',
    "  runtime.selectedDrawing=null;syncDrawingInteraction();runtime.radarSelected=null;runtime.interval=interval;store.ui.interval=interval;els.intervalSelect.value=interval;save();connectWs();await loadCurrent();renderAll();",
    '}',
  ].join('\n');

  const newMarketSwitch = [
    'function autoCenterActiveMarket({fitTime=false}={}){',
    '  const chart=runtime.mainChart;if(!chart)return;',
    "  const scale=chart.priceScale('right');",
    '  scale.applyOptions({autoScale:true});',
    "  els.autoScaleBtn?.classList.add('active');",
    '  if(fitTime)chart.timeScale().fitContent();else chart.timeScale().scrollToRealTime();',
    '  requestAnimationFrame(()=>{scale.applyOptions({autoScale:true});if(!fitTime)chart.timeScale().scrollToRealTime();});',
    '  setTimeout(()=>scale.applyOptions({autoScale:true}),120);',
    '}',
    'async function changeSymbol(symbol){',
    "  runtime.selectedDrawing=null;syncDrawingInteraction();runtime.radarSelected=null;runtime.symbol=symbol;store.ui.symbol=symbol;els.symbolSelect.value=symbol;els.watermark.textContent=symbol+' · '+runtime.interval;save();",
    "  try{runtime.priceSeries?.setData([]);}catch(_){}",
    '  await loadCurrent(false);',
    '  renderAll();',
    '  autoCenterActiveMarket();',
    '}',
    'async function changeInterval(interval){',
    "  runtime.selectedDrawing=null;syncDrawingInteraction();runtime.radarSelected=null;runtime.interval=interval;store.ui.interval=interval;els.intervalSelect.value=interval;save();connectWs();",
    "  try{runtime.priceSeries?.setData([]);}catch(_){}",
    '  await loadCurrent(false);',
    '  renderAll();',
    '  autoCenterActiveMarket();',
    '}',
  ].join('\n');

  source = replaceOnce(source, oldMarketSwitch, newMarketSwitch, 'symbol and interval auto-center');
  source = replaceOnce(
    source,
    "els.fitBtn.onclick=()=>runtime.mainChart.timeScale().fitContent();els.latestBtn.onclick=()=>runtime.mainChart.timeScale().scrollToRealTime();",
    "els.fitBtn.onclick=()=>autoCenterActiveMarket({fitTime:true});els.latestBtn.onclick=()=>autoCenterActiveMarket();",
    'fit and latest autoscale',
  );
  source = replaceOnce(
    source,
    '/* Rendering and UI */',
    `${simpleUiSource()}\n/* Rendering and UI */`,
    'simple UI functions',
  );
  source = replaceOnce(
    source,
    "function renderAll(){renderWatchlist();renderPaper();renderObjects();renderAlerts();renderTemplates();renderRadar();renderLab();renderActivity();renderDiagnostics();renderSessionHealth();renderTicker();}",
    "function renderAll(){renderWatchlist();renderPaper();renderObjects();renderAlerts();renderTemplates();renderRadar();renderLab();renderActivity();renderDiagnostics();renderSessionHealth();renderTicker();renderSimpleTradeBar();}",
    'simple status render',
  );
  source = replaceOnce(
    source,
    "if(p)markers.push({time:p.vLowTime,position:'belowBar',color:p.source==='manual'?COLORS.orange:COLORS.blue,shape:'circle',text:p.source==='manual'?'GALKA':'V-low'});",
    "if(p&&p.source!=='manual')markers.push({time:p.vLowTime,position:'belowBar',color:COLORS.blue,shape:'circle',text:'V-low'});",
    'remove manual GALKA point marker',
  );
  source = replaceOnce(
    source,
    "else if(d.type==='ray'){const dx=b.x-a.x,dy=b.y-a.y,t=dx===0?0:(w-a.x)/dx;line(ctx,a,{x:w,y:a.y+dy*t});}",
    "else if(d.type==='ray'){const dx=b.x-a.x,dy=b.y-a.y,t=dx===0?0:(w-a.x)/dx,end={x:w,y:a.y+dy*t};line(ctx,a,end);label(ctx,`GALKA ${price(d.p1.price)}`,Math.max(0,Math.min(a.x,w-112)),a.y,d.color||COLORS.blue);}",
    'ray GALKA label',
  );
  source = replaceOnce(
    source,
    "updateMarkers();setTool('cursor');showMobilePanel('paper');",
    "updateMarkers();setTool('cursor');renderSimpleTradeBar();closeMobileOverlays();",
    'keep chart open after launch',
  );
  source = replaceOnce(
    source,
    "s.signalMode=els.signalMode.value==='auto'?'auto':'manual';s.ladderStepPct=clamp(num(els.ladderStepPct.value,.15),.05,2);s.manualDepthPct=clamp(num(els.manualDepthPct.value,1.5),s.ladderStepPct,10);s.exitMode=els.exitMode.value==='target'?'target':'trail';s.reclaimBufferPct=clamp(num(els.reclaimBufferPct.value,.10),0,5);",
    "s.signalMode='manual';s.ladderStepPct=.15;s.manualDepthPct=2;s.exitMode='target';s.reclaimBufferPct=0;",
    'fixed simple paper settings',
  );
  source = replaceOnce(
    source,
    "campaign?.trailArmed?`Stop ${price(campaign.trailStop,item)}`:campaign?`Reclaim ${price(campaign.reclaimPrice,item)}`:'Можно поставить уровень'",
    "campaign?`Цель ${price(campaign.vLow,item)}`:'Можно поставить уровень'",
    'paper target copy',
  );
  source = replaceOnce(
    source,
    '/* Init */',
    'installSimpleGalkaUi();\nsetInterval(renderSimpleTradeBar,1000);\n\n/* Init */',
    'simple UI init',
  );

  return source;
}

async function servePatchedPro(request) {
  let response;
  try {
    response = await fetch(request, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    response = await caches.match(request);
    if (!response) throw error;
  }

  const source = await response.text();
  const patched = patchProSource(source);
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-galka-patch', PATCH_VERSION);
  return new Response(patched, {
    status: 200,
    statusText: 'OK',
    headers,
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Market data must always be live. The service worker never runs the paper engine.
  if (url.hostname === 'fapi.binance.com' || url.hostname === 'fstream.binance.com') return;

  if (url.origin === self.location.origin && url.pathname.endsWith('/terminal/pro.js')) {
    event.respondWith(servePatchedPro(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./pro.html', copy));
          return response;
        })
        .catch(() => caches.match('./pro.html')),
    );
    return;
  }

  const isLocalAppAsset =
    url.origin === self.location.origin &&
    ['script', 'style', 'worker'].includes(request.destination);

  if (isLocalAppAsset) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok || response.type === 'opaque') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    }),
  );
});
