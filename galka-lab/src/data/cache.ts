import type { Candle, MarketSymbol } from '../core/types';

interface CachedCandle extends Candle {
  key: string;
  symbol: MarketSymbol;
}

interface CoverageRange {
  start: number;
  end: number;
}

export interface CandleCache {
  get(symbol: MarketSymbol, startTime: number, endTime: number): Promise<Candle[]>;
  put(symbol: MarketSymbol, candles: readonly Candle[]): Promise<void>;
  hasCoverage(symbol: MarketSymbol, startTime: number, endTime: number): boolean;
  addCoverage(symbol: MarketSymbol, startTime: number, endTime: number): void;
}

const DATABASE_NAME = 'galka-lab-market-v1';
const STORE_NAME = 'candles';
const COVERAGE_KEY = 'galka-lab:market-coverage:v1';

function candleKey(symbol: MarketSymbol, time: number): string {
  return `${symbol}:${String(Math.trunc(time)).padStart(12, '0')}`;
}

function mergeRanges(ranges: readonly CoverageRange[]): CoverageRange[] {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged: CoverageRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end + 300) {
      merged.push({ ...range });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

function readCoverage(): Partial<Record<MarketSymbol, CoverageRange[]>> {
  try {
    const raw = localStorage.getItem(COVERAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<MarketSymbol, CoverageRange[]>>;
  } catch {
    return {};
  }
}

function writeCoverage(value: Partial<Record<MarketSymbol, CoverageRange[]>>): void {
  try {
    localStorage.setItem(COVERAGE_KEY, JSON.stringify(value));
  } catch {
    // Candle data remains usable for the current session when storage is full.
  }
}

export class IndexedDbCandleCache implements CandleCache {
  private databasePromise: Promise<IDBDatabase> | null = null;

  public async get(symbol: MarketSymbol, startTime: number, endTime: number): Promise<Candle[]> {
    const database = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll(
        IDBKeyRange.bound(candleKey(symbol, startTime), candleKey(symbol, endTime - 1)),
      );
      request.onerror = () => reject(request.error ?? new Error('Failed to read candle cache.'));
      request.onsuccess = () => {
        const rows = (request.result as CachedCandle[])
          .map(({ key: _key, symbol: _symbol, ...candle }) => candle)
          .sort((left, right) => left.time - right.time);
        resolve(rows);
      };
    });
  }

  public async put(symbol: MarketSymbol, candles: readonly Candle[]): Promise<void> {
    if (candles.length === 0) return;
    const database = await this.database();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      for (const candle of candles) {
        const row: CachedCandle = { ...candle, symbol, key: candleKey(symbol, candle.time) };
        store.put(row);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to cache candles.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Candle cache transaction aborted.'));
    });
  }

  public hasCoverage(symbol: MarketSymbol, startTime: number, endTime: number): boolean {
    const ranges = readCoverage()[symbol] ?? [];
    return ranges.some((range) => range.start <= startTime && range.end >= endTime);
  }

  public addCoverage(symbol: MarketSymbol, startTime: number, endTime: number): void {
    const coverage = readCoverage();
    coverage[symbol] = mergeRanges([...(coverage[symbol] ?? []), { start: startTime, end: endTime }]);
    writeCoverage(coverage);
  }

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to open candle cache.'));
      request.onsuccess = () => resolve(request.result);
    });
    return this.databasePromise;
  }
}

export class MemoryCandleCache implements CandleCache {
  private readonly rows = new Map<string, Candle>();
  private readonly coverage = new Map<MarketSymbol, CoverageRange[]>();

  public async get(symbol: MarketSymbol, startTime: number, endTime: number): Promise<Candle[]> {
    return [...this.rows.entries()]
      .filter(([key, row]) => key.startsWith(`${symbol}:`) && row.time >= startTime && row.time < endTime)
      .map(([, row]) => ({ ...row }))
      .sort((left, right) => left.time - right.time);
  }

  public async put(symbol: MarketSymbol, candles: readonly Candle[]): Promise<void> {
    for (const candle of candles) this.rows.set(candleKey(symbol, candle.time), { ...candle });
  }

  public hasCoverage(symbol: MarketSymbol, startTime: number, endTime: number): boolean {
    return (this.coverage.get(symbol) ?? []).some(
      (range) => range.start <= startTime && range.end >= endTime,
    );
  }

  public addCoverage(symbol: MarketSymbol, startTime: number, endTime: number): void {
    this.coverage.set(
      symbol,
      mergeRanges([...(this.coverage.get(symbol) ?? []), { start: startTime, end: endTime }]),
    );
  }
}
