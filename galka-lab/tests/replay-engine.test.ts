import { describe, expect, it } from 'vitest';

import { CampaignEngine } from '../src/core/campaign-engine';
import { createCampaignConfig } from '../src/core/pool-engine';
import { playbackPlan, ReplayEngine } from '../src/core/replay-engine';
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

  it('maps x1 to exactly one hourly step every second', () => {
    expect(playbackPlan(1)).toEqual({ intervalMs: 1_000, hoursPerTick: 1 });
    for (const speed of [1, 5, 20, 100] as const) {
      const plan = playbackPlan(speed);
      expect((plan.hoursPerTick * 1_000) / plan.intervalMs).toBe(speed);
    }

    const hourStart = 1_700_002_800;
    const rows: Candle[] = Array.from({ length: 14 }, (_, index) => ({
      time: hourStart - 600 + index * 300,
      open: 150,
      high: 151,
      low: 149,
      close: 150,
      volume: 1,
    }));
    const config = createCampaignConfig({
      id: 'hour-speed',
      symbol: 'BTCUSDT',
      startTime: hourStart,
      galkaPrice: 200,
      lowerPrice: 100,
      binsPerPool: 2,
    });
    const engine = new ReplayEngine(rows, new CampaignEngine(config, 150));
    expect(engine.visibleHourlyCandles()).toHaveLength(1);
    const result = engine.stepHours(playbackPlan(1).hoursPerTick);
    expect(result.processed).toBe(12);
    expect(engine.visibleHourlyCandles()).toHaveLength(2);
  });

  it('continues a new campaign from the current historical cursor after completion', () => {
    const rows: Candle[] = [
      { time: START, open: 100, high: 100, low: 94, close: 100, volume: 1 },
      { time: START + 300, open: 99, high: 100, low: 98, close: 100, volume: 1 },
      { time: START + 600, open: 100, high: 101, low: 99, close: 100, volume: 1 },
    ];
    const firstConfig = createCampaignConfig({
      id: 'first-campaign',
      symbol: 'BTCUSDT',
      startTime: START,
      galkaPrice: 100,
      lowerPrice: 70,
      binsPerPool: 2,
    });
    const first = new ReplayEngine(rows, new CampaignEngine(firstConfig, 100));
    first.stepFiveMinute(1);
    expect(first.campaign.state.status).toBe('COMPLETED');
    const cursorAtCompletion = first.cursor;
    const visibleAtCompletion = first.visibleFiveMinuteCandles();

    const secondConfig = createCampaignConfig({
      id: 'second-campaign',
      symbol: 'BTCUSDT',
      startTime: first.nextCandleTime ?? START + 300,
      galkaPrice: 100,
      lowerPrice: 70,
      binsPerPool: 2,
    });
    const second = first.continueWith(new CampaignEngine(secondConfig, 99));
    expect(second.cursor).toBe(cursorAtCompletion);
    expect(second.visibleFiveMinuteCandles()).toEqual(visibleAtCompletion);
    expect(second.nextCandleTime).toBe(START + 300);
  });
});
