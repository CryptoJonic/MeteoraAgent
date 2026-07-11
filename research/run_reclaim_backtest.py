#!/usr/bin/env python3
"""Galka long-only target vs reclaim-trailing historical replay.
Public Binance USD-M 15m archives; no keys and no orders.
Portfolio is split into three equal isolated paper sleeves ($333.33 each), one
for BTC, ETH and SOL. This prevents one coin from consuming the other sleeves.
"""
from __future__ import annotations
import io,json,sys,time,zipfile
from datetime import date,datetime,timedelta,timezone
from pathlib import Path
import numpy as np,pandas as pd,requests
import run_candidate as rc

SYMBOLS=("BTCUSDT","ETHUSDT","SOLUSDT")
DEPTHS=np.array([.25,.70,1.25,1.90,2.65,3.50])/100
WEIGHTS=np.array([.05,.09,.14,.18,.24,.30])
START=1000.0; SLEEVE=START/3; LEV=10; MAXB=72*4
MAKER=.0002; TAKER=.0005; SLIP=.0002; MAINT=.0125; BUFFER=.001
BASE="https://data.binance.vision/data/futures/um"

def iso(x):return pd.Timestamp(x).isoformat().replace('+00:00','Z')
def history(symbol,start,end,cache):
 cache=cache/symbol;cache.mkdir(parents=True,exist_ok=True);s=requests.Session();s.headers['User-Agent']='GalkaBacktest/1.0';parts=[];cur=date(end.year,end.month,1)
 for m in rc.months(start,cur-timedelta(days=1)):
  stamp=m.strftime('%Y-%m');fn=f'{symbol}-15m-{stamp}.zip';p=cache/fn;blob=p.read_bytes() if p.exists() else rc.get(s,f'{BASE}/monthly/klines/{symbol}/15m/{fn}')
  if blob is None:continue
  if not p.exists():p.write_bytes(blob)
  try:parts.append(rc.parse(blob))
  except Exception as e:print('WARN',fn,e,file=sys.stderr)
 d=max(start,cur)
 while d<=end:
  stamp=d.isoformat();fn=f'{symbol}-15m-{stamp}.zip';p=cache/fn;blob=p.read_bytes() if p.exists() else rc.get(s,f'{BASE}/daily/klines/{symbol}/15m/{fn}')
  if blob is not None:
   if not p.exists():p.write_bytes(blob)
   try:parts.append(rc.parse(blob))
   except Exception as e:print('WARN',fn,e,file=sys.stderr)
  d+=timedelta(days=1)
 if not parts:raise RuntimeError('No data '+symbol)
 x=pd.concat(parts).sort_values('time').drop_duplicates('time');return x[(x.time.dt.date>=start)&(x.time.dt.date<=end)].reset_index(drop=True)

def simulate(d,ev,symbol,mode,trail_pct,notional):
 lo=d.low.to_numpy(float);hi=d.high.to_numpy(float);cl=d.close.to_numpy(float);times=d.time.tolist();bal=SLEEVE;trades=[];last_exit=-1;liq=0
 for e in sorted(ev.itertuples(index=False),key=lambda x:x.break_index):
  if e.break_index<=last_exit or bal<=0:continue
  levels=e.v_low_price*(1-DEPTHS);sizes=notional*WEIGHTS;filled=np.zeros(6,bool);qtys=np.zeros(6);fees=np.zeros(6);first=None;armed=False;highwater=None;stop=None;expiry=e.break_index+MAXB;reason='unfilled';ex=None;exitpx=None
  for i in range(e.break_index,min(len(d),expiry+1)):
   qty=qtys.sum();avg=(qtys*levels).sum()/qty if qty else None;filled_not=(qtys*levels).sum()
   if qty and bal+qty*(lo[i]-avg)<=filled_not*MAINT:
    exitpx=lo[i]*(1-SLIP);fee=qty*exitpx*TAKER;bal=max(0.0,bal+qty*(exitpx-avg)-fee);reason='liquidation';ex=i;liq+=1;break
   if qty and armed and lo[i]<=stop:
    exitpx=stop*(1-SLIP);fee=qty*exitpx*TAKER;bal=max(0.0,bal+qty*(exitpx-avg)-fee);reason='trail_stop';ex=i;break
   if qty and mode=='target' and i>first and hi[i]>=e.v_low_price:
    exitpx=e.v_low_price;fee=qty*exitpx*MAKER;bal=max(0.0,bal+qty*(exitpx-avg)-fee);reason='target';ex=i;break
   if not armed:
    for k,p in enumerate(levels):
     if not filled[k] and lo[i]<=p:
      need=sizes[k]/LEV+sizes[k]*MAKER
      if bal-filled_not/LEV<need:continue
      filled[k]=1;qtys[k]=sizes[k]/p;fees[k]=sizes[k]*MAKER;bal-=fees[k];first=i if first is None else first
   qty=qtys.sum();avg=(qtys*levels).sum()/qty if qty else None
   if qty and i>first and mode=='trail':
    if not armed and hi[i]>=e.v_low_price*(1+BUFFER):armed=True;highwater=hi[i];stop=e.v_low_price;expiry=i+MAXB
    elif armed:highwater=max(highwater,hi[i]);stop=max(stop,e.v_low_price,highwater*(1-trail_pct/100))
   if i>=expiry:
    if qty:exitpx=cl[i]*(1-SLIP);fee=qty*exitpx*TAKER;bal=max(0.0,bal+qty*(exitpx-avg)-fee);reason='time_exit'
    ex=i;break
  if ex is None:
   ex=len(d)-1;qty=qtys.sum();avg=(qtys*levels).sum()/qty if qty else None
   if qty:exitpx=cl[ex]*(1-SLIP);fee=qty*exitpx*TAKER;bal=max(0.0,bal+qty*(exitpx-avg)-fee);reason='data_end'
  last_exit=ex
  if qtys.sum():
   avg=(qtys*levels).sum()/qtys.sum();prev=trades[-1]['balance'] if trades else SLEEVE;pnl=bal-prev
   trades.append({'symbol':symbol,'pattern_id':e.pattern_id,'entry_time':iso(times[first]),'exit_time':iso(times[ex]),'levels':int(filled.sum()),'average_entry':avg,'exit_price':exitpx,'net_pnl':pnl,'balance':bal,'reason':reason,'trail_high':highwater,'trail_stop':stop})
  if bal<=0:break
 return trades,{'ending':bal,'return_pct':(bal/SLEEVE-1)*100,'trades':len(trades),'liquidations':liq}

