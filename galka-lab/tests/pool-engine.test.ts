import { describe, expect, it } from 'vitest';

import { normalizedSellWeights } from '../src/core/distributions';
import {
  calculatePoolBoundaries,
  createCampaignConfig,
  createPools,
  createSellLadder,
  fillBuyBin,
  settleSellBin,
} from '../src/core/pool-engine';

const config = createCampaignConfig({
  id: 'pool-test',
  symbol: 'BTCUSDT',
  startTime: 1_700_000_000,
  galkaPrice: 2_000,
  lowerPrice: 1_700,
  binsPerPool: 40,
});

describe('pool construction', () => {
  it('calculates the exact three pool boundaries', () => {
    expect(calculatePoolBoundaries(2_000, 0.15)).toEqual([2_000, 1_900, 1_800, 1_700]);
  });

  it('always allocates exactly 1,200 USDC across three pools', () => {
    const pools = createPools(config);
    expect(pools).toHaveLength(3);
    expect(pools.reduce((sum, pool) => sum + pool.capitalUsdc, 0)).toBe(1_200);
    for (const pool of pools) {
      expect(pool.buyBins).toHaveLength(40);
      expect(pool.buyBins.reduce((sum, bin) => sum + bin.usdc, 0)).toBeCloseTo(400, 10);
    }
  });

  it('never fills a buy bin twice', () => {
    const pool = createPools(config)[0];
    const bin = pool?.buyBins[0];
    expect(pool).toBeDefined();
    expect(bin).toBeDefined();
    if (!pool || !bin) throw new Error('Test pool was not created.');
    const first = fillBuyBin(pool, bin, config.startTime);
    const second = fillBuyBin(pool, bin, config.startTime + 300);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
    expect(pool.costBasisUsdc).toBe(10);
  });

  it('flips a full pool into a sell ladder with exactly the same asset', () => {
    const pool = createPools(config)[0];
    if (!pool) throw new Error('Test pool was not created.');
    for (const bin of pool.buyBins) fillBuyBin(pool, bin, config.startTime);
    expect(pool.status).toBe('FILLED');
    const purchased = pool.purchasedAsset;
    const ladder = createSellLadder(pool, config.galkaPrice, config.startTime);
    expect(ladder.reduce((sum, bin) => sum + bin.assetQuantity, 0)).toBeCloseTo(purchased, 12);
    expect(ladder.reduce((sum, bin) => sum + bin.costBasis, 0)).toBeCloseTo(400, 10);
  });
});

describe('sell distribution', () => {
  it('normalizes weights to one', () => {
    const weights = normalizedSellWeights(40);
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 14);
  });

  it('puts more asset in the upper bin than the lower bin', () => {
    const pool = createPools(config)[0];
    if (!pool) throw new Error('Test pool was not created.');
    for (const bin of pool.buyBins) fillBuyBin(pool, bin, config.startTime);
    const ladder = createSellLadder(pool, config.galkaPrice, config.startTime);
    expect(ladder.at(-1)?.assetQuantity ?? 0).toBeGreaterThan(ladder[0]?.assetQuantity ?? 0);
  });

  it('does not settle an already settled sell bin twice', () => {
    const pool = createPools(config)[0];
    if (!pool) throw new Error('Test pool was not created.');
    for (const bin of pool.buyBins) fillBuyBin(pool, bin, config.startTime);
    const bin = createSellLadder(pool, config.galkaPrice, config.startTime)[0];
    if (!bin) throw new Error('Test sell bin was not created.');
    const first = settleSellBin(pool, bin, config.startTime + 300);
    const remainingAfterFirst = pool.remainingAsset;
    const second = settleSellBin(pool, bin, config.startTime + 600);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
    expect(pool.remainingAsset).toBe(remainingAfterFirst);
  });
});
