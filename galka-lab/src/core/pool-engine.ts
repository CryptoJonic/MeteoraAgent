import { normalizedSellWeights } from './distributions';
import {
  CAMPAIGN_DEPOSIT,
  DEFAULT_BIN_COUNT,
  POOL_CAPITAL,
  POOL_COUNT,
  type BuyBin,
  type CampaignConfig,
  type PoolState,
  type SellBin,
} from './types';

const EPSILON = 1e-12;

export function calculateRangePct(galkaPrice: number, lowerPrice: number): number {
  if (!Number.isFinite(galkaPrice) || galkaPrice <= 0) {
    throw new RangeError('GALKA price must be positive.');
  }
  if (!Number.isFinite(lowerPrice) || lowerPrice <= 0 || lowerPrice >= galkaPrice) {
    throw new RangeError('Lower price must be positive and below GALKA.');
  }
  return (galkaPrice - lowerPrice) / galkaPrice;
}

export function calculatePoolBoundaries(galkaPrice: number, rangePct: number): [number, number, number, number] {
  if (!Number.isFinite(galkaPrice) || galkaPrice <= 0) {
    throw new RangeError('GALKA price must be positive.');
  }
  if (!Number.isFinite(rangePct) || rangePct <= 0 || rangePct >= 1) {
    throw new RangeError('Range percentage must be between 0 and 1.');
  }

  return [
    galkaPrice,
    galkaPrice * (1 - rangePct / 3),
    galkaPrice * (1 - (2 * rangePct) / 3),
    galkaPrice * (1 - rangePct),
  ];
}

export function createCampaignConfig(input: {
  id: string;
  symbol: CampaignConfig['symbol'];
  startTime: number;
  galkaPrice: number;
  lowerPrice: number;
  binsPerPool?: number;
}): CampaignConfig {
  const rangePct = calculateRangePct(input.galkaPrice, input.lowerPrice);
  const binsPerPool = input.binsPerPool ?? DEFAULT_BIN_COUNT;
  if (!Number.isInteger(binsPerPool) || binsPerPool < 2) {
    throw new RangeError('Each pool requires at least two bins.');
  }
  return {
    id: input.id,
    symbol: input.symbol,
    startTime: input.startTime,
    galkaPrice: input.galkaPrice,
    lowerPrice: input.lowerPrice,
    rangePct,
    depositUsdc: CAMPAIGN_DEPOSIT,
    poolCapitalUsdc: POOL_CAPITAL,
    binsPerPool,
  };
}

export function createBuyBins(
  upperPrice: number,
  lowerPrice: number,
  capitalUsdc: number,
  count: number,
): BuyBin[] {
  if (upperPrice <= lowerPrice || lowerPrice <= 0) {
    throw new RangeError('Pool prices are invalid.');
  }
  if (capitalUsdc <= 0 || !Number.isInteger(count) || count < 2) {
    throw new RangeError('Pool capital and bin count must be positive.');
  }
  const usdcPerBin = capitalUsdc / count;
  const width = upperPrice - lowerPrice;

  // The upper edge is exclusive and the lower edge is inclusive. Adjacent
  // pools therefore never duplicate an order at a shared boundary.
  return Array.from({ length: count }, (_, index) => ({
    index,
    price: upperPrice - (width * (index + 1)) / count,
    usdc: usdcPerBin,
    status: 'OPEN' as const,
    assetQuantity: 0,
    filledAt: null,
  }));
}

export function createPools(config: CampaignConfig): PoolState[] {
  if (Math.abs(config.depositUsdc - config.poolCapitalUsdc * POOL_COUNT) > EPSILON) {
    throw new Error('Campaign capital must equal the sum of three pools.');
  }
  const boundaries = calculatePoolBoundaries(config.galkaPrice, config.rangePct);

  return Array.from({ length: POOL_COUNT }, (_, index) => {
    const upperPrice = boundaries[index];
    const lowerPrice = boundaries[index + 1];
    if (upperPrice === undefined || lowerPrice === undefined) {
      throw new Error('Failed to resolve pool boundaries.');
    }
    return {
      index: index + 1,
      upperPrice,
      lowerPrice,
      capitalUsdc: config.poolCapitalUsdc,
      status: 'BID_OPEN' as const,
      buyBins: createBuyBins(
        upperPrice,
        lowerPrice,
        config.poolCapitalUsdc,
        config.binsPerPool,
      ),
      sellBins: [],
      purchasedAsset: 0,
      remainingAsset: 0,
      costBasisUsdc: 0,
      soldCostBasisUsdc: 0,
      lockedProceedsUsdc: 0,
      averageEntry: null,
      flippedAt: null,
    };
  });
}

