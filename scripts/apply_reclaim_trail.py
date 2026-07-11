#!/usr/bin/env python3
from pathlib import Path


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
doc_path = root / "docs/RECLAIM_TRAILING_EXIT.md"

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")
check = check_path.read_text(encoding="utf-8")

if "id=\"exitMode\"" not in html:
    html = replace_once(
        html,
        """            <label>Депозит<input id=\"startingBalance\" type=\"number\" min=\"100\" step=\"100\"></label>\n            <label>Плечо<input id=\"leverage\" type=\"number\" min=\"1\" max=\"20\"></label>\n            <label>Номинал / монету<input id=\"symbolNotional\" type=\"number\" min=\"100\" step=\"100\"></label>\n            <label>Макс. часов<input id=\"maxHours\" type=\"number\" min=\"1\" max=\"336\"></label>\n            <button id=\"savePaperSettings\">Сохранить</button>\n""",
        """            <label>Депозит<input id=\"startingBalance\" type=\"number\" min=\"100\" step=\"100\"></label>\n            <label>Плечо<input id=\"leverage\" type=\"number\" min=\"1\" max=\"20\"></label>\n            <label>Номинал / монету<input id=\"symbolNotional\" type=\"number\" min=\"100\" step=\"100\"></label>\n            <label>Макс. часов<input id=\"maxHours\" type=\"number\" min=\"1\" max=\"336\"></label>\n            <label>Режим выхода<select id=\"exitMode\"><option value=\"trail\">Reclaim trail</option><option value=\"target\">Фиксация на V-low</option></select></label>\n            <label>Пробой V-low, %<input id=\"reclaimBufferPct\" type=\"number\" min=\"0\" max=\"5\" step=\"0.05\"></label>\n            <label>Трейлинг от максимума, %<input id=\"trailDistancePct\" type=\"number\" min=\"0.05\" max=\"10\" step=\"0.05\"></label>\n            <button id=\"savePaperSettings\">Сохранить</button>\n""",
        "paper settings controls",
    )

css = css.replace(
    ".form-grid input{width:100%;height:34px;margin-top:3px;border-radius:4px;padding:0 6px}",
    ".form-grid input,.form-grid select{width:100%;height:34px;margin-top:3px;border-radius:4px;padding:0 6px}",
)

