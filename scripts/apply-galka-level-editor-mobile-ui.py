#!/usr/bin/env python3
from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

root = Path(__file__).resolve().parents[1]
html_path = root / "terminal/pro.html"
css_path = root / "terminal/pro.css"
js_path = root / "terminal/pro.js"
check_path = root / "scripts/check-pro-terminal.mjs"

html = html_path.read_text()
html = replace_once(html, 'pro.css?v=2', 'pro.css?v=3', 'css cache version')
html = replace_once(html, 'pro.js?v=2', 'pro.js?v=3', 'js cache version')
html = replace_once(
    html,
    '''    <aside class="sidebar" id="sidebar">\n      <nav class="side-tabs">''',
    '''    <aside class="sidebar" id="sidebar">\n      <div class="mobile-sheet-head mobile-only"><span>Панель терминала</span><button id="closeSidebarSheet" aria-label="Закрыть">×</button></div>\n      <nav class="side-tabs">''',
    'mobile sheet header',
)
html = replace_once(
    html,
    '''        <div class="manual-actions">\n          <button id="manualGalkaBtn" class="primary">Указать галку на графике</button>\n          <button id="cancelManualGalka">Снять уровень</button>\n        </div>\n        <div class="training-row"><span>Сохранено примеров: <b id="manualExamplesCount">0</b></span><button id="exportManualExamples">JSON</button></div>''',
    '''        <div class="level-editor">\n          <div class="level-editor-head"><b>Уровень галки</b><span>до первого исполнения</span></div>\n          <div class="level-price-row">\n            <input id="manualGalkaPrice" type="number" step="any" inputmode="decimal" placeholder="Цена уровня">\n            <button id="applyManualGalkaPrice" class="primary">Установить</button>\n          </div>\n          <div class="manual-actions">\n            <button id="manualGalkaBtn">Выбрать на графике</button>\n            <button id="moveManualGalka">Двигать линию</button>\n            <button id="cancelManualGalka">Снять</button>\n          </div>\n          <small id="manualLevelHint">Укажи цену или выбери уровень на графике.</small>\n        </div>\n        <div class="training-row"><span>Сохранено примеров: <b id="manualExamplesCount">0</b></span><button id="exportManualExamples">JSON</button></div>''',
    'level editor markup',
)
html = replace_once(
    html,
    '''  <nav class="mobile-nav mobile-only">''',
    '''  <div id="sheetBackdrop" class="sheet-backdrop"></div>\n  <nav class="mobile-nav mobile-only">''',
    'mobile backdrop',
)
html_path.write_text(html)

