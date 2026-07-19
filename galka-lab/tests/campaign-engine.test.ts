import { describe, expect, it } from 'vitest';

import { CampaignEngine } from '../src/core/campaign-engine';
import { createCampaignConfig } from '../src/core/pool-engine';
import type { Candle } from '../src/core/types';

const START = 1_700_000_000;

function createEngine(id = 'campaign-test'): CampaignEngine {
  const config = createCampaignConfig({
    id,
    symbol: 'BTCUSDT',
    startTime: START,
    galkaPrice: 100,
    lowerPrice: 70,
    binsPerPool: 2,
  });
  return new CampaignEngine(config, 100);
}

function scenarioCandles(): Candle[] {
  return [
    { time: START, open: 100, high: 101, low: 88, close: 92, volume: 1 },
    { time: START + 300, open: 92, high: 97, low: 85, close: 96, volume: 1 },
    { time: START + 600, open: 96, high: 100, low: 94, close: 100, volume: 1 },
  ];
}

describe('campaign lifecycle', () => {
  it('return to GALKA liquidates all remaining asset and completes', () => {
    const engine = createEngine();
    engine.processPrice(94, START + 300);
    expect(engine.state.assetQuantity).toBeGreaterThan(0);
    engine.processPrice(100, START + 600);
    expect(engine.state.status).toBe('COMPLETED');
    expect(engine.state.assetQuantity).toBe(0);
    expect(engine.state.finalUsdc).not.toBeNull();
    expect(engine.state.finalPnlUsdc).toBeGreaterThan(0);
    expect(engine.state.pools.every((pool) => pool.status === 'SETTLED')).toBe(true);
  });

  it('manual Stop converts the complete remainder to USDC', () => {
    const engine = createEngine();
    engine.processPrice(90, START + 300);
    const assetBeforeStop = engine.state.assetQuantity;
    const freeBeforeStop = engine.state.freeUsdc;
    expect(assetBeforeStop).toBeGreaterThan(0);
    engine.stop(START + 600, 85);
    expect(engine.state.status).toBe('STOPPED');
    expect(engine.state.assetQuantity).toBe(0);
    expect(engine.state.finalUsdc).toBeCloseTo(freeBeforeStop + assetBeforeStop * 85, 9);
  });

  it('a settled sell bin stays settled after price falls again', () => {
    const engine = createEngine();
    engine.processPrice(90, START + 300);
    const pool = engine.state.pools[0];
    expect(pool?.status).toBe('ASK_OPEN');
    engine.processPrice(95, START + 600);
    const lockedAfterSale = engine.state.lockedUsdc;
    expect(pool?.sellBins[0]?.status).toBe('SETTLED');
    engine.processPrice(80, START + 900);
    expect(engine.state.pools[0]?.sellBins[0]?.status).toBe('SETTLED');
    expect(engine.state.pools[0]?.sellBins[0]?.proceeds).toBeGreaterThan(0);
    expect(engine.state.lockedUsdc).toBe(lockedAfterSale);
  });

  it('produces identical output for identical candle data', () => {
    const left = createEngine('same-id');
    const right = createEngine('same-id');
    for (const candle of scenarioCandles()) {
      left.processCandle(candle);
      right.processCandle(candle);
    }
    expect(left.snapshot()).toEqual(right.snapshot());
  });

  it('keeps the accounting identity during replay and at finalization', () => {
    const engine = createEngine();
    engine.processPrice(84, START + 300);
    const active = engine.state;
    expect(active.equityUsdc).toBeCloseTo(
      active.freeUsdc + active.lockedUsdc + active.assetQuantity * active.currentPrice,
      9,
    );
    engine.processPrice(100, START + 600);
    const completed = engine.state;
    expect(completed.finalUsdc).toBeCloseTo(completed.freeUsdc + completed.lockedUsdc, 9);
    expect(completed.finalPnlUsdc).toBeCloseTo((completed.finalUsdc ?? 0) - 1_200, 9);
  });
});
