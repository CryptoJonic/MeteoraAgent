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
  it('starts with all three buy pools active and 400 USDC each', () => {
    const engine = createEngine();
    expect(engine.state.pools.map((pool) => pool.status)).toEqual([
      'BID_OPEN',
      'BID_OPEN',
      'BID_OPEN',
    ]);
    expect(engine.state.pools.map((pool) => pool.capitalUsdc)).toEqual([400, 400, 400]);
  });

  it('keeps a partial pool unflipped and naturally returns it to USDC upward', () => {
    const engine = createEngine();
    engine.processPrice(94, START + 300);
    expect(engine.state.pools[0]?.status).toBe('PARTIAL');
    expect(engine.state.pools[0]?.sellBins).toHaveLength(0);
    expect(engine.state.assetQuantity).toBeGreaterThan(0);
    expect(engine.state.freeUsdc).toBe(1_000);

    engine.processPrice(96, START + 600);
    expect(engine.state.status).toBe('ACTIVE');
    expect(engine.state.pools[0]?.status).toBe('BID_OPEN');
    expect(engine.state.assetQuantity).toBe(0);
    expect(engine.state.freeUsdc).toBeCloseTo(1_200, 12);
  });

  it('flips only a fully traversed pool and never reopens its settled sells', () => {
    const engine = createEngine();
    engine.processPrice(94, START + 300);
    expect(engine.state.pools[0]?.status).toBe('PARTIAL');
    engine.processPrice(90, START + 600);
    const pool = engine.state.pools[0];
    expect(pool?.status).toBe('ASK_OPEN');
    expect(pool?.sellBins).toHaveLength(2);
    expect(pool?.sellBins.at(-1)?.price).toBe(100);

    engine.processPrice(95, START + 900);
    const lockedAfterSale = engine.state.lockedUsdc;
    expect(pool?.sellBins[0]?.status).toBe('SETTLED');
    engine.processPrice(80, START + 1_200);
    expect(engine.state.pools[0]?.sellBins[0]?.status).toBe('SETTLED');
    expect(engine.state.lockedUsdc).toBe(lockedAfterSale);
  });

  it('returns to GALKA with zero asset after partial bins unwind and flipped bins sell', () => {
    const engine = createEngine();
    engine.processPrice(84, START + 300);
    expect(engine.state.pools[0]?.status).toBe('ASK_OPEN');
    expect(engine.state.pools[1]?.status).toBe('PARTIAL');
    expect(engine.state.deepestPoolReached).toBe(2);
    engine.processPrice(100, START + 600);
    expect(engine.state.status).toBe('COMPLETED');
    expect(engine.state.assetQuantity).toBeLessThanOrEqual(1e-12);
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
