import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const currentRoot = path.resolve(argument('--current-root', '.'));
const baselineRoot = path.resolve(argument('--baseline-root', currentRoot));
const outputRoot = path.resolve(argument('--output', 'artifacts/galka-visuals'));
await fs.mkdir(outputRoot, { recursive: true });

function serve(root, port) {
  return spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', root], {
    stdio: 'ignore',
  });
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start: ${url}`);
}

function levels(galka, count = 10, filled = 3, notional = 400) {
  return Array.from({ length: count }, (_, index) => {
    const depthPct = (index + 1) * 0.15;
    const levelPrice = galka * (1 - depthPct / 100);
    return {
      index: index + 1,
      depthPct,
      weight: 1 / count,
      price: levelPrice,
      notional: notional / count,
      status: index < filled ? 'filled' : 'pending',
      fillPrice: index < filled ? levelPrice : null,
      fillTime: index < filled ? '2026-07-11T18:10:00.000Z' : null,
      qty: index < filled ? notional / count / levelPrice : 0,
      fee: index < filled ? notional / count * 0.0002 : 0,
    };
  });
}

function campaign(symbol, galka, filled, now) {
  const ladder = levels(galka, 10, filled);
  const complete = ladder.filter((level) => level.status === 'filled');
  const quantity = complete.reduce((sum, level) => sum + level.qty, 0);
  const filledNotional = complete.reduce((sum, level) => sum + level.notional, 0);
  return {
    campaignId: `C-${symbol}-visual`,
    symbol,
    patternId: `M-${symbol}-visual`,
    source: 'manual',
    trainingExampleId: `M-${symbol}-visual`,
    status: filled ? 'open' : 'waiting',
    vLow: galka,
    target: galka,
    createdAt: '2026-07-11T18:00:00.000Z',
    expiresAt: now + 36 * 3_600_000,
    exitMode: 'trail',
    reclaimPrice: galka * 1.001,
    trailArmed: false,
    trailHigh: null,
    trailStop: null,
    levels: ladder,
    qty: quantity,
    filledNotional,
    averageEntry: quantity ? filledNotional / quantity : null,
    entryFees: complete.reduce((sum, level) => sum + level.fee, 0),
    unrealizedPnl: 0,
  };
}

const now = Date.now();
const seed = {
  schemaVersion: 2,
  ui: {
    theme: 'dark', symbol: 'BTCUSDT', interval: '15m', chartType: 'candles', compare: '', scaleMode: 'normal',
    indicators: { sma20: false, ema20: false, ema50: false, bollinger: false, vwap: false, volume: true },
    lowerIndicator: null, magnet: true, drawingsLocked: false, drawingsHidden: false, showLevels: true,
    drawings: {}, templates: {}, alerts: [], radar: { enabled: true, minScore: 45, filter: 'all', visibleOnly: false },
    onboarding: { completed: true, version: 1 }, sheet: { panel: 'paper', snap: 'medium' },
  },
  paper: {
    settings: { startingBalance: 1000, leverage: 10, symbolNotional: 400, maxHours: 72, signalMode: 'manual', ladderStepPct: 0.15, manualDepthPct: 1.5, exitMode: 'trail', reclaimBufferPct: 0.1, trailDistancePct: 0.75, makerFee: 0.0002, takerFee: 0.0005, slippage: 0.0002, maintenanceMargin: 0.0125 },
    realizedPnl: 18.4, fees: 1.1, trades: [],
    symbols: {
      BTCUSDT: { pattern: { patternId: 'M-BTCUSDT-visual', source: 'manual', vLow: 60280, vLowTime: 1700108000, status: 'trading' }, campaign: campaign('BTCUSDT', 60280, 3, now) },
      ETHUSDT: { pattern: { patternId: 'M-ETHUSDT-visual', source: 'manual', vLow: 3320, vLowTime: 1700108000, status: 'trading' }, campaign: campaign('ETHUSDT', 3320, 0, now) },
      SOLUSDT: { pattern: null, campaign: null },
    },
  },
  training: { manualExamples: [], radarLabels: [], replayExamples: [] },
  activity: [{ id: 'A-visual', at: '2026-07-11T18:10:00.000Z', type: 'paper', message: 'BTC: L3 исполнена', meta: {} }],
};

function marketRows(symbol) {
  const base = symbol === 'BTCUSDT' ? 60_500 : symbol === 'ETHUSDT' ? 3_330 : 151;
  return Array.from({ length: 240 }, (_, index) => {
    const wave = Math.sin(index / 8) * base * 0.0025;
    const dip = index === 190 ? -base * 0.012 : index > 190 && index < 195 ? -base * 0.007 + (index - 190) * base * 0.002 : 0;
    const open = base + wave + dip;
    const close = open + Math.sin(index * 1.7) * base * 0.0007;
    const high = Math.max(open, close) + base * 0.0008;
    const low = Math.min(open, close) - base * 0.0008;
    return [(1_700_000_000 + index * 900) * 1000, open.toFixed(4), high.toFixed(4), low.toFixed(4), close.toFixed(4), String(120 + index)];
  });
}

async function preparePage(browser, baseUrl, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'dark' });
  await context.addInitScript(({ snapshot }) => {
    localStorage.setItem('galka-pro-v1', JSON.stringify(snapshot));
    class VisualWebSocket {
      constructor() {
        this.readyState = 0;
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.();
          for (const [symbol, bid] of [['BTCUSDT', 59820], ['ETHUSDT', 3340], ['SOLUSDT', 152.4]]) {
            this.onmessage?.({ data: JSON.stringify({ data: { e: 'bookTicker', s: symbol, b: String(bid), a: String(bid * 1.00005) } }) });
          }
        }, 80);
      }
      close() { this.readyState = 3; }
    }
    window.WebSocket = VisualWebSocket;
  }, { snapshot: seed });
  await context.route('https://fapi.binance.com/**', async (route) => {
    const symbol = new URL(route.request().url()).searchParams.get('symbol') || 'BTCUSDT';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(marketRows(symbol)) });
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/terminal/pro.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return { context, page };
}

const baselineServer = serve(baselineRoot, 4174);
const currentServer = serve(currentRoot, 4175);
let browser;
try {
  await Promise.all([
    waitFor('http://127.0.0.1:4174/terminal/pro.html'),
    waitFor('http://127.0.0.1:4175/terminal/pro.html'),
  ]);
  browser = await chromium.launch({ headless: true });

  const before = await preparePage(browser, 'http://127.0.0.1:4174', { width: 390, height: 844 });
  await before.page.screenshot({ path: path.join(outputRoot, 'before-s24.png') });
  await before.context.close();

  const after = await preparePage(browser, 'http://127.0.0.1:4175', { width: 390, height: 844 });
  await after.page.screenshot({ path: path.join(outputRoot, 'after-s24-chart.png') });
  await after.page.locator('[data-mobile-panel="paper"]').click();
  await after.page.waitForTimeout(450);
  await after.page.screenshot({ path: path.join(outputRoot, 'after-s24-paper.png') });
  await after.context.close();

  const desktop = await preparePage(browser, 'http://127.0.0.1:4175', { width: 1440, height: 900 });
  await desktop.page.screenshot({ path: path.join(outputRoot, 'after-desktop.png') });
  await desktop.context.close();
} finally {
  await browser?.close();
  baselineServer.kill('SIGTERM');
  currentServer.kill('SIGTERM');
}

console.log(`Galka visual captures written to ${outputRoot}`);