css = css_path.read_text()
old_mobile = '''@media(max-width:700px){
  :root{--top:48px;--status:27px}.mobile-only{display:inline-grid;place-items:center}.topbar{gap:5px}.brand{display:none}
  .market-controls{flex:1;min-width:0}.market-controls select{min-width:0;flex:1;padding:0 4px}.top-actions{margin-left:0}.top-actions #indicatorBtn,.top-actions #alertBtn{display:none}
  .terminal-grid{grid-template-columns:1fr;height:calc(100% - var(--top) - var(--status) - 50px)}
  .leftbar{position:fixed;left:0;top:calc(var(--top) + var(--status));bottom:50px;width:54px;z-index:60;transform:translateX(-105%);transition:.18s}.leftbar.open{transform:none}
  .sidebar{position:fixed;right:0;top:calc(var(--top) + var(--status));bottom:50px;width:min(92vw,340px);z-index:60;transform:translateX(105%);transition:.18s;box-shadow:-12px 0 30px #0008}.sidebar.open{transform:none}
  .chart-toolbar{height:34px}.ohlc{font-size:10px}.quick-buttons select,.quick-buttons #autoScaleBtn,.quick-buttons #goDateBtn{display:none}.quick-buttons button{height:27px}
  .bottom-strip{min-height:31px}.attribution{display:none}.pane{height:30%}
  .mobile-nav{position:fixed;display:grid;grid-template-columns:repeat(5,1fr);left:0;right:0;bottom:0;height:calc(50px + var(--safe));padding-bottom:var(--safe);background:var(--panel);border-top:1px solid var(--line);z-index:70}.mobile-nav button{border:0;background:transparent;font-size:11px}
  .watermark{font-size:20px;top:12px;left:12px}
}'''
new_mobile = '''@media(max-width:700px){
  :root{--top:46px;--status:25px}.mobile-only{display:inline-grid;place-items:center}.topbar{gap:4px;padding:4px 6px}.brand{display:none}
  .market-controls{flex:1;min-width:0}.market-controls select{min-width:0;flex:1;padding:0 4px;height:34px}.market-controls #chartTypeSelect{display:none}.top-actions{margin-left:0}.top-actions #indicatorBtn,.top-actions #alertBtn{display:none}
  .statusbar{padding:0 6px}.statusbar .separator,.statusbar #clock{display:none}
  .terminal-grid{grid-template-columns:1fr;height:calc(100% - var(--top) - var(--status) - 50px - var(--safe))}
  .leftbar{position:fixed;left:8px;right:8px;top:auto;bottom:calc(56px + var(--safe));width:auto;max-height:34vh;z-index:82;transform:translateY(calc(100% + 80px));transition:.2s ease;display:flex;flex-direction:row;align-content:flex-start;justify-content:center;flex-wrap:wrap;overflow:auto;padding:9px;border:1px solid var(--line2);border-radius:14px;background:var(--panel);box-shadow:0 -14px 36px #0009}.leftbar.open{transform:none}.leftbar button{width:42px;min-height:40px;margin:2px}.tool-separator{height:34px;width:1px;border-top:0;border-left:1px solid var(--line);margin:4px}
  .sidebar{position:fixed;left:0;right:0;top:auto;bottom:calc(50px + var(--safe));width:100%;height:min(68vh,620px);z-index:82;transform:translateY(calc(100% + 80px));transition:.22s ease;box-shadow:0 -16px 42px #000a;border:1px solid var(--line2);border-bottom:0;border-radius:16px 16px 0 0;display:flex;flex-direction:column;background:var(--panel)}.sidebar.open{transform:none}
  .mobile-sheet-head{height:40px;flex:0 0 40px;grid-template-columns:1fr 38px;align-items:center;padding:0 8px 0 14px;border-bottom:1px solid var(--line);font-weight:700}.mobile-sheet-head button{height:32px;border:0;background:transparent;font-size:22px}
  .side-tabs{flex:0 0 38px}.side-panel{height:auto;flex:1;min-height:0;padding-bottom:20px}
  .chart-toolbar{height:32px;padding:2px 5px}.ohlc{font-size:9px}.quick-buttons select,.quick-buttons #autoScaleBtn,.quick-buttons #goDateBtn{display:none}.quick-buttons button{height:26px;padding:0 6px}
  .bottom-strip{min-height:29px}.range-buttons button{padding:0 6px}.attribution{display:none}.pane{height:30%}
  .mobile-nav{position:fixed;display:grid;grid-template-columns:repeat(5,1fr);left:0;right:0;bottom:0;height:calc(50px + var(--safe));padding-bottom:var(--safe);background:var(--panel);border-top:1px solid var(--line);z-index:90}.mobile-nav button{border:0;background:transparent;font-size:11px}
  .sheet-backdrop{display:block;position:fixed;inset:calc(var(--top) + var(--status)) 0 calc(50px + var(--safe));z-index:80;background:#0008;opacity:0;pointer-events:none;transition:.18s}.sheet-backdrop.open{opacity:1;pointer-events:auto}
  .watermark{font-size:18px;top:9px;left:9px}.toast{bottom:10px;max-width:90%;text-align:center}
  .form-grid{grid-template-columns:1fr 1fr}.paper-summary{grid-template-columns:repeat(4,1fr)}.paper-summary>div{padding:7px 5px}.paper-summary strong{font-size:12px}
}'''
css = replace_once(css, old_mobile, new_mobile, 'mobile layout')
old_tail = '''.leftbar button[data-tool="manualGalka"]{font-weight:900;color:var(--orange);border:1px solid color-mix(in srgb,var(--orange) 45%,transparent)}
.leftbar button[data-tool="manualGalka"].active{background:color-mix(in srgb,var(--orange) 18%,var(--panel))!important;color:var(--orange)!important;outline-color:var(--orange)}
.manual-actions{display:grid;grid-template-columns:1fr auto;gap:6px;padding:8px;border-bottom:1px solid var(--line)}
.manual-actions button{min-height:38px;border-radius:5px}
.training-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;color:var(--muted);border-bottom:1px solid var(--line);font-size:11px}
.training-row button{height:30px;border-radius:4px}'''
new_tail = '''.leftbar button[data-tool="manualGalka"]{font-weight:900;color:var(--orange);border:1px solid color-mix(in srgb,var(--orange) 45%,transparent)}
.leftbar button[data-tool="manualGalka"].active,.leftbar button[data-tool="manualMove"].active{background:color-mix(in srgb,var(--orange) 18%,var(--panel))!important;color:var(--orange)!important;outline-color:var(--orange)}
#drawingCanvas.dragging-level{pointer-events:auto;touch-action:none;cursor:ns-resize}
.level-editor{margin:8px;border:1px solid color-mix(in srgb,var(--orange) 34%,var(--line));border-radius:8px;background:color-mix(in srgb,var(--orange) 5%,var(--panel2));overflow:hidden}
.level-editor-head{display:flex;align-items:center;justify-content:space-between;padding:8px 9px 4px}.level-editor-head span{font-size:10px;color:var(--muted)}
.level-price-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;padding:5px 8px}.level-price-row input,.level-price-row button{height:40px;border-radius:6px;padding:0 9px}.level-price-row input{min-width:0;font-size:16px;font-weight:700}
.manual-actions{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;padding:3px 8px 7px}.manual-actions button{min-height:38px;border-radius:5px;padding:0 7px}.manual-actions button:disabled{opacity:.42;cursor:not-allowed}
#manualLevelHint{display:block;min-height:30px;padding:0 9px 8px;color:var(--muted);font-size:10px}
.training-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;color:var(--muted);border-bottom:1px solid var(--line);font-size:11px}.training-row button{height:30px;border-radius:4px}
.sheet-backdrop{display:none}'''
css = replace_once(css, old_tail, new_tail, 'level editor styles')
css_path.write_text(css)

