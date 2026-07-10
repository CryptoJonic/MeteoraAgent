#!/usr/bin/env python3
"""Re-run the selected Galka BTC 15m paper candidate on Binance history.

No keys, no orders, no live trading. Output is a terminal-ready .galka.zip.
"""
from __future__ import annotations
import argparse, io, json, sys, time, zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import numpy as np
import pandas as pd
import requests

BASE="https://data.binance.vision/data/futures/um"
COLS=["open_time","open","high","low","close","volume","close_time","quote_volume","trades","taker_buy_base","taker_buy_quote","ignore"]
CFG={"left":4,"right":4,"drop_atr":1.5,"recovery":0.65,"break_atr":0.10,"entry_pct":0.01,"entry_expiry_h":24,"long_h":6,"failure_atr":2.0,"short_target_pct":0.02,"short_h":24,"fee_bps":5.0,"slippage_bps":2.0}
BPH=4


def iso(x): return pd.Timestamp(x).isoformat().replace("+00:00","Z")

def get(session,url,retries=4):
    for n in range(retries):
        try:
            r=session.get(url,timeout=60)
            if r.status_code==404:return None
            r.raise_for_status();return r.content
        except requests.RequestException as e:
            if n==retries-1: print(f"WARN {url}: {e}",file=sys.stderr);return None
            time.sleep(2**n)

def parse(blob):
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        name=next((x for x in z.namelist() if x.endswith('.csv')),None)
        if not name: raise ValueError('no csv in archive')
        raw=z.read(name)
    d=pd.read_csv(io.BytesIO(raw),header=None,names=COLS,low_memory=False)
    d['open_time']=pd.to_numeric(d['open_time'],errors='coerce')
    for c in ['open','high','low','close','volume']: d[c]=pd.to_numeric(d[c],errors='coerce')
    d=d.dropna(subset=['open_time','open','high','low','close','volume'])
    div=1_000_000 if d.open_time.median()>1e14 else 1_000
    d['time']=pd.to_datetime(d.open_time/div,unit='s',utc=True)
    return d[['time','open','high','low','close','volume']]

def months(a,b):
    x=date(a.year,a.month,1);end=date(b.year,b.month,1)
    while x<=end:
        yield x
        x=date(x.year+(x.month==12),1 if x.month==12 else x.month+1,1)

def history(start,end,cache):
    cache.mkdir(parents=True,exist_ok=True);s=requests.Session();s.headers['User-Agent']='GalkaResearch/1.0';parts=[]
    current=date(end.year,end.month,1)
    for m in months(start,current-timedelta(days=1)):
        stamp=m.strftime('%Y-%m');fn=f'BTCUSDT-15m-{stamp}.zip';p=cache/fn
        blob=p.read_bytes() if p.exists() else get(s,f'{BASE}/monthly/klines/BTCUSDT/15m/{fn}')
        if blob is None:continue
        if not p.exists():p.write_bytes(blob)
        try:parts.append(parse(blob))
        except Exception as e:print(f'WARN parse {fn}: {e}',file=sys.stderr)
    d=max(start,current)
    while d<=end:
        stamp=d.isoformat();fn=f'BTCUSDT-15m-{stamp}.zip';p=cache/fn
        blob=p.read_bytes() if p.exists() else get(s,f'{BASE}/daily/klines/BTCUSDT/15m/{fn}')
        if blob is not None:
            if not p.exists():p.write_bytes(blob)
            try:parts.append(parse(blob))
            except Exception as e:print(f'WARN parse {fn}: {e}',file=sys.stderr)
        d+=timedelta(days=1)
    if not parts:raise RuntimeError('No Binance data')
    x=pd.concat(parts).sort_values('time').drop_duplicates('time')
    return x[(x.time.dt.date>=start)&(x.time.dt.date<=end)].reset_index(drop=True)

