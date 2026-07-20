import { describe, expect, it } from 'vitest';

import { InteractionState } from '../src/app/interaction-state';

const FIRST = { time: 1_700_000_000, price: 2_000 };
const SECOND = { time: 1_700_003_600, price: 1_760 };

describe('mobile crosshair interaction state', () => {
  it('never changes GALKA from crosshair movement alone', () => {
    const state = new InteractionState();
    state.moveCrosshair(FIRST);
    expect(state.snapshot.galkaPrice).toBeNull();
    state.moveCrosshair(SECOND);
    expect(state.snapshot.galkaPrice).toBeNull();
  });

  it('changes GALKA only through fixation or exact manual input', () => {
    const state = new InteractionState();
    state.moveCrosshair(FIRST);
    state.fixGalkaFromCrosshair();
    expect(state.snapshot.galkaPrice).toBe(2_000);
    expect(state.snapshot.lowerPrice).toBeCloseTo(1_700, 12);

    state.moveCrosshair(SECOND);
    expect(state.snapshot.galkaPrice).toBe(2_000);
    state.setGalkaPrice(2_100);
    expect(state.snapshot.galkaPrice).toBe(2_100);
  });

  it('keeps measurement independent from GALKA and campaign boundaries', () => {
    const state = new InteractionState();
    state.setRange(2_000, 1_700);
    state.moveCrosshair(FIRST);
    state.toggleMeasurement();
    state.moveCrosshair(SECOND);

    expect(state.snapshot.measurement.active).toBe(true);
    expect(state.snapshot.measurement.start).toEqual(FIRST);
    expect(state.snapshot.measurement.current).toEqual(SECOND);
    expect(state.snapshot.galkaPrice).toBe(2_000);
    expect(state.snapshot.lowerPrice).toBe(1_700);

    state.toggleMeasurement();
    expect(state.snapshot.measurement.active).toBe(false);
  });
});