if "trailDistancePct" not in js:
    js = replace_once(js, "const VERSION = 'pro-v1.0.0';", "const VERSION = 'pro-v1.1.0-reclaim-trail';", "version")
    js = replace_once(
        js,
        "'campaignCard','fillsCount','levelsList','startingBalance','leverage','symbolNotional','maxHours','savePaperSettings',",
        "'campaignCard','fillsCount','levelsList','startingBalance','leverage','symbolNotional','maxHours','exitMode','reclaimBufferPct','trailDistancePct','savePaperSettings',",
        "element registry",
    )
    js = replace_once(
        js,
        "settings:{startingBalance:1000,leverage:10,symbolNotional:3333.33,maxHours:72,makerFee:0.0002,takerFee:0.0005,slippage:0.0002,maintenanceMargin:0.0125}",
        "settings:{startingBalance:1000,leverage:10,symbolNotional:3333.33,maxHours:72,exitMode:'trail',reclaimBufferPct:0.10,trailDistancePct:0.75,makerFee:0.0002,takerFee:0.0005,slippage:0.0002,maintenanceMargin:0.0125}",
        "default paper settings",
    )
    js = replace_once(
        js,
        "mainChart:null,priceSeries:null,markerApi:null,compareSeries:null,",
        "mainChart:null,priceSeries:null,markerApi:null,compareSeries:null,paperLines:[],",
        "runtime paper lines",
    )
    js = replace_once(
        js,
        """  return{campaignId:`C-${symbol}-${Date.now()}`,symbol,patternId:p.patternId,status:'waiting',vLow:p.vLow,target:p.vLow,createdAt:nowIso(),expiresAt:Date.now()+st.maxHours*3600000,\n    levels:DEPTHS.map((d,i)=>({index:i+1,depthPct:d,weight:WEIGHTS[i],price:p.vLow*(1-d/100),notional:maxNotional*WEIGHTS[i],status:'pending',fillPrice:null,fillTime:null,qty:0,fee:0})),\n    qty:0,filledNotional:0,averageEntry:null,entryFees:0,unrealizedPnl:0};\n""",
        """  return{campaignId:`C-${symbol}-${Date.now()}`,symbol,patternId:p.patternId,status:'waiting',vLow:p.vLow,target:p.vLow,createdAt:nowIso(),expiresAt:Date.now()+st.maxHours*3600000,\n    exitMode:st.exitMode||'trail',reclaimPrice:p.vLow*(1+num(st.reclaimBufferPct,.10)/100),trailArmed:false,trailHigh:null,trailStop:null,trailActivatedAt:null,\n    levels:DEPTHS.map((d,i)=>({index:i+1,depthPct:d,weight:WEIGHTS[i],price:p.vLow*(1-d/100),notional:maxNotional*WEIGHTS[i],status:'pending',fillPrice:null,fillTime:null,qty:0,fee:0})),\n    qty:0,filledNotional:0,averageEntry:null,entryFees:0,unrealizedPnl:0};\n""",
        "campaign fields",
    )
    js = replace_once(
        js,
        "reason,vLow:c.vLow};",
        "reason,vLow:c.vLow,exitMode:c.exitMode||'target',trailActivatedAt:c.trailActivatedAt||null,trailHigh:c.trailHigh||null,trailStop:c.trailStop||null};",
        "trade audit fields",
    )
    old_process = """function processBotQuote(symbol){\n  const q=runtime.quotes[symbol];if(!q.bid||!q.ask)return;\n  const ss=store.paper.symbols[symbol],p=ss.pattern;let changed=false;\n  if(!ss.campaign&&p&&p.status==='watching'){\n    const age=(Date.now()/1000-p.confirmedTime)/3600;\n    if(age<=336&&q.bid<p.vLow-.10*p.atr){ss.campaign=createCampaign(symbol,p);p.status='trading';changed=true;}\n  }\n  const c=ss.campaign;\n  if(c&&['waiting','open'].includes(c.status)){\n    for(const l of c.levels)if(l.status==='pending'&&q.ask<=l.price){\n      l.status='filled';l.fillPrice=l.price;l.fillTime=nowIso();l.qty=l.notional/l.fillPrice;l.fee=l.notional*store.paper.settings.makerFee;c.status='open';changed=true;\n    }\n    recalcCampaign(c);\n    if(c.qty&&q.bid>=c.target){closeCampaign(symbol,c.target,'v_low_target');return;}\n    if(Date.now()>=c.expiresAt){if(c.qty)closeCampaign(symbol,q.bid,'time_exit');else{ss.campaign=null;p.status='expired';changed=true;}}\n  }\n  if(changed){save();renderPaper();updateMarkers();}\n  checkGlobalLiquidation();\n}\n"""
    new_process = """function processBotQuote(symbol){\n  const q=runtime.quotes[symbol];if(!q.bid||!q.ask)return;\n  const ss=store.paper.symbols[symbol],p=ss.pattern;let changed=false;\n  if(!ss.campaign&&p&&p.status==='watching'){\n    const age=(Date.now()/1000-p.confirmedTime)/3600;\n    if(age<=336&&q.bid<p.vLow-.10*p.atr){ss.campaign=createCampaign(symbol,p);p.status='trading';changed=true;}\n  }\n  const c=ss.campaign;\n  if(c&&['waiting','open','trailing'].includes(c.status)){\n    if(!c.trailArmed)for(const l of c.levels)if(l.status==='pending'&&q.ask<=l.price){\n      l.status='filled';l.fillPrice=l.price;l.fillTime=nowIso();l.qty=l.notional/l.fillPrice;l.fee=l.notional*store.paper.settings.makerFee;c.status='open';changed=true;\n    }\n    recalcCampaign(c);\n    if(c.qty){\n      const st=store.paper.settings,mode=c.exitMode||st.exitMode||'trail';\n      if(mode==='target'){\n        if(q.bid>=c.target){closeCampaign(symbol,c.target,'v_low_target');return;}\n      }else{\n        const reclaimPrice=c.reclaimPrice||c.vLow*(1+num(st.reclaimBufferPct,.10)/100);\n        if(!c.trailArmed&&q.bid>=reclaimPrice){\n          c.trailArmed=true;c.status='trailing';c.trailHigh=q.bid;c.trailStop=c.vLow;c.trailActivatedAt=nowIso();\n          c.expiresAt=Date.now()+st.maxHours*3600000;changed=true;toast(`${symbol}: trailing активирован, стоп ${price(c.trailStop,symbol)}`,'alert');\n        }\n        if(c.trailArmed){\n          const oldHigh=num(c.trailHigh,q.bid),newHigh=Math.max(oldHigh,q.bid);\n          if(newHigh>oldHigh){c.trailHigh=newHigh;changed=true;}\n          const distance=clamp(num(st.trailDistancePct,.75),.05,10)/100;\n          const nextStop=Math.max(c.vLow,newHigh*(1-distance));\n          if(nextStop>num(c.trailStop,c.vLow)){c.trailStop=nextStop;changed=true;}\n          if(q.bid<=c.trailStop){closeCampaign(symbol,q.bid,'reclaim_trailing_stop');return;}\n        }\n      }\n    }\n    if(Date.now()>=c.expiresAt){if(c.qty)closeCampaign(symbol,q.bid,'time_exit');else{ss.campaign=null;p.status='expired';changed=true;}}\n  }\n  if(changed){save();renderPaper();updateMarkers();}\n  checkGlobalLiquidation();\n}\n"""
    js = replace_once(js, old_process, new_process, "paper quote processing")
    js = replace_once(
        js,
        "els.botTitle.textContent=`Galka bot · ${symbol.replace('USDT','')}`;els.botState.textContent=c?(c.status==='open'?'Позиция':'Лимитки'):p?'Галка найдена':'Ожидание';",
        "els.botTitle.textContent=`Galka bot · ${symbol.replace('USDT','')}`;els.botState.textContent=c?(c.status==='trailing'?'Трейлинг':c.status==='open'?'Позиция':'Лимитки'):p?'Галка найдена':'Ожидание';",
        "paper state label",
    )
    js = replace_once(
        js,
        """    els.campaignCard.innerHTML=`<div><b>${esc(c.status.toUpperCase())}</b> · V-low ${price(c.vLow)}</div><div>Средний вход: <b>${price(c.averageEntry)}</b></div><div>Номинал: <b>${money(c.filledNotional)}</b> · PnL <b class=\"${c.unrealizedPnl>=0?'up':'down'}\">${signedMoney(c.unrealizedPnl)}</b></div>`;\n""",
        """    const trail=c.trailArmed?`<div>Максимум: <b>${price(c.trailHigh)}</b></div><div>Trailing-stop: <b class=\"up\">${price(c.trailStop)}</b></div>`:`<div>Активация trail: <b>${price(c.reclaimPrice||c.vLow)}</b></div>`;\n    els.campaignCard.innerHTML=`<div><b>${esc(c.status.toUpperCase())}</b> · V-low ${price(c.vLow)}</div><div>Средний вход: <b>${price(c.averageEntry)}</b></div><div>Выход: <b>${c.exitMode==='target'?'V-low target':'Reclaim trail'}</b></div>${trail}<div>Номинал: <b>${money(c.filledNotional)}</b> · PnL <b class=\"${c.unrealizedPnl>=0?'up':'down'}\">${signedMoney(c.unrealizedPnl)}</b></div>`;\n""",
        "paper campaign card",
    )
    js = replace_once(
        js,
        "function updateMarkers(){\n  if(!runtime.priceSeries)return;const markers=[],symbol=runtime.symbol,ss=store.paper.symbols[symbol],p=ss.pattern,c=ss.campaign;",
        "function updateMarkers(){\n  if(!runtime.priceSeries)return;\n  for(const line of runtime.paperLines){try{runtime.priceSeries.removePriceLine(line);}catch(_){}}runtime.paperLines=[];\n  const addPaperLine=(value,color,title)=>{if(value>0)runtime.paperLines.push(runtime.priceSeries.createPriceLine({price:value,color,lineWidth:2,lineStyle:LWC.LineStyle.Dashed,axisLabelVisible:true,title}));};\n  const markers=[],symbol=runtime.symbol,ss=store.paper.symbols[symbol],p=ss.pattern,c=ss.campaign;\n  if(p)addPaperLine(p.vLow,COLORS.blue,'V-low');\n  if(c?.trailArmed&&c.trailStop)addPaperLine(c.trailStop,COLORS.red,'TRAIL STOP');",
        "paper price lines",
    )
    js = replace_once(
        js,
        "els.startingBalance.value=store.paper.settings.startingBalance;els.leverage.value=store.paper.settings.leverage;els.symbolNotional.value=store.paper.settings.symbolNotional;els.maxHours.value=store.paper.settings.maxHours;",
        "els.startingBalance.value=store.paper.settings.startingBalance;els.leverage.value=store.paper.settings.leverage;els.symbolNotional.value=store.paper.settings.symbolNotional;els.maxHours.value=store.paper.settings.maxHours;els.exitMode.value=store.paper.settings.exitMode;els.reclaimBufferPct.value=store.paper.settings.reclaimBufferPct;els.trailDistancePct.value=store.paper.settings.trailDistancePct;",
        "settings form initialization",
    )
    js = replace_once(
        js,
        "els.savePaperSettings.onclick=()=>{const s=store.paper.settings;s.startingBalance=Math.max(100,num(els.startingBalance.value,1000));s.leverage=clamp(num(els.leverage.value,10),1,20);s.symbolNotional=clamp(num(els.symbolNotional.value,3333.33),100,10000);s.maxHours=clamp(num(els.maxHours.value,72),1,336);save();renderPaper();toast('Paper-настройки сохранены');};",
        "els.savePaperSettings.onclick=()=>{const s=store.paper.settings;s.startingBalance=Math.max(100,num(els.startingBalance.value,1000));s.leverage=clamp(num(els.leverage.value,10),1,20);s.symbolNotional=clamp(num(els.symbolNotional.value,3333.33),100,10000);s.maxHours=clamp(num(els.maxHours.value,72),1,336);s.exitMode=els.exitMode.value==='target'?'target':'trail';s.reclaimBufferPct=clamp(num(els.reclaimBufferPct.value,.10),0,5);s.trailDistancePct=clamp(num(els.trailDistancePct.value,.75),.05,10);save();renderPaper();toast('Paper-настройки сохранены');};",
        "save paper settings",
    )