def features(d):
    p=d.close.shift();tr=pd.concat([d.high-d.low,(d.high-p).abs(),(d.low-p).abs()],axis=1).max(axis=1)
    d=d.copy();d['atr']=tr.rolling(14,min_periods=14).mean();d['vol_ratio']=d.volume/d.volume.shift().rolling(20,min_periods=10).median();d['ret24']=d.close.pct_change(96);return d

def detect(d):
    lo=d.low.to_numpy(float);hi=d.high.to_numpy(float);atr=d.atr.to_numpy(float);times=d.time.tolist();vol=d.vol_ratio.to_numpy(float);ret=d.ret24.to_numpy(float)
    out=[];last=-9999;L=CFG['left'];R=CFG['right'];wait=14*24*BPH
    for i in range(L,len(d)-R-1):
        if not np.isfinite(atr[i]) or lo[i]>np.nanmin(lo[i-L:i+R+1])+1e-12:continue
        lp=np.nanmax(hi[i-L:i]);rp=np.nanmax(hi[i+1:i+R+1]);drop=lp-lo[i]
        if drop<CFG['drop_atr']*atr[i]:continue
        rec=(rp-lo[i])/max(drop,1e-12)
        if rec<CFG['recovery']:continue
        conf=i+R;end=min(len(d),conf+1+wait);r=np.flatnonzero(lo[conf+1:end]<lo[i]-CFG['break_atr']*atr[conf])
        if not len(r):continue
        br=conf+1+int(r[0])
        if i-last<=8 and out and abs(out[-1]['v_low_price']-lo[i])<=.25*atr[i]:continue
        pid=f'V{len(out)+1:06d}';out.append({'pattern_id':pid,'event_family_id':pid,'v_index':i,'break_index':br,'v_low_time':times[i],'v_low_price':float(lo[i]),'break_time':times[br],'break_price':float(lo[br]),'drop_atr':float(drop/atr[i]),'recovery':float(rec),'volume_ratio':float(vol[i]) if np.isfinite(vol[i]) else np.nan,'prior_return_24h':float(ret[conf]) if np.isfinite(ret[conf]) else np.nan});last=i
    return pd.DataFrame(out)

@dataclass
class Trade:
    trade_id:str;pattern_id:str;entry_i:int;exit_i:int;entry:float;exit:float;net:float;reason:str;legs:list

def simulate(d,ev):
    lo=d.low.to_numpy(float);hi=d.high.to_numpy(float);cl=d.close.to_numpy(float);atr=d.atr.to_numpy(float);cost=(CFG['fee_bps']+CFG['slippage_bps'])/10000;out=[];last_exit=-1
    for e in ev.itertuples(index=False):
        ep=e.v_low_price*(1-CFG['entry_pct']);start=e.break_index+1;end=min(len(d),start+CFG['entry_expiry_h']*BPH);hit=np.flatnonzero(lo[start:end]<=ep)
        if not len(hit):continue
        fill=start+int(hit[0])
        if fill<=last_exit:continue
        check=min(len(d)-1,fill+CFG['long_h']*BPH);target=np.flatnonzero(hi[fill+1:check+1]>=e.v_low_price);legs=[]
        if len(target):
            ex=fill+1+int(target[0]);net=e.v_low_price/ep-1-2*cost;reason='long_target';legs=[{'side':'long','entry_i':fill,'exit_i':ex,'entry':ep,'exit':e.v_low_price,'reason':'v_low_target','net_return':net}];px=e.v_low_price
        else:
            long_px=cl[check];long_net=long_px/ep-1-2*cost;legs=[{'side':'long','entry_i':fill,'exit_i':check,'entry':ep,'exit':long_px,'reason':'long_window_end','net_return':long_net}];ex=check;px=long_px;net=long_net;reason='long_timeout_no_failure'
            if np.isfinite(atr[check]) and cl[check]<=e.v_low_price-CFG['failure_atr']*atr[check]:
                se=cl[check];tp=se*(1-CFG['short_target_pct']);stop=e.v_low_price;ex=min(len(d)-1,check+CFG['short_h']*BPH);px=cl[ex];sr='short_timeout'
                for j in range(check+1,ex+1):
                    if hi[j]>=stop:ex=j;px=stop;sr='short_stop_v_low';break
                    if lo[j]<=tp:ex=j;px=tp;sr='short_target';break
                sn=(se-px)/se-2*cost;legs.append({'side':'short','entry_i':check,'exit_i':ex,'entry':se,'exit':px,'reason':sr,'net_return':sn});net+=sn;reason='switch_'+sr
        last_exit=ex;out.append(Trade(f'T{len(out)+1:05d}',e.pattern_id,fill,ex,ep,px,float(net),reason,legs))
    return out

