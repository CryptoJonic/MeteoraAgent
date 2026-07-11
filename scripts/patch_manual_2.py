#!/usr/bin/env python3
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def rep(s,a,b,n):
 c=s.count(a)
 if c!=1: raise SystemExit(f'{n}: {c}')
 return s.replace(a,b,1)
p=R/'terminal/pro.js';s=p.read_text()
s=rep(s,"const VERSION = 'pro-v1.1.0-reclaim-trail';","const VERSION = 'pro-v1.2.0-manual-galka';",'version')
s=rep(s,"  'campaignCard','fillsCount','levelsList','startingBalance','leverage','symbolNotional','maxHours','exitMode','reclaimBufferPct','trailDistancePct','savePaperSettings',","  'campaignCard','fillsCount','levelsList','manualGalkaBtn','cancelManualGalka','exportManualExamples','manualExamplesCount','startingBalance','leverage','symbolNotional','maxHours','signalMode','ladderStepPct','manualDepthPct','exitMode','reclaimBufferPct','trailDistancePct','savePaperSettings',",'ids')
s=rep(s,"      settings:{startingBalance:1000,leverage:10,symbolNotional:3333.33,maxHours:72,exitMode:'trail',reclaimBufferPct:0.10,trailDistancePct:0.75,makerFee:0.0002,takerFee:0.0005,slippage:0.0002,maintenanceMargin:0.0125},\n      realizedPnl:0,fees:0,trades:[],symbols:Object.fromEntries(SYMBOLS.map(s=>[s,{pattern:null,campaign:null}]))\n    }\n","      settings:{startingBalance:1000,leverage:10,symbolNotional:400,maxHours:72,signalMode:'manual',ladderStepPct:0.15,manualDepthPct:1.50,exitMode:'trail',reclaimBufferPct:0.10,trailDistancePct:0.75,makerFee:0.0002,takerFee:0.0005,slippage:0.0002,maintenanceMargin:0.0125},\n      realizedPnl:0,fees:0,trades:[],symbols:Object.fromEntries(SYMBOLS.map(s=>[s,{pattern:null,campaign:null}]))\n    },\n    training:{manualExamples:[]}\n",'defaults')
s=rep(s,"let store=loadStore();\nfunction save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}","let store=loadStore();\nfunction save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}\nif(num(store.paper.settings.symbolNotional)===3333.33&&!store.paper.trades.length&&!SYMBOLS.some(x=>store.paper.symbols[x].campaign)){store.paper.settings.symbolNotional=400;save();}",'migration')
s=rep(s,"function drawingDown(e){\n  if(['cursor','crosshair'].includes(runtime.tool)||store.ui.drawingsLocked)return;\n  const p=eventPoint(e);if(!p)return;\n  if(runtime.tool==='horizontal'||runtime.tool==='vertical'){addDrawing({type:runtime.tool,p1:p,color:COLORS.blue});return;}","function drawingDown(e){\n  if(['cursor','crosshair'].includes(runtime.tool)||store.ui.drawingsLocked)return;\n  const p=eventPoint(e);if(!p)return;\n  if(runtime.tool==='manualGalka'){setManualGalka(p);return;}\n  if(runtime.tool==='horizontal'||runtime.tool==='vertical'){addDrawing({type:runtime.tool,p1:p,color:COLORS.blue});return;}",'click')
s=rep(s,"function scanRecentPatterns(){\n  for(const s of SYMBOLS){\n    const rows=botRows(s);let found=null;\n    for(let i=Math.max(14,rows.length-350);i<rows.length-4;i++){const p=evaluatePattern(rows,i,s);if(p)found=p;}\n    if(found&&(Date.now()/1000-found.confirmedTime)/3600<=336)store.paper.symbols[s].pattern=found;\n  }save();renderPaper();\n}\nfunction detectLatestPattern(symbol){\n  const rows=botRows(symbol),i=rows.length-5,p=evaluatePattern(rows,i,symbol);if(!p)return;\n  const ss=store.paper.symbols[symbol];if(ss.pattern?.patternId!==p.patternId){ss.pattern=p;save();renderPaper();updateMarkers();}\n}\n","function scanRecentPatterns(){\n  if(store.paper.settings.signalMode!=='auto')return;\n  for(const s of SYMBOLS){\n    const rows=botRows(s);let found=null;\n    for(let i=Math.max(14,rows.length-350);i<rows.length-4;i++){const p=evaluatePattern(rows,i,s);if(p)found=p;}\n    if(found&&!store.paper.symbols[s].campaign&&(Date.now()/1000-found.confirmedTime)/3600<=336)store.paper.symbols[s].pattern=found;\n  }save();renderPaper();\n}\nfunction detectLatestPattern(symbol){\n  if(store.paper.settings.signalMode!=='auto')return;\n  const rows=botRows(symbol),i=rows.length-5,p=evaluatePattern(rows,i,symbol);if(!p)return;\n  const ss=store.paper.symbols[symbol];if(!ss.campaign&&ss.pattern?.patternId!==p.patternId){ss.pattern=p;save();renderPaper();updateMarkers();}\n}\n",'auto guard')
old="""function createCampaign(symbol,p){
  const st=store.paper.settings,maxNotional=st.symbolNotional;
  return{campaignId:`C-${symbol}-${Date.now()}`,symbol,patternId:p.patternId,status:'waiting',vLow:p.vLow,target:p.vLow,createdAt:nowIso(),expiresAt:Date.now()+st.maxHours*3600000,
    exitMode:st.exitMode||'trail',reclaimPrice:p.vLow*(1+num(st.reclaimBufferPct,.10)/100),trailArmed:false,trailHigh:null,trailStop:null,trailActivatedAt:null,
    levels:DEPTHS.map((d,i)=>({index:i+1,depthPct:d,weight:WEIGHTS[i],price:p.vLow*(1-d/100),notional:maxNotional*WEIGHTS[i],status:'pending',fillPrice:null,fillTime:null,qty:0,fee:0})),
    qty:0,filledNotional:0,averageEntry:null,entryFees:0,unrealizedPnl:0};
}
"""
new="""function campaignLadder(st,p){
  if(p.source!=='manual')return{depths:DEPTHS.slice(),weights:WEIGHTS.slice()};
  const step=clamp(num(st.ladderStepPct,.15),.05,2),depth=clamp(num(st.manualDepthPct,1.5),step,10);
  const count=Math.max(1,Math.floor(depth/step+1e-9)),depths=Array.from({length:count},(_,i)=>Number(((i+1)*step).toFixed(4)));
  return{depths,weights:depths.map(()=>1/depths.length)};
}
function createCampaign(symbol,p){
  const st=store.paper.settings,maxNotional=st.symbolNotional,{depths,weights}=campaignLadder(st,p);
  return{campaignId:`C-${symbol}-${Date.now()}`,symbol,patternId:p.patternId,source:p.source||'auto',trainingExampleId:p.trainingExampleId||null,status:'waiting',vLow:p.vLow,target:p.vLow,createdAt:nowIso(),expiresAt:Date.now()+st.maxHours*3600000,
    exitMode:st.exitMode||'trail',reclaimPrice:p.vLow*(1+num(st.reclaimBufferPct,.10)/100),trailArmed:false,trailHigh:null,trailStop:null,trailActivatedAt:null,
    levels:depths.map((d,i)=>({index:i+1,depthPct:d,weight:weights[i],price:p.vLow*(1-d/100),notional:maxNotional*weights[i],status:'pending',fillPrice:null,fillTime:null,qty:0,fee:0})),
    qty:0,filledNotional:0,averageEntry:null,entryFees:0,unrealizedPnl:0};
}
function setManualGalka(p){
  const symbol=runtime.symbol,ss=store.paper.symbols[symbol],active=ss.campaign;
  if(active?.qty){toast('Сначала закрой открытую позицию по этой монете','error');setTool('cursor');return;}
  if(active?.trainingExampleId){const old=store.training.manualExamples.find(x=>x.id===active.trainingExampleId);if(old)old.status='superseded';}
  const rows=chartRows(),idx=nearestIndex(rows,p.time),id='M-'+symbol+'-'+Date.now(),context=rows.slice(Math.max(0,idx-39),idx+1).map(c=>({time:c.time,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume}));
  const pattern={patternId:id,source:'manual',trainingExampleId:id,vLow:p.price,vLowTime:p.time,confirmedTime:p.time,atr:atrValue(rows,idx,14)||Math.max(p.price*.001,1e-9),dropAtr:0,recovery:0,status:'trading',createdAt:nowIso()};
  store.training.manualExamples.push({id,symbol,interval:runtime.interval,level:p.price,selectedCandleTime:p.time,selectedAt:nowIso(),status:'active',context});
  ss.pattern=pattern;ss.campaign=createCampaign(symbol,pattern);save();renderPaper();updateMarkers();setTool('cursor');openPanel('paper');els.sidebar.classList.add('open');
  toast(`${symbol}: уровень галки ${price(p.price,symbol)}, лимитки выставлены`,'alert');
}
function cancelManualSelection(){
  const ss=store.paper.symbols[runtime.symbol],c=ss.campaign;
  if(c?.qty)return toast('Нельзя снять уровень: уже есть покупки','error');
  if(c?.trainingExampleId){const x=store.training.manualExamples.find(v=>v.id===c.trainingExampleId);if(x)x.status='cancelled';}
  ss.campaign=null;if(ss.pattern?.source==='manual')ss.pattern.status='cancelled';save();renderPaper();updateMarkers();toast('Ручной уровень снят');
}
function exportManualExamples(){
  const payload={version:VERSION,exportedAt:nowIso(),examples:store.training.manualExamples};
  download(`galka-manual-examples-${Date.now()}.json`,new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
}
"""
s=rep(s,old,new,'manual engine')
p.write_text(s)
