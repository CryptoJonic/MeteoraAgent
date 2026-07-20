import { describe, expect, it, vi } from 'vitest';

import { CampaignController } from '../src/app/campaign-controller';
import { createCampaignConfig } from '../src/core/pool-engine';
import type { Candle } from '../src/core/types';
import type { MarketDataProvider } from '../src/data/market-data-provider';
import type { CampaignStore } from '../src/storage/campaign-store';

const START = 1_700_002_800;
const rows: Candle[] = [
  { time: START - 300, open: 100, high: 100, low: 100, close: 100, volume: 1 },
  { time: START, open: 100, high: 100, low: 94, close: 100, volume: 1 },
  { time: START + 300, open: 100, high: 101, low: 99, close: 100, volume: 1 },
];

function config(id: string, startTime: number) {
  return createCampaignConfig({
    id,
    symbol: 'BTCUSDT',
    startTime,
    galkaPrice: 100,
    lowerPrice: 70,
    binsPerPool: 2,
  });
}

describe('campaign controller continuation', () => {
  it('starts the next campaign at the completed replay cursor without revealing future candles', async () => {
    const provider: MarketDataProvider = {
      loadFiveMinuteCandles: vi.fn(async () => rows),
    };
    const store = {
      saveConfig: vi.fn(),
      saveActive: vi.fn(),
      addResult: vi.fn(),
      clearActive: vi.fn(),
    } as unknown as CampaignStore;
    const controller = new CampaignController(provider, store);

    await controller.loadMarketWindow('BTCUSDT', START);
    const first = controller.startCampaign(config('first', START));
    controller.stepFiveMinute(1);
    expect(first.campaign.state.status).toBe('COMPLETED');
    expect(controller.nextCampaignStartTime()).toBe(START + 300);
    const visibleBefore = controller.chartCandles();
    expect(visibleBefore.some((candle) => candle.time > START)).toBe(false);

    const second = controller.startCampaign(config('second', controller.nextCampaignStartTime()));
    expect(second.cursor).toBe(first.cursor);
    expect(controller.chartCandles()).toEqual(visibleBefore);
    expect(second.nextCandleTime).toBe(START + 300);
    expect(second.campaign.state.status).toBe('ACTIVE');
  });
});
