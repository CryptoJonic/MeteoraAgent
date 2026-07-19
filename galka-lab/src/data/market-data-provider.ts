import type { Candle, MarketSymbol } from '../core/types';

export interface MarketDataProgress {
  loadedCandles: number;
  currentTime: number;
  endTime: number;
  source: 'cache' | 'network';
}

export interface LoadMarketDataOptions {
  signal?: AbortSignal;
  onProgress?: (progress: MarketDataProgress) => void;
}

export interface MarketDataProvider {
  loadFiveMinuteCandles(
    symbol: MarketSymbol,
    startTime: number,
    endTime: number,
    options?: LoadMarketDataOptions,
  ): Promise<Candle[]>;
}
