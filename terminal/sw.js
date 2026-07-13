const CACHE_NAME = 'galka-final-integration-shell-v5';
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

const PATCH_VERSION = 'final-integration-v1-symbol-autocenter';

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) {
    console.error(`Galka integration patch missing: ${label}`);
    return source;
  }
  return source.replace(oldText, newText);
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
