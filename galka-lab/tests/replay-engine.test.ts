import { describe, expect, it } from 'vitest';

import { CampaignEngine } from '../src/core/campaign-engine';
import { createCampaignConfig } from '../src/core/pool-engine';
import { ReplayEngine } from '../src/core/replay-engine';
import type { Candle } from '../src/core/types';

const BASE = 1_699_999_200;
const START = BASE + 600;

const candles: Candle[] = Array.from({ length: 8 }, (_, index) => ({
  time: BASE + index * 300,
  open: 100 - index,
  high: 101 - index,
  low: 99 - index,
  close: 99.5 - index,
  volume: 1,
}));

function replay(): ReplayEngine {
  const config = createCampaignConfig({
    id: 'replay-test',
    symbol: 'BTCUSDT',
    startTime: START,
    galkaPrice: 100,
    lowerPrice: 70,
    binsPerPool: 2,
  });
  return new ReplayEngine(candles, new CampaignEngine(config, 98.5));
}

describe('historical replay isolation', () => {
  it('never exposes candles at or after the replay cursor to the chart', () => {
    const engine = replay();
    expect(engine.visibleFiveMinuteCandles().map((row) => row.time)).toEqual([BASE, BASE + 300]);
    expect(engine.nextCandleTime).toBe(START);
    engine.stepFiveMinute(1);
    expect(engine.visibleFiveMinuteCandles().at(-1)?.time).toBe(START);
    expect(engine.visibleFiveMinuteCandles().some((row) => row.time > START)).toBe(false);
    expect(engine.nextCandleTime).toBe(START + 300);
  });

  it('restores the same cursor and campaign state', () => {
    const engine = replay();
    engine.stepFiveMinute(2);
    const restored = ReplayEngine.restore(candles, engine.snapshot());
    expect(restored.cursor).toBe(engine.cursor);
    expect(restored.campaign.snapshot()).toEqual(engine.campaign.snapshot());
    expect(restored.visibleHourlyCandles()).toEqual(engine.visibleHourlyCandles());
  });
});
