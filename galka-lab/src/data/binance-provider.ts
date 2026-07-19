import { FIVE_MINUTES_SECONDS, HISTORY_MIN_TIME, type Candle, type MarketSymbol } from '../core/types';
import type { CandleCache } from './cache';
import type { LoadMarketDataOptions, MarketDataProvider } from './market-data-provider';

const PAGE_LIMIT = 1_000;
const ENDPOINTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
] as const;

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  ...unknown[],
];

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function parseKline(row: BinanceKline): Candle {
  return {
    time: Math.floor(row[0] / 1_000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };
}

function isBinanceKline(value: unknown): value is BinanceKline {
  return Array.isArray(value) && value.length >= 6 && typeof value[0] === 'number';
}

export class BinanceProvider implements MarketDataProvider {
  private endpointIndex = 0;

  public constructor(private readonly cache: CandleCache) {}

  public async loadFiveMinuteCandles(
    symbol: MarketSymbol,
    startTime: number,
    endTime: number,
    options: LoadMarketDataOptions = {},
  ): Promise<Candle[]> {
    if (startTime < HISTORY_MIN_TIME) {
      throw new RangeError('История Galka Lab начинается с 1 января 2023 года.');
    }
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
      throw new RangeError('Некорректный диапазон исторических свечей.');
    }
    if (this.cache.hasCoverage(symbol, startTime, endTime)) {
      const cached = await this.cache.get(symbol, startTime, endTime);
      if (cached.length > 0) {
        options.onProgress?.({
          loadedCandles: cached.length,
          currentTime: endTime,
          endTime,
          source: 'cache',
        });
        return cached;
      }
    }

    const candles: Candle[] = [];
    let cursor = startTime;
    while (cursor < endTime) {
      if (options.signal?.aborted) throw new DOMException('Loading cancelled.', 'AbortError');
      const page = await this.fetchPage(symbol, cursor, endTime, options.signal);
      if (page.length === 0) break;
      candles.push(...page);
      const last = page.at(-1);
      if (!last) break;
      cursor = last.time + FIVE_MINUTES_SECONDS;
      options.onProgress?.({
        loadedCandles: candles.length,
        currentTime: cursor,
        endTime,
        source: 'network',
      });
      if (page.length < PAGE_LIMIT) break;
      await wait(30);
    }

    const unique = [...new Map(candles.map((candle) => [candle.time, candle])).values()]
      .filter((candle) => candle.time >= startTime && candle.time < endTime)
      .sort((left, right) => left.time - right.time);
    if (unique.length === 0) {
      const cached = await this.cache.get(symbol, startTime, endTime);
      if (cached.length > 0) return cached;
      throw new Error('Binance не вернул свечи для выбранного диапазона.');
    }
    await this.cache.put(symbol, unique);
    this.cache.addCoverage(symbol, startTime, endTime);
    return unique;
  }

  private async fetchPage(
    symbol: MarketSymbol,
    startTime: number,
    endTime: number,
    signal?: AbortSignal,
  ): Promise<Candle[]> {
    let lastError: Error | null = null;
    for (let offset = 0; offset < ENDPOINTS.length; offset += 1) {
      const candidateIndex = (this.endpointIndex + offset) % ENDPOINTS.length;
      const endpoint = ENDPOINTS[candidateIndex];
      if (!endpoint) continue;
      const query = new URLSearchParams({
        symbol,
        interval: '5m',
        startTime: String(Math.trunc(startTime * 1_000)),
        endTime: String(Math.trunc(endTime * 1_000 - 1)),
        limit: String(PAGE_LIMIT),
      });
      try {
        const response = await fetch(`${endpoint}/api/v3/klines?${query}`, {
          cache: 'no-store',
          ...(signal ? { signal } : {}),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) throw new Error('Некорректный ответ Binance.');
        this.endpointIndex = candidateIndex;
        return payload.filter(isBinanceKline).map(parseKline);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw new Error(`Не удалось загрузить Binance 5m: ${lastError?.message ?? 'неизвестная ошибка'}`);
  }
}