def stats(ts):
    r=np.array([x.net for x in ts],float)
    if not len(r):return {'trades':0,'win_rate':0,'avg_return':0,'profit_factor':0,'max_drawdown':0,'net_return_sum':0}
    eq=1+np.cumsum(r);dd=eq-np.maximum.accumulate(eq);gp=r[r>0].sum();gl=-r[r<0].sum()
    return {'trades':int(len(r)),'wins':int((r>0).sum()),'losses':int((r<0).sum()),'win_rate':float((r>0).mean()),'avg_return':float(r.mean()),'profit_factor':float(gp/gl) if gl else 999.0,'max_drawdown':float(dd.min()),'net_return_sum':float(r.sum()),'worst_trade':float(r.min())}

def export(d,ev,ts,out,split):
    used={t.pattern_id for t in ts};patterns=[];orders=[];trades=[];cost=(CFG['fee_bps']+CFG['slippage_bps'])/10000
    byid={x.pattern_id:x for x in ev.itertuples(index=False)}
    for e in ev.itertuples(index=False):patterns.append({'pattern_id':e.pattern_id,'v_low_time':iso(e.v_low_time),'v_low_price':e.v_low_price,'break_time':iso(e.break_time),'break_price':e.break_price,'depth_limit_price':e.v_low_price*(1-CFG['entry_pct']),'target_price':e.v_low_price,'status':'traded' if e.pattern_id in used else 'skipped','event_family_id':e.event_family_id,'drop_atr':e.drop_atr,'recovery':e.recovery,'volume_ratio':e.volume_ratio,'prior_return_24h':e.prior_return_24h,'filter_reason':'accepted' if e.pattern_id in used else 'not_filled_or_overlap'})
    for t in ts:
        e=byid[t.pattern_id];orders.append({'order_id':t.trade_id+'-L1','trade_id':t.trade_id,'pattern_id':t.pattern_id,'time':iso(d.time.iloc[t.entry_i]),'side':'buy','type':'limit','price':t.entry,'quantity':1,'status':'filled','level':1,'fee':cost})
        for n,l in enumerate(t.legs,1):
            if l['side']=='short':orders.append({'order_id':f'{t.trade_id}-S{n}','trade_id':t.trade_id,'pattern_id':t.pattern_id,'time':iso(d.time.iloc[l['entry_i']]),'side':'sell','type':'forced_exit','price':l['entry'],'quantity':1,'status':'filled','level':n,'fee':cost})
            orders.append({'order_id':f'{t.trade_id}-X{n}','trade_id':t.trade_id,'pattern_id':t.pattern_id,'time':iso(d.time.iloc[l['exit_i']]),'side':'sell' if l['side']=='long' else 'buy','type':'target' if 'target' in l['reason'] else ('stop' if 'stop' in l['reason'] else 'forced_exit'),'price':l['exit'],'quantity':1,'status':'filled','level':n,'fee':cost})
        trades.append({'trade_id':t.trade_id,'pattern_id':t.pattern_id,'entry_time':iso(d.time.iloc[t.entry_i]),'exit_time':iso(d.time.iloc[t.exit_i]),'average_entry':t.entry,'exit_price':t.exit,'quantity':1,'gross_pnl':t.net,'fees':2*cost*len(t.legs),'net_pnl':t.net,'net_pnl_pct':100*t.net,'max_planned_loss':1,'result':'win' if t.net>0 else 'loss','exit_reason':t.reason,'v_low_price':e.v_low_price,'v_low_time':iso(e.v_low_time),'break_time':iso(e.break_time),'break_price':e.break_price,'legs_json':json.dumps(t.legs,separators=(',',':')),'fold':'final_oos' if d.time.iloc[t.entry_i]>=split else 'historical_fit'})
    all_s=stats(ts);oos=[t for t in ts if d.time.iloc[t.entry_i]>=split];summary={**all_s,'patterns':len(ev),'model_id':'btc15m-dual-failure-v5','oos':stats(oos),'oos_start':iso(split),'out_of_sample_trade_count':len(oos)}
    manifest={'schema_version':'1.1','strategy':'Galka Dual-Mode Failure Switch','strategy_version':'btc15m-dual-failure-v5','run_id':'btc15m-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'),'symbol':'BTCUSDT','market':'Binance USD-M Futures','signal_source':'Binance','execution_venue':'Binance simulated','timeframe':'15m','timezone':'UTC','created_at':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'data_start':iso(d.time.min()),'data_end':iso(d.time.max()),'currency':'USDT','fee_model':'5 bps fee + 2 bps slippage per side','lookahead_safe':True,'files':{'candles':'candles.csv','patterns':'patterns.csv','orders':'orders.csv','trades':'trades.csv','summary':'summary.json','parameters':'parameters.json'}}
    c=d[['time','open','high','low','close','volume']].copy();c['time']=c.time.map(iso);out.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2));z.writestr('candles.csv',c.to_csv(index=False));z.writestr('patterns.csv',pd.DataFrame(patterns).to_csv(index=False));z.writestr('orders.csv',pd.DataFrame(orders).to_csv(index=False));z.writestr('trades.csv',pd.DataFrame(trades).to_csv(index=False));z.writestr('summary.json',json.dumps(summary,ensure_ascii=False,indent=2));z.writestr('parameters.json',json.dumps({'selected':CFG,'model_status':'paper candidate; fixed before this replay','intrabar_policy':'short stop first on ambiguous bar; long target starts after fill bar'},ensure_ascii=False,indent=2))
    return summary

