import { afterEach, describe, expect, it, vi } from 'vitest';

import { HISTORY_MIN_TIME } from '../src/core/types';
import { BinanceProvider } from '../src/data/binance-provider';
import { MemoryCandleCache } from '../src/data/cache';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Binance five-minute provider', () => {
  it('parses public klines and reuses the local cache', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      [HISTORY_MIN_TIME * 1_000, '100', '102', '99', '101', '12'],
      [(HISTORY_MIN_TIME + 300) * 1_000, '101', '103', '100', '102', '9'],
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new BinanceProvider(new MemoryCandleCache());

    const first = await provider.loadFiveMinuteCandles(
      'BTCUSDT',
      HISTORY_MIN_TIME,
      HISTORY_MIN_TIME + 600,
    );
    const second = await provider.loadFiveMinuteCandles(
      'BTCUSDT',
      HISTORY_MIN_TIME,
      HISTORY_MIN_TIME + 600,
    );

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first[0]?.close).toBe(101);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects history before the MVP start date', async () => {
    const provider = new BinanceProvider(new MemoryCandleCache());
    await expect(provider.loadFiveMinuteCandles(
      'BTCUSDT',
      HISTORY_MIN_TIME - 300,
      HISTORY_MIN_TIME + 300,
    )).rejects.toThrow('1 января 2023');
  });
});