js = js_path.read_text()
js = replace_once(js, "const VERSION = 'pro-v1.2.0-manual-galka';", "const VERSION = 'pro-v1.3.0-level-editor-mobile';", 'version')
js = replace_once(
    js,
    "'campaignCard','fillsCount','levelsList','manualGalkaBtn','cancelManualGalka','exportManualExamples','manualExamplesCount','startingBalance','leverage','symbolNotional','maxHours','signalMode','ladderStepPct','manualDepthPct','exitMode','reclaimBufferPct','trailDistancePct','savePaperSettings',",
    "'campaignCard','fillsCount','levelsList','manualGalkaBtn','manualGalkaPrice','applyManualGalkaPrice','moveManualGalka','manualLevelHint','cancelManualGalka','exportManualExamples','manualExamplesCount','closeSidebarSheet','sheetBackdrop','startingBalance','leverage','symbolNotional','maxHours','signalMode','ladderStepPct','manualDepthPct','exitMode','reclaimBufferPct','trailDistancePct','savePaperSettings',",
    'element registry',
)
js = replace_once(js, "  hiddenLiveUpdates:false\n};", "  hiddenLiveUpdates:false,manualDrag:false,manualDragOriginal:null\n};", 'runtime drag state')
old_event = '''function eventPoint(e){
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
}'''
new_event = '''function eventPoint(e,snap=store.ui.magnet){
  const r=els.drawingCanvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  let time=runtime.mainChart.timeScale().coordinateToTime(x),pr=runtime.priceSeries.coordinateToPrice(y);
  if(time==null||pr==null)return null;
  if(typeof time!=='number')time=Math.floor(Date.UTC(time.year,time.month-1,time.day)/1000);
  let p={time,price:num(pr)};
  if(snap){
    const rows=chartRows(),i=nearestIndex(rows,p.time),c=rows[i];
    if(c){p.time=c.time;const vals=[c.open,c.high,c.low,c.close],near=vals.sort((a,b)=>Math.abs(a-p.price)-Math.abs(b-p.price))[0];p.price=near;}
  }
  return p;
}'''
js = replace_once(js, old_event, new_event, 'raw manual coordinate')
js = replace_once(
    js,
    "  els.drawingCanvas.classList.toggle('drawing',tool==='manualGalka'||(tool!=='cursor'&&tool!=='crosshair'&&!store.ui.drawingsLocked));",
    "  const manualTool=tool==='manualGalka'||tool==='manualMove';\n  els.drawingCanvas.classList.toggle('drawing',manualTool||(tool!=='cursor'&&tool!=='crosshair'&&!store.ui.drawingsLocked));\n  els.drawingCanvas.classList.toggle('dragging-level',tool==='manualMove');",
    'manual move canvas mode',
)
old_draw = '''function drawingDown(e){
  if(['cursor','crosshair'].includes(runtime.tool)||(store.ui.drawingsLocked&&runtime.tool!=='manualGalka'))return;
  const p=eventPoint(e);if(!p)return;
  if(runtime.tool==='manualGalka'){setManualGalka(p);return;}
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
}'''
new_draw = '''function drawingDown(e){
  const manualTool=runtime.tool==='manualGalka'||runtime.tool==='manualMove';
  if(['cursor','crosshair'].includes(runtime.tool)||(store.ui.drawingsLocked&&!manualTool))return;
  const p=eventPoint(e,!manualTool);if(!p)return;
  if(runtime.tool==='manualGalka'){setManualGalka(p);return;}
  if(runtime.tool==='manualMove'){beginManualMove(p,e);return;}
  if(runtime.tool==='horizontal'||runtime.tool==='vertical'){addDrawing({type:runtime.tool,p1:p,color:COLORS.blue});return;}
  if(runtime.tool==='text'){const text=prompt('Текст на графике:');if(text)addDrawing({type:'text',p1:p,text,color:COLORS.blue,fontSize:14});return;}
  runtime.drawingStart=p;runtime.drawingPreview={type:runtime.tool,p1:p,p2:p,color:COLORS.blue};els.drawingCanvas.setPointerCapture(e.pointerId);
}
function drawingMove(e){
  if(runtime.manualDrag){const p=eventPoint(e,false);if(p)updateManualLevel(p.price,false);return;}
  if(!runtime.drawingStart)return;const p=eventPoint(e);if(!p)return;
  runtime.drawingPreview={type:runtime.tool,p1:runtime.drawingStart,p2:p,color:COLORS.blue};drawAll();
}
function drawingUp(e){
  if(runtime.manualDrag){
    const p=eventPoint(e,false),fallback=runtime.manualDragOriginal;runtime.manualDrag=false;
    const ok=p&&updateManualLevel(p.price,true);if(!ok&&fallback)updateManualLevel(fallback,true,true);
    runtime.manualDragOriginal=null;try{els.drawingCanvas.releasePointerCapture(e.pointerId);}catch(_){}setTool('cursor');return;
  }
  if(!runtime.drawingStart)return;const p=eventPoint(e);
  if(p)addDrawing({type:runtime.tool,p1:runtime.drawingStart,p2:p,color:COLORS.blue});
  runtime.drawingStart=null;runtime.drawingPreview=null;try{els.drawingCanvas.releasePointerCapture(e.pointerId);}catch(_){}
  drawAll();
}'''
js = replace_once(js, old_draw, new_draw, 'drag event handling')
anchor = '''function createCampaign(symbol,p){
  const st=store.paper.settings,maxNotional=st.symbolNotional,{depths,weights}=campaignLadder(st,p);
  return{campaignId:`C-${symbol}-${Date.now()}`,symbol,patternId:p.patternId,source:p.source||'auto',trainingExampleId:p.trainingExampleId||null,status:'waiting',vLow:p.vLow,target:p.vLow,createdAt:nowIso(),expiresAt:Date.now()+st.maxHours*3600000,
    exitMode:st.exitMode||'trail',reclaimPrice:p.vLow*(1+num(st.reclaimBufferPct,.10)/100),trailArmed:false,trailHigh:null,trailStop:null,trailActivatedAt:null,
    levels:depths.map((d,i)=>({index:i+1,depthPct:d,weight:weights[i],price:p.vLow*(1-d/100),notional:maxNotional*weights[i],status:'pending',fillPrice:null,fillTime:null,qty:0,fee:0})),
    qty:0,filledNotional:0,averageEntry:null,entryFees:0,unrealizedPnl:0};
}
'''
addition = '''function createCampaign(symbol,p){
  const st=store.paper.settings,maxNotional=st.symbolNotional,{depths,weights}=campaignLadder(st,p);
  return{campaignId:`C-${symbol}-${Date.now()}`,symbol,patternId:p.patternId,source:p.source||'auto',trainingExampleId:p.trainingExampleId||null,status:'waiting',vLow:p.vLow,target:p.vLow,createdAt:nowIso(),expiresAt:Date.now()+st.maxHours*3600000,
    exitMode:st.exitMode||'trail',reclaimPrice:p.vLow*(1+num(st.reclaimBufferPct,.10)/100),trailArmed:false,trailHigh:null,trailStop:null,trailActivatedAt:null,
    levels:depths.map((d,i)=>({index:i+1,depthPct:d,weight:weights[i],price:p.vLow*(1-d/100),notional:maxNotional*weights[i],status:'pending',fillPrice:null,fillTime:null,qty:0,fee:0})),
    qty:0,filledNotional:0,averageEntry:null,entryFees:0,unrealizedPnl:0};
}
function editableManualCampaign(symbol=runtime.symbol){
  const c=store.paper.symbols[symbol]?.campaign;
  return c?.source==='manual'&&!c.qty&&!c.levels.some(x=>x.status==='filled')?c:null;
}
function manualLevelAllowed(symbol,value){
  if(!(value>0))return{ok:false,message:'Укажи корректную цену уровня'};
  const step=clamp(num(store.paper.settings.ladderStepPct,.15),.05,2),firstEntry=value*(1-step/100),ask=runtime.quotes[symbol]?.ask;
  if(ask&&ask<=firstEntry)return{ok:false,message:'Цена уже ниже первой лимитки — такой уровень ставить поздно'};
  return{ok:true};
}
function updateManualLevel(value,final=true,force=false){
  const symbol=runtime.symbol,c=editableManualCampaign(symbol);if(!c){if(final)toast('Уровень можно двигать только до первой покупки','error');return false;}
  const next=num(value),valid=force?{ok:next>0}:manualLevelAllowed(symbol,next);if(!valid.ok){if(final)toast(valid.message,'error');return false;}
  c.vLow=next;c.target=next;c.reclaimPrice=next*(1+num(store.paper.settings.reclaimBufferPct,.10)/100);
  for(const l of c.levels)l.price=next*(1-l.depthPct/100);
  const p=store.paper.symbols[symbol].pattern;if(p?.patternId===c.patternId)p.vLow=next;
  if(c.trainingExampleId){const x=store.training.manualExamples.find(v=>v.id===c.trainingExampleId);if(x){x.level=next;x.updatedAt=nowIso();}}
  els.manualGalkaPrice.value=price(next,symbol);if(final)save();renderPaper();updateMarkers();return true;
}
function beginManualMove(p,e){
  const c=editableManualCampaign();if(!c){toast('Двигать уровень можно только до первой покупки','error');setTool('cursor');return;}
  runtime.manualDrag=true;runtime.manualDragOriginal=c.vLow;try{els.drawingCanvas.setPointerCapture(e.pointerId);}catch(_){}
  updateManualLevel(p.price,false);els.manualLevelHint.textContent='Тяни вверх или вниз. Отпусти палец для фиксации.';
}
function applyManualPrice(){
  const value=num(els.manualGalkaPrice.value),c=editableManualCampaign();
  if(c){updateManualLevel(value,true);return;}
  const active=store.paper.symbols[runtime.symbol].campaign;if(active?.qty||active?.levels?.some(x=>x.status==='filled'))return toast('Сначала закрой открытую позицию','error');
  const last=chartRows().at(-1);if(!last)return toast('График ещё не загружен','error');setManualGalka({time:last.time,price:value});
}
function startManualMove(){
  if(!editableManualCampaign())return toast('Сначала установи уровень; после покупки двигать его нельзя','error');
  setTool('manualMove');closeMobileOverlays();toast('Коснись графика и тяни уровень вверх или вниз');
}
'''
js = replace_once(js, anchor, addition, 'manual level editor functions')
js = replace_once(
    js,
    '''  els.manualExamplesCount.textContent=store.training.manualExamples.length;
  els.botTitle.textContent=`Galka ${store.paper.settings.signalMode==='manual'?'manual':'auto'} · ${symbol.replace('USDT','')}`;els.botState.textContent=c?(c.status==='trailing'?'Трейлинг':c.status==='open'?'Позиция':'Лимитки'):p?'Галка выбрана':'Ожидание';''',
    '''  els.manualExamplesCount.textContent=store.training.manualExamples.length;
  const editable=editableManualCampaign(symbol),shownLevel=c?.vLow||(p?.source==='manual'?p.vLow:null);
  if(document.activeElement!==els.manualGalkaPrice)els.manualGalkaPrice.value=shownLevel?price(shownLevel,symbol):'';
  els.moveManualGalka.disabled=!editable;els.cancelManualGalka.disabled=!c;
  els.manualLevelHint.textContent=c?.qty?'Есть покупки: уровень зафиксирован.':editable?'Можно ввести цену или двигать линию вместе со всеми лимитками.':'Укажи цену или выбери уровень на графике.';
  els.botTitle.textContent=`Galka ${store.paper.settings.signalMode==='manual'?'manual':'auto'} · ${symbol.replace('USDT','')}`;els.botState.textContent=c?(c.status==='trailing'?'Трейлинг':c.status==='open'?'Позиция':'Лимитки'):p?'Галка выбрана':'Ожидание';''',
    'render editor state',
)
js = replace_once(
    js,
    '''function openPanel(name){
  document.querySelectorAll('.side-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
  document.querySelectorAll('.side-panel').forEach(p=>p.classList.toggle('active',p.dataset.panelId===name));
}
function openModal(el){el.classList.remove('hidden');}''',
    '''function openPanel(name){
  document.querySelectorAll('.side-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
  document.querySelectorAll('.side-panel').forEach(p=>p.classList.toggle('active',p.dataset.panelId===name));
}
function syncMobileOverlay(){
  const mobile=matchMedia('(max-width:700px)').matches,open=mobile&&(els.sidebar.classList.contains('open')||els.leftbar.classList.contains('open'));
  els.sheetBackdrop.classList.toggle('open',open);
}
function closeMobileOverlays(){els.leftbar.classList.remove('open');els.sidebar.classList.remove('open');syncMobileOverlay();}
function showMobilePanel(name){openPanel(name);els.leftbar.classList.remove('open');els.sidebar.classList.add('open');syncMobileOverlay();}
function openModal(el){el.classList.remove('hidden');}''',
    'mobile overlay helpers',
)
js = replace_once(js, "els.alertBtn.onclick=()=>{openPanel('alerts');els.sidebar.classList.add('open');};", "els.alertBtn.onclick=()=>showMobilePanel('alerts');", 'alert panel')
js = replace_once(
    js,
    '''els.manualGalkaBtn.onclick=()=>{setTool('manualGalka');els.sidebar.classList.remove('open');toast('Коснись уровня галки на графике');};
els.cancelManualGalka.onclick=cancelManualSelection;els.exportManualExamples.onclick=exportManualExamples;''',
    '''els.manualGalkaBtn.onclick=()=>{setTool('manualGalka');closeMobileOverlays();toast('Коснись точной цены уровня на графике');};
els.applyManualGalkaPrice.onclick=applyManualPrice;els.manualGalkaPrice.onkeydown=e=>{if(e.key==='Enter')applyManualPrice();};els.moveManualGalka.onclick=startManualMove;
els.cancelManualGalka.onclick=cancelManualSelection;els.exportManualExamples.onclick=exportManualExamples;
els.closeSidebarSheet.onclick=closeMobileOverlays;els.sheetBackdrop.onclick=closeMobileOverlays;''',
    'level editor events',
)
js = replace_once(
    js,
    "els.toggleTools.onclick=()=>els.leftbar.classList.toggle('open');els.toggleSidebar.onclick=()=>els.sidebar.classList.toggle('open');\ndocument.querySelector('.mobile-nav').onclick=e=>{const b=e.target.closest('[data-mobile-panel]');if(!b)return;const p=b.dataset.mobilePanel;if(p==='tools')els.leftbar.classList.toggle('open');else if(p==='chart'){els.leftbar.classList.remove('open');els.sidebar.classList.remove('open');}else{openPanel(p==='more'?'data':p);els.sidebar.classList.add('open');}};",
    "els.toggleTools.onclick=()=>{els.sidebar.classList.remove('open');els.leftbar.classList.toggle('open');syncMobileOverlay();};els.toggleSidebar.onclick=()=>{els.leftbar.classList.remove('open');els.sidebar.classList.toggle('open');syncMobileOverlay();};\ndocument.querySelector('.mobile-nav').onclick=e=>{const b=e.target.closest('[data-mobile-panel]');if(!b)return;const p=b.dataset.mobilePanel;if(p==='tools'){els.sidebar.classList.remove('open');els.leftbar.classList.toggle('open');syncMobileOverlay();}else if(p==='chart')closeMobileOverlays();else showMobilePanel(p==='more'?'data':p);};",
    'mobile nav behavior',
)
js = replace_once(js, "window.addEventListener('resize',()=>{resizeCanvas();drawAll();});", "window.addEventListener('resize',()=>{resizeCanvas();drawAll();syncMobileOverlay();});", 'resize overlay')
js = replace_once(js, "if(e.key==='Escape'){closeModals();setTool('cursor');els.leftbar.classList.remove('open');els.sidebar.classList.remove('open');}", "if(e.key==='Escape'){closeModals();setTool('cursor');closeMobileOverlays();}", 'escape overlay')
js_path.write_text(js)

check = check_path.read_text()
check = replace_once(
    check,
    "  ['manual Galka selector', /data-tool=\"manualGalka\"/.test(html) && /setManualGalka/.test(js) && /id=\"manualGalkaBtn\"/.test(html)],",
    "  ['manual Galka selector', /data-tool=\"manualGalka\"/.test(html) && /setManualGalka/.test(js) && /id=\"manualGalkaBtn\"/.test(html)],\n  ['exact Galka price editor', /id=\"manualGalkaPrice\"/.test(html) && /applyManualPrice/.test(js) && /updateManualLevel/.test(js)],\n  ['movable Galka ladder', /id=\"moveManualGalka\"/.test(html) && /manualMove/.test(js) && /beginManualMove/.test(js)],\n  ['mobile bottom sheets', /mobile-sheet-head/.test(html) && /sheet-backdrop/.test(html) && /translateY/.test(css) && /showMobilePanel/.test(js)],",
    'new checks',
)
check_path.write_text(check)

print('Applied Galka level editor and mobile UI v1.3')