if "reclaim trailing exit" not in check.lower():
    check = replace_once(
        check,
        "  ['paper account', /startingBalance:1000/.test(js) && /symbolNotional:3333\\.33/.test(js)],\n",
        "  ['paper account', /startingBalance:1000/.test(js) && /symbolNotional:3333\\.33/.test(js)],\n  ['reclaim trailing exit', /id=\"exitMode\"/.test(html) && /trailDistancePct:0\\.75/.test(js) && /reclaim_trailing_stop/.test(js)],\n  ['trail never below V-low', /Math\\.max\\(c\\.vLow,newHigh\\*\\(1-distance\\)\\)/.test(js)],\n  ['visible trailing stop', /TRAIL STOP/.test(js) && /trailStop/.test(js)],\n",
        "pro terminal checks",
    )

doc_path.write_text("""# Reclaim trailing exit\n\nThe Galka paper bot remains long-only. New campaigns use `Reclaim trail` by default.\n\n1. The bot fills the six planned long limits below V-low.\n2. It does not close on the first return to V-low.\n3. Trailing mode activates after bid reaches `V-low + reclaimBufferPct` (default 0.10%).\n4. Initial stop is V-low.\n5. The high-water mark records the highest bid after activation.\n6. The stop is `max(V-low, high-water mark × (1 − trailDistancePct))` (default distance 0.75%).\n7. The stop may rise but can never fall.\n8. A stop hit exits with taker fee and configured slippage.\n9. Activation resets the holding timer, giving the trail the configured maximum holding period.\n10. The legacy immediate V-low target remains selectable for A/B comparison.\n\nThis is paper execution only and must be evaluated historically before live capital is considered.\n""", encoding="utf-8")

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")
check_path.write_text(check, encoding="utf-8")
print("Applied reclaim trailing exit patch")