export function fillBuyBin(pool: PoolState, bin: BuyBin, time: number): number {
  if (bin.status !== 'OPEN' || pool.status === 'ASK_OPEN' || pool.status === 'SETTLED') {
    return 0;
  }
  const quantity = bin.usdc / bin.price;
  bin.status = 'FILLED';
  bin.assetQuantity = quantity;
  bin.filledAt = time;
  pool.purchasedAsset += quantity;
  pool.remainingAsset += quantity;
  pool.costBasisUsdc += bin.usdc;
  pool.averageEntry = pool.costBasisUsdc / pool.purchasedAsset;

  const isFilled = pool.buyBins.every((candidate) => candidate.status === 'FILLED');
  pool.status = isFilled ? 'FILLED' : 'PARTIAL';
  return quantity;
}

/**
 * Returns a filled bin of an unflipped pool to USDC when price crosses it up.
 * This models the reversible side of the original DLMM range. Once a pool is
 * flipped, its buy bins are deliberately no longer eligible for reopening.
 */
export function reopenBuyBin(pool: PoolState, bin: BuyBin): number {
  if (
    bin.status !== 'FILLED' ||
    pool.status === 'FILLED' ||
    pool.status === 'ASK_OPEN' ||
    pool.status === 'SETTLED'
  ) {
    return 0;
  }

  const quantity = bin.assetQuantity;
  if (quantity <= 0) return 0;

  bin.status = 'OPEN';
  bin.assetQuantity = 0;
  bin.filledAt = null;
  pool.purchasedAsset = Math.max(0, pool.purchasedAsset - quantity);
  pool.remainingAsset = Math.max(0, pool.remainingAsset - quantity);
  pool.costBasisUsdc = Math.max(0, pool.costBasisUsdc - bin.usdc);
  pool.averageEntry = pool.purchasedAsset > EPSILON
    ? pool.costBasisUsdc / pool.purchasedAsset
    : null;
  pool.status = pool.buyBins.some((candidate) => candidate.status === 'FILLED')
    ? 'PARTIAL'
    : 'BID_OPEN';
  return quantity;
}

export function createSellLadder(
  pool: PoolState,
  galkaPrice: number,
  time: number,
): SellBin[] {
  if (pool.status !== 'FILLED') {
    throw new Error('Only a fully filled pool can be flipped.');
  }
  if (pool.purchasedAsset <= 0 || pool.costBasisUsdc <= 0) {
    throw new Error('Filled pool has no purchased asset.');
  }

  const count = pool.buyBins.length;
  const weights = normalizedSellWeights(count);
  const width = galkaPrice - pool.lowerPrice;
  let assignedAsset = 0;
  let assignedCost = 0;

  pool.sellBins = weights.map((weight, index) => {
    const isLast = index === count - 1;
    const assetQuantity = isLast
      ? pool.purchasedAsset - assignedAsset
      : pool.purchasedAsset * weight;
    const costBasis = isLast
      ? pool.costBasisUsdc - assignedCost
      : pool.costBasisUsdc * weight;
    assignedAsset += assetQuantity;
    assignedCost += costBasis;
    return {
      index,
      price: pool.lowerPrice + (width * index) / (count - 1),
      weight,
      assetQuantity,
      costBasis,
      proceeds: 0,
      status: 'OPEN' as const,
      settledAt: null,
    };
  });
  pool.status = 'ASK_OPEN';
  pool.flippedAt = time;
  return pool.sellBins;
}

export function settleSellBin(pool: PoolState, bin: SellBin, time: number): number {
  if (pool.status !== 'ASK_OPEN' || bin.status !== 'OPEN') return 0;
  const proceeds = bin.assetQuantity * bin.price;
  bin.status = 'SETTLED';
  bin.proceeds = proceeds;
  bin.settledAt = time;
  pool.remainingAsset = Math.max(0, pool.remainingAsset - bin.assetQuantity);
  pool.soldCostBasisUsdc += bin.costBasis;
  pool.lockedProceedsUsdc += proceeds;
  if (pool.sellBins.every((candidate) => candidate.status === 'SETTLED')) {
    pool.status = 'SETTLED';
  }
  return proceeds;
}

export function cancelPoolBins(pool: PoolState): void {
  for (const bin of pool.buyBins) {
    if (bin.status === 'OPEN') bin.status = 'CANCELLED';
  }
  for (const bin of pool.sellBins) {
    if (bin.status === 'OPEN') bin.status = 'CANCELLED';
  }
}

export function poolFillPct(pool: PoolState): number {
  const filled = pool.buyBins.filter((bin) => bin.status === 'FILLED').length;
  return (filled / pool.buyBins.length) * 100;
}

export function poolSoldPct(pool: PoolState): number {
  if (pool.purchasedAsset <= EPSILON) return 0;
  return ((pool.purchasedAsset - pool.remainingAsset) / pool.purchasedAsset) * 100;
}
