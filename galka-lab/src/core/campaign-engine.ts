import { candlePath, crossesDown, crossesUp } from './candle-path';
import {
  cancelPoolBins,
  createPools,
  createSellLadder,
  fillBuyBin,
  reopenBuyBin,
  settleSellBin,
} from './pool-engine';
import type {
  BuyBin,
  CampaignConfig,
  CampaignEvent,
  CampaignEventType,
  CampaignState,
  Candle,
  PoolState,
  SellBin,
} from './types';
import { FIVE_MINUTES_SECONDS } from './types';

const EPSILON = 1e-9;

interface BuyCandidate {
  pool: PoolState;
  bin: BuyBin;
}

interface SellCandidate {
  pool: PoolState;
  bin: SellBin;
}

interface ReopenCandidate {
  pool: PoolState;
  bin: BuyBin;
}

type UpwardCandidate =
  | { kind: 'reopen'; price: number; value: ReopenCandidate }
  | { kind: 'sell'; price: number; value: SellCandidate };

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export class CampaignEngine {
  private stateValue: CampaignState;

  public constructor(config: CampaignConfig, initialPrice: number, restoredState?: CampaignState) {
    if (restoredState) {
      if (restoredState.version !== 1 || restoredState.config.id !== config.id) {
        throw new Error('Stored campaign state is incompatible.');
      }
      this.stateValue = deepClone(restoredState);
      this.stateValue.deepestPoolReached ??= this.stateValue.events.reduce(
        (deepest, event) => Math.max(deepest, event.poolIndex ?? 0),
        0,
      );
      return;
    }
    if (!Number.isFinite(initialPrice) || initialPrice <= 0) {
      throw new RangeError('Initial execution price must be positive.');
    }
    this.stateValue = {
      version: 1,
      config,
      status: 'ACTIVE',
      currentTime: config.startTime,
      currentPrice: initialPrice,
      freeUsdc: config.depositUsdc,
      lockedUsdc: 0,
      assetQuantity: 0,
      remainingCostBasisUsdc: 0,
      realizedPnlUsdc: 0,
      unrealizedPnlUsdc: 0,
      totalPnlUsdc: 0,
      equityUsdc: config.depositUsdc,
      equityPeakUsdc: config.depositUsdc,
      maxDrawdownUsdc: 0,
      maxDrawdownPct: 0,
      lowestPrice: initialPrice,
      deepestPoolReached: 0,
      hasPurchased: false,
      lowerBoundEventEmitted: false,
      finalUsdc: null,
      finalPnlUsdc: null,
      completedAt: null,
      pools: createPools(config),
      events: [],
    };
    this.markToMarket(initialPrice);
  }

  public static restore(state: CampaignState): CampaignEngine {
    return new CampaignEngine(state.config, state.currentPrice, state);
  }

  public get state(): Readonly<CampaignState> {
    return this.stateValue;
  }

  public snapshot(): CampaignState {
    return deepClone(this.stateValue);
  }

  public processCandle(candle: Candle): CampaignEvent[] {
    if (this.stateValue.status !== 'ACTIVE') return [];
    if (candle.time + FIVE_MINUTES_SECONDS < this.stateValue.currentTime) {
      throw new Error('Candles must be processed chronologically.');
    }

    const firstEventIndex = this.stateValue.events.length;
    const path = candlePath(candle);
    const open = path[0];
    if (!open) return [];

    this.processSegment(this.stateValue.currentPrice, open.price, candle.time);
    let previousPrice = open.price;
    for (const point of path.slice(1)) {
      if (this.stateValue.status !== 'ACTIVE') break;
      this.processSegment(previousPrice, point.price, candle.time);
      previousPrice = point.price;
    }

    if (this.stateValue.status === 'ACTIVE') {
      this.stateValue.currentTime = candle.time + FIVE_MINUTES_SECONDS;
      this.stateValue.currentPrice = candle.close;
      this.markToMarket(candle.close);
    }
    return this.stateValue.events.slice(firstEventIndex).map((event) => deepClone(event));
  }

  public processPrice(nextPrice: number, time: number): CampaignEvent[] {
    if (this.stateValue.status !== 'ACTIVE') return [];
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      throw new RangeError('Execution price must be positive.');
    }
    if (time < this.stateValue.currentTime) {
      throw new Error('Execution time cannot move backwards.');
    }
    const firstEventIndex = this.stateValue.events.length;
    this.processSegment(this.stateValue.currentPrice, nextPrice, time);
    if (this.stateValue.status === 'ACTIVE') {
      this.stateValue.currentTime = time;
      this.stateValue.currentPrice = nextPrice;
      this.markToMarket(nextPrice);
    }
    return this.stateValue.events.slice(firstEventIndex).map((event) => deepClone(event));
  }

  public stop(time = this.stateValue.currentTime, price = this.stateValue.currentPrice): CampaignEvent[] {
    if (this.stateValue.status !== 'ACTIVE') return [];
    const firstEventIndex = this.stateValue.events.length;
    this.finalize('STOPPED', time, price);
    return this.stateValue.events.slice(firstEventIndex).map((event) => deepClone(event));
  }

  private processSegment(fromPrice: number, toPrice: number, time: number): void {
    if (this.stateValue.status !== 'ACTIVE') return;
    if (fromPrice === toPrice) {
      this.stateValue.currentPrice = toPrice;
      this.stateValue.currentTime = time;
      this.updateLowest(toPrice);
      this.markToMarket(toPrice);
      return;
    }

    if (toPrice < fromPrice) {
      this.processBuys(fromPrice, toPrice, time);
      this.emitLowerBoundIfNeeded(fromPrice, toPrice, time);
    } else {
      this.processUpward(fromPrice, toPrice, time);
      if (
        this.stateValue.status === 'ACTIVE' &&
        this.stateValue.hasPurchased &&
        crossesUp(fromPrice, toPrice, this.stateValue.config.galkaPrice)
      ) {
        this.finalize('COMPLETED', time, this.stateValue.config.galkaPrice);
        return;
      }
    }

    this.stateValue.currentPrice = toPrice;
    this.stateValue.currentTime = time;
    this.updateLowest(toPrice);
    this.markToMarket(toPrice);
  }

  private processBuys(fromPrice: number, toPrice: number, time: number): void {
    const candidates: BuyCandidate[] = [];
    for (const pool of this.stateValue.pools) {
      if (pool.status === 'ASK_OPEN' || pool.status === 'SETTLED' || pool.status === 'FILLED') continue;
      for (const bin of pool.buyBins) {
        if (bin.status === 'OPEN' && crossesDown(fromPrice, toPrice, bin.price)) {
          candidates.push({ pool, bin });
        }
      }
    }
    candidates.sort((left, right) => right.bin.price - left.bin.price);

    for (const { pool, bin } of candidates) {
      const quantity = fillBuyBin(pool, bin, time);
      if (quantity <= 0) continue;
      this.stateValue.freeUsdc = Math.max(0, this.stateValue.freeUsdc - bin.usdc);
      this.stateValue.assetQuantity += quantity;
      this.stateValue.remainingCostBasisUsdc += bin.usdc;
      this.stateValue.hasPurchased = true;
      this.stateValue.deepestPoolReached = Math.max(
        this.stateValue.deepestPoolReached,
        pool.index,
      );
      this.markToMarket(bin.price);

      if (pool.status === 'FILLED') {
        this.emit('POOL_FILLED', time, bin.price, pool.index, null, pool.purchasedAsset, pool.costBasisUsdc, `POOL ${pool.index} FILLED`);
        createSellLadder(pool, this.stateValue.config.galkaPrice, time);
        this.emit('FLIPPED', time, bin.price, pool.index, null, pool.purchasedAsset, 0, `POOL ${pool.index} FLIPPED`);
      }
    }
  }

  private processUpward(fromPrice: number, toPrice: number, time: number): void {
    const candidates: UpwardCandidate[] = [];
    for (const pool of this.stateValue.pools) {
      if (pool.status === 'BID_OPEN' || pool.status === 'PARTIAL') {
        for (const bin of pool.buyBins) {
          if (bin.status === 'FILLED' && crossesUp(fromPrice, toPrice, bin.price)) {
            candidates.push({ kind: 'reopen', price: bin.price, value: { pool, bin } });
          }
        }
      }
      if (pool.status === 'ASK_OPEN') {
        for (const bin of pool.sellBins) {
          if (bin.status === 'OPEN' && crossesUp(fromPrice, toPrice, bin.price)) {
            candidates.push({ kind: 'sell', price: bin.price, value: { pool, bin } });
          }
        }
      }
    }
    candidates.sort((left, right) => left.price - right.price);

    for (const candidate of candidates) {
      if (candidate.kind === 'reopen') {
        const { pool, bin } = candidate.value;
        const quantity = reopenBuyBin(pool, bin);
        if (quantity <= 0) continue;
        this.stateValue.freeUsdc += bin.usdc;
        this.stateValue.assetQuantity = Math.max(0, this.stateValue.assetQuantity - quantity);
        this.stateValue.remainingCostBasisUsdc = Math.max(
          0,
          this.stateValue.remainingCostBasisUsdc - bin.usdc,
        );
        this.markToMarket(bin.price);
        continue;
      }

      const { pool, bin } = candidate.value;
      const proceeds = settleSellBin(pool, bin, time);
      if (proceeds <= 0) continue;
      this.stateValue.lockedUsdc += proceeds;
      this.stateValue.assetQuantity = Math.max(0, this.stateValue.assetQuantity - bin.assetQuantity);
      this.stateValue.remainingCostBasisUsdc = Math.max(
        0,
        this.stateValue.remainingCostBasisUsdc - bin.costBasis,
      );
      this.markToMarket(bin.price);
    }
  }

  private emitLowerBoundIfNeeded(fromPrice: number, toPrice: number, time: number): void {
    if (this.stateValue.lowerBoundEventEmitted) return;
    const lowerPrice = this.stateValue.config.lowerPrice;
    if (crossesDown(fromPrice, toPrice, lowerPrice)) {
      this.stateValue.lowerBoundEventEmitted = true;
      this.emit('LOWER_BOUND_REACHED', time, lowerPrice, 3, null, 0, 0, 'LOWER RANGE REACHED');
    }
  }

  private finalize(status: 'COMPLETED' | 'STOPPED', time: number, price: number): void {
    if (!Number.isFinite(price) || price <= 0) {
      throw new RangeError('Final execution price must be positive.');
    }
    for (const pool of this.stateValue.pools) {
      cancelPoolBins(pool);
      if (pool.remainingAsset > EPSILON) {
        if (status === 'COMPLETED' && pool.remainingAsset > 1e-8) {
          throw new Error('Completion invariant failed: non-dust asset remains at GALKA.');
        }
        const remainingCost = Math.max(0, pool.costBasisUsdc - pool.soldCostBasisUsdc);
        const proceeds = pool.remainingAsset * price;
        pool.lockedProceedsUsdc += proceeds;
        pool.soldCostBasisUsdc += remainingCost;
        pool.remainingAsset = 0;
        this.stateValue.lockedUsdc += proceeds;
      }
      pool.status = 'SETTLED';
    }

    this.stateValue.assetQuantity = 0;
    this.stateValue.remainingCostBasisUsdc = 0;
    this.stateValue.currentPrice = price;
    this.stateValue.currentTime = time;
    this.stateValue.status = status;
    this.stateValue.completedAt = time;
    this.stateValue.finalUsdc = this.stateValue.freeUsdc + this.stateValue.lockedUsdc;
    this.stateValue.finalPnlUsdc = this.stateValue.finalUsdc - this.stateValue.config.depositUsdc;
    this.updateLowest(price);
    this.markToMarket(price);
    this.emit(
      status,
      time,
      price,
      null,
      null,
      0,
      this.stateValue.finalUsdc,
      status === 'COMPLETED' ? 'CAMPAIGN COMPLETED' : 'CAMPAIGN STOPPED',
    );
  }

  private markToMarket(price: number): void {
    const soldCostBasis = this.stateValue.pools.reduce(
      (sum, pool) => sum + pool.soldCostBasisUsdc,
      0,
    );
    this.stateValue.realizedPnlUsdc = this.stateValue.lockedUsdc - soldCostBasis;
    this.stateValue.unrealizedPnlUsdc =
      this.stateValue.assetQuantity * price - this.stateValue.remainingCostBasisUsdc;
    this.stateValue.equityUsdc =
      this.stateValue.freeUsdc + this.stateValue.lockedUsdc + this.stateValue.assetQuantity * price;
    this.stateValue.totalPnlUsdc = this.stateValue.equityUsdc - this.stateValue.config.depositUsdc;
    this.stateValue.equityPeakUsdc = Math.max(
      this.stateValue.equityPeakUsdc,
      this.stateValue.equityUsdc,
    );
    const drawdown = Math.max(0, this.stateValue.equityPeakUsdc - this.stateValue.equityUsdc);
    const drawdownPct = this.stateValue.equityPeakUsdc > 0
      ? (drawdown / this.stateValue.equityPeakUsdc) * 100
      : 0;
    this.stateValue.maxDrawdownUsdc = Math.max(this.stateValue.maxDrawdownUsdc, drawdown);
    this.stateValue.maxDrawdownPct = Math.max(this.stateValue.maxDrawdownPct, drawdownPct);
  }

  private updateLowest(price: number): void {
    this.stateValue.lowestPrice = Math.min(this.stateValue.lowestPrice, price);
  }

  private emit(
    type: CampaignEventType,
    time: number,
    price: number,
    poolIndex: number | null,
    binIndex: number | null,
    assetQuantity: number,
    usdcAmount: number,
    label: string,
  ): void {
    this.stateValue.events.push({
      id: this.stateValue.events.length + 1,
      type,
      time,
      price,
      poolIndex,
      binIndex,
      assetQuantity,
      usdcAmount,
      label,
    });
  }
}
