const CACHE_NAME = 'galka-manual-auto-shell-v4';
const APP_SHELL = [
  './pro.html',
  './pro.css?v=6',
  './pro.js?v=7',
  './manifest.webmanifest',
  './icons/galka-mark.svg',
  './icons/galka-192.png',
  './icons/galka-512.png',
  './modules/store.js',
  './modules/paper-engine.js',
  './modules/radar-engine.js',
  './modules/backup.js',
  'https://unpkg.com/lightweight-charts@5.2.0/dist/lightweight-charts.standalone.production.js',
];

const MANUAL_TARGET_VERSION = 'manual-auto-v1.2-symbol-autocenter';

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) {
    console.error(`Manual target patch missing: ${label}`);
    return source;
  }
  return source.replace(oldText, newText);
}

function transformManualTargetSource(originalSource) {
  let source = originalSource;

  source = replaceOnce(
    source,
    "const VERSION = 'pro-v2.0.1-paper-recovery';",
    `const VERSION = '${MANUAL_TARGET_VERSION}';`,
    'version',
  );

  const storeAnchor = "let store=loadStore();\nconst defaultStore=createDefaultStore;";
  const targetStorePatch = [
    'let store=loadStore();',
    '// Manual Auto research mode: GALKA is both the reference and the exact exit target.',
    '// The main galka-pro-v1 workspace is not read or modified by this branch.',
    'let targetModeMigrated=false;',
    "if(store.paper.settings.signalMode!=='manual'){store.paper.settings.signalMode='manual';targetModeMigrated=true;}",
    "if(store.paper.settings.exitMode!=='target'){store.paper.settings.exitMode='target';targetModeMigrated=true;}",
    'if(num(store.paper.settings.reclaimBufferPct)!==0){store.paper.settings.reclaimBufferPct=0;targetModeMigrated=true;}',
    'for(const symbol of SYMBOLS){',
    '  const campaign=store.paper.symbols[symbol]?.campaign;',
    '  if(!campaign)continue;',
    "  if(campaign.exitMode!=='target'||campaign.target!==campaign.vLow||campaign.reclaimPrice!=null||campaign.trailArmed){",
    "    campaign.exitMode='target';campaign.target=campaign.vLow;campaign.reclaimPrice=null;",
    '    campaign.trailArmed=false;campaign.trailHigh=null;campaign.trailStop=null;campaign.trailActivatedAt=null;',
    "    if(campaign.qty)campaign.status='open';",
    '    targetModeMigrated=true;',
    '  }',
    '}',
    'if(targetModeMigrated)saveStore(store);',
    'const defaultStore=createDefaultStore;',
    "if(els.signalMode){els.signalMode.value='manual';els.signalMode.disabled=true;}",
    "if(els.exitMode){els.exitMode.value='target';els.exitMode.disabled=true;}",
    "for(const control of [els.reclaimBufferPct,els.trailDistancePct])control?.closest('label')?.classList.add('hidden');",
  ].join('\n');
  source = replaceOnce(source, storeAnchor, targetStorePatch, 'target store migration');

  source = replaceOnce(
    source,
    "${campaign?.trailArmed?`Stop ${price(campaign.trailStop,item)}`:campaign?`Reclaim ${price(campaign.reclaimPrice,item)}`:'Можно поставить уровень'}",
    "${campaign?`Выход GALKA ${price(campaign.target||campaign.vLow,item)}`:'Можно поставить уровень'}",
    'portfolio target label',
  );

  source = replaceOnce(
    source,
    "els.botState.textContent=c?(c.status==='trailing'?'Трейлинг':c.status==='open'?'Позиция':'Лимитки'):p?'Галка выбрана':'Ожидание';",
    "els.botState.textContent=c?(c.qty?'Ждём возврат к GALKA':'Лимитки'):p?'Галка выбрана':'Ожидание';",
    'plain campaign state',
  );

  source = replaceOnce(
    source,
    '<span><small>Reclaim</small><b>${price(c.reclaimPrice,symbol)}</b></span><span><small>Trail stop</small><b class="${c.trailArmed?\'down\':\'\'}">${price(c.trailStop,symbol)}</b></span>',
    '<span><small>Выход</small><b>${price(c.target||c.vLow,symbol)}</b></span><span><small>Режим</small><b>На GALKA</b></span>',
    'campaign target metrics',
  );

  source = replaceOnce(
    source,
    "if(c.reclaimPrice)addPaperLine(c.reclaimPrice,COLORS.purple,'RECLAIM');",
    "if(c.exitMode==='trail'&&c.reclaimPrice)addPaperLine(c.reclaimPrice,COLORS.purple,'RECLAIM');",
    'hide reclaim price line',
  );

  source = replaceOnce(
    source,
    "if(p)markers.push({time:p.vLowTime,position:'belowBar',color:p.source==='manual'?COLORS.orange:COLORS.blue,shape:'circle',text:p.source==='manual'?'GALKA':'V-low'});",
    "if(p&&p.source!=='manual')markers.push({time:p.vLowTime,position:'belowBar',color:COLORS.blue,shape:'circle',text:'V-low'});",
    'remove manual yellow marker',
  );

  source = replaceOnce(
    source,
    "s.signalMode=els.signalMode.value==='auto'?'auto':'manual';",
    "s.signalMode='manual';",
    'force manual signal mode',
  );

  source = replaceOnce(
    source,
    "s.exitMode=els.exitMode.value==='target'?'target':'trail';s.reclaimBufferPct=clamp(num(els.reclaimBufferPct.value,.10),0,5);",
    "s.exitMode='target';s.reclaimBufferPct=0;",
    'force target settings',
  );

  const oldChangeSymbol = [
    'function changeSymbol(symbol){',
    "  runtime.selectedDrawing=null;syncDrawingInteraction();runtime.radarSelected=null;runtime.symbol=symbol;store.ui.symbol=symbol;els.symbolSelect.value=symbol;els.watermark.textContent=symbol+' · '+runtime.interval;save();",
    '  loadCurrent(false);renderAll();runtime.mainChart.timeScale().scrollToRealTime();',
    '}',
  ].join('\n');
  const centeredChangeSymbol = [
    'async function changeSymbol(symbol){',
    "  runtime.selectedDrawing=null;syncDrawingInteraction();runtime.radarSelected=null;runtime.symbol=symbol;store.ui.symbol=symbol;els.symbolSelect.value=symbol;els.watermark.textContent=symbol+' · '+runtime.interval;save();",
    "  const priceScale=runtime.mainChart?.priceScale('right');",
    "  priceScale?.applyOptions({autoScale:true});els.autoScaleBtn?.classList.add('active');",
    '  try{runtime.priceSeries?.setData([]);}catch(_){}',
    '  await loadCurrent(false);',
    "  priceScale?.applyOptions({autoScale:true});runtime.mainChart?.timeScale().scrollToRealTime();",
    "  requestAnimationFrame(()=>priceScale?.applyOptions({autoScale:true}));",
    '  renderAll();',
    '}',
  ].join('\n');
  source = replaceOnce(source, oldChangeSymbol, centeredChangeSymbol, 'symbol auto-center');

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
  const patched = transformManualTargetSource(source);
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-galka-mode', MANUAL_TARGET_VERSION);
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
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('galka-manual-auto-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
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