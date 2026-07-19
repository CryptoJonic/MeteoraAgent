import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../src/app/app.ts', import.meta.url), 'utf8');
const chartSource = readFileSync(new URL('../src/app/chart-controller.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('Galka Lab UI contract', () => {
  it('keeps template ids unique', () => {
    const ids = [...appSource.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(40);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains every required replay control and mode label', () => {
    for (const label of [
      'POOL',
      'FAST PERP',
      'Следующая свеча',
      'Воспроизведение',
      'Пауза',
      'До следующего события',
      'Остановить кампанию',
      'Будущее скрыто',
    ]) {
      expect(appSource).toContain(label);
    }
    for (const speed of ['1', '10', '50', '200']) expect(appSource).toContain(speed);
  });

  it('renders campaign zones, bins, markers and the draggable lower handle', () => {
    expect(chartSource).toContain('createSeriesMarkers');
    expect(chartSource).toContain('drawCampaignBins');
    expect(chartSource).toContain('range-handle');
    expect(chartSource).toContain("event.type === 'SELL'");
  });

  it('defines phone, landscape and desktop layouts', () => {
    expect(styles).toContain('@media (max-width: 860px)');
    expect(styles).toContain('@media (max-width: 560px)');
    expect(styles).toContain('@media (orientation: landscape)');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) 390px');
  });
});
