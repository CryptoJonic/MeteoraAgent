import type { ManualMeasurement } from '../core/types';

const MEASUREMENTS_KEY = 'galka-lab:measurements:v1';

export class MeasurementStore {
  public list(): ManualMeasurement[] {
    try {
      const raw = localStorage.getItem(MEASUREMENTS_KEY);
      return raw ? (JSON.parse(raw) as ManualMeasurement[]) : [];
    } catch {
      return [];
    }
  }

  public save(measurement: ManualMeasurement): void {
    const rows = this.list().filter((candidate) => candidate.id !== measurement.id);
    rows.unshift(measurement);
    localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(rows.slice(0, 1_000)));
  }

  public remove(id: string): void {
    localStorage.setItem(
      MEASUREMENTS_KEY,
      JSON.stringify(this.list().filter((measurement) => measurement.id !== id)),
    );
  }

  public clear(): void {
    localStorage.removeItem(MEASUREMENTS_KEY);
  }
}