def synthetic():
    rng=np.random.default_rng(7);n=8000;r=rng.normal(0,.002,n)
    for i in range(200,n-20,250):r[i:i+4]-=np.array([.015,.012,-.010,-.008])
    close=100*np.exp(np.cumsum(r));sp=rng.uniform(.001,.006,n)
    return pd.DataFrame({'time':pd.date_range('2020-01-01',periods=n,freq='15min',tz='UTC'),'open':np.r_[close[0],close[:-1]],'high':close*(1+sp),'low':close*(1-sp),'close':close,'volume':rng.lognormal(5,.5,n)})

def main():
    p=argparse.ArgumentParser();p.add_argument('--start',default='2019-09-01');p.add_argument('--end',default=(datetime.now(timezone.utc).date()-timedelta(days=1)).isoformat());p.add_argument('--cache',default='research/cache/binance/BTCUSDT/15m');p.add_argument('--output',default='research/output/BTCUSDT_15m_dual_failure_v5.galka.zip');p.add_argument('--synthetic',action='store_true');a=p.parse_args()
    d=synthetic() if a.synthetic else history(date.fromisoformat(a.start),date.fromisoformat(a.end),Path(a.cache));d=features(d);ev=detect(d)
    if len(ev)<30:raise RuntimeError(f'too few events: {len(ev)}')
    ts=simulate(d,ev);split=pd.Timestamp('2026-01-01',tz='UTC') if d.time.max()>=pd.Timestamp('2026-01-01',tz='UTC') else d.time.iloc[int(len(d)*.75)]
    s=export(d,ev,ts,Path(a.output),split);print(json.dumps({'bars':len(d),'events':len(ev),'trades':len(ts),'summary':s,'output':a.output},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
