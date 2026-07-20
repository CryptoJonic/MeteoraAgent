export const CAMPAIGN_DEPOSIT = 1_200;
export const POOL_COUNT = 3;
export const POOL_CAPITAL = 400;
export const DEFAULT_BIN_COUNT = 40;
export const FIVE_MINUTES_SECONDS = 5 * 60;
export const ONE_HOUR_SECONDS = 60 * 60;
export const HISTORY_MIN_TIME = Date.UTC(2023, 0, 1) / 1_000;

export type MarketSymbol = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT';
export type CampaignStatus = 'READY' | 'ACTIVE' | 'COMPLETED' | 'STOPPED';
export type PoolStatus = 'BID_OPEN' | 'PARTIAL' | 'FILLED' | 'ASK_OPEN' | 'SETTLED';
export type BinStatus = 'OPEN' | 'FILLED' | 'SETTLED' | 'CANCELLED';

export type CampaignEventType =
  | 'BUY_BIN_FILLED'
  | 'POOL_FILLED'
  | 'FLIPPED'
  | 'SELL'
  | 'LOWER_BOUND_REACHED'
  | 'COMPLETED'
  | 'STOPPED';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PricePathPoint {
  kind: 'open' | 'low' | 'high' | 'close';
  price: number;
}

export interface BuyBin {
  index: number;
  price: number;
  usdc: number;
  status: Extract<BinStatus, 'OPEN' | 'FILLED' | 'CANCELLED'>;
  assetQuantity: number;
  filledAt: number | null;
}

export interface SellBin {
  index: number;
  price: number;
  weight: number;
  assetQuantity: number;
  costBasis: number;
  proceeds: number;
  status: Extract<BinStatus, 'OPEN' | 'SETTLED' | 'CANCELLED'>;
  settledAt: number | null;
}

export interface PoolState {
  index: number;
  upperPrice: number;
  lowerPrice: number;
  capitalUsdc: number;
  status: PoolStatus;
  buyBins: BuyBin[];
  sellBins: SellBin[];
  purchasedAsset: number;
  remainingAsset: number;
  costBasisUsdc: number;
  soldCostBasisUsdc: number;
  lockedProceedsUsdc: number;
  averageEntry: number | null;
  flippedAt: number | null;
}

export interface CampaignConfig {
  id: string;
  symbol: MarketSymbol;
  startTime: number;
  galkaPrice: number;
  lowerPrice: number;
  rangePct: number;
  depositUsdc: number;
  poolCapitalUsdc: number;
  binsPerPool: number;
}

export interface CampaignEvent {
  id: number;
  type: CampaignEventType;
  time: number;
  price: number;
  poolIndex: number | null;
  binIndex: number | null;
  assetQuantity: number;
  usdcAmount: number;
  label: string;
}

export interface CampaignState {
  version: 1;
  config: CampaignConfig;
  status: CampaignStatus;
  currentTime: number;
  currentPrice: number;
  freeUsdc: number;
  lockedUsdc: number;
  assetQuantity: number;
  remainingCostBasisUsdc: number;
  realizedPnlUsdc: number;
  unrealizedPnlUsdc: number;
  totalPnlUsdc: number;
  equityUsdc: number;
  equityPeakUsdc: number;
  maxDrawdownUsdc: number;
  maxDrawdownPct: number;
  lowestPrice: number;
  deepestPoolReached: number;
  hasPurchased: boolean;
  lowerBoundEventEmitted: boolean;
  finalUsdc: number | null;
  finalPnlUsdc: number | null;
  completedAt: number | null;
  pools: PoolState[];
  events: CampaignEvent[];
}

export interface ReplaySnapshot {
  version: 1;
  cursor: number;
  campaign: CampaignState;
}

export interface ManualMeasurement {
  id: string;
  symbol: MarketSymbol;
  galkaPrice: number;
  bottomPrice: number;
  depthPct: number;
  startTime: number;
  bottomTime: number;
  returnTime: number | null;
  durationToBottomSeconds: number;
  durationToReturnSeconds: number | null;
  createdAt: number;
}

export interface MeasurementStatistics {
  count: number;
  mean: number;
  median: number;
  p80: number;
  p90: number;
  p95: number;
  maximum: number;
}

export interface CampaignResult {
  id: string;
  symbol: MarketSymbol;
  status: Extract<CampaignStatus, 'COMPLETED' | 'STOPPED'>;
  startedAt: number;
  completedAt: number;
  galkaPrice: number;
  lowerPrice: number;
  rangePct: number;
  finalUsdc: number;
  finalPnlUsdc: number;
  maxDrawdownUsdc: number;
  maxDrawdownPct: number;
  durationSeconds: number;
  lowestPrice: number;
  deepestPoolReached: number;
}

export interface StoredReplayState {
  savedAt: number;
  marketWindowStart: number;
  marketWindowEnd: number;
  replay: ReplaySnapshot;
}