def metrics(trades,end):
 if not trades:return {'ending_equity':end,'return_pct':(end/START-1)*100,'trades':0}
 t=pd.DataFrame(trades);r=t.net_pnl.to_numpy(float);curve=START+np.cumsum(r);peak=np.maximum.accumulate(np.r_[START,curve]);vals=np.r_[START,curve];dd=vals/peak-1;gp=r[r>0].sum();gl=-r[r<0].sum()
 return {'ending_equity':float(end),'return_pct':float((end/START-1)*100),'minimum_equity':float(vals.min()),'max_drawdown_pct':float(dd.min()*100),'trades':len(t),'wins':int((r>0).sum()),'losses':int((r<0).sum()),'win_rate_pct':float((r>0).mean()*100),'profit_factor':float(gp/gl) if gl else 999.0,'liquidations':int((t.reason=='liquidation').sum()),'fees_model':'maker 2 bps, taker 5 bps, slippage 2 bps'}

def run(frames,events,name,mode,trail,notional):
 alltr=[];sleeves={}
 for sym in SYMBOLS:
  tr,ss=simulate(frames[sym],events[sym],sym,mode,trail,notional);alltr+=tr;sleeves[sym]=ss
 alltr=sorted(alltr,key=lambda x:x['exit_time']);end=sum(x['ending'] for x in sleeves.values());m=metrics(alltr,end);m.update({'variant':name,'mode':mode,'trail_pct':trail if mode=='trail' else None,'notional_per_symbol':notional,'sleeves':sleeves})
 curve=[];eq=START
 for tr in alltr:eq+=tr['net_pnl'];curve.append({'time':tr['exit_time'],'equity':eq,'symbol':tr['symbol'],'pnl':tr['net_pnl'],'reason':tr['reason']})
 return m,alltr,curve

def main():
 start=date(2020,1,1);end=datetime.now(timezone.utc).date()-timedelta(days=1);cache=Path('.cache/binance');out=Path('results/reclaim_backtest');out.mkdir(parents=True,exist_ok=True);frames={};events={}
 for sym in SYMBOLS:
  print('LOAD',sym,flush=True);d=rc.features(history(sym,start,end,cache));e=rc.detect(d);e['pattern_id']=sym+'-'+e.pattern_id.astype(str);frames[sym]=d;events[sym]=e;print(sym,len(d),len(e),flush=True)
 variants=[('target_3333','target',0,3333.33),('trail075_3333','trail',.75,3333.33),('trail050_3333','trail',.5,3333.33),('trail100_3333','trail',1,3333.33),('trail150_3333','trail',1.5,3333.33),('trail075_2000','trail',.75,2000),('trail075_1000','trail',.75,1000),('trail075_500','trail',.75,500),('trail075_400','trail',.75,400),('trail075_300','trail',.75,300),('trail075_250','trail',.75,250),('trail075_200','trail',.75,200)]
 summaries=[];curves={};alltr=[]
 for v in variants:
  print('RUN',v[0],flush=True);m,tr,c=run(frames,events,*v);summaries.append(m);curves[v[0]]=c
  for x in tr:x['variant']=v[0]
  alltr+=tr;print(json.dumps(m,ensure_ascii=False),flush=True)
 payload={'created_at':datetime.now(timezone.utc).isoformat(),'data_start':str(start),'data_end':str(end),'symbols':SYMBOLS,'timeframe':'15m','starting_deposit':START,'allocation':'three equal isolated sleeves','intrabar_policy':'existing stop checked before current bar high; new stop effective next bar','variants':summaries,'curves':curves}
 (out/'backtest.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'),default=str));(out/'summary.json').write_text(json.dumps({'meta':{k:payload[k] for k in ['created_at','data_start','data_end','symbols','timeframe','starting_deposit','allocation','intrabar_policy']},'variants':summaries},ensure_ascii=False,indent=2));pd.DataFrame(alltr).to_csv(out/'trades.csv',index=False)
 lines=['# Reclaim trailing backtest','','| Variant | End | Return | Max DD | Trades | Win rate | PF | Liquidations |','|---|---:|---:|---:|---:|---:|---:|---:|']
 for m in summaries:lines.append(f"| {m['variant']} | ${m['ending_equity']:.2f} | {m['return_pct']:.2f}% | {m.get('max_drawdown_pct',0):.2f}% | {m['trades']} | {m.get('win_rate_pct',0):.2f}% | {m.get('profit_factor',0):.2f} | {m.get('liquidations',0)} |")
 (out/'REPORT.md').write_text('\n'.join(lines)+'\n')
if __name__=='__main__':main()
