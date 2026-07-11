# Galka

Galka is a mobile-first research and live paper-trading terminal for a long-only V-reversal model.

## Live paper mode

The Termux launcher now opens `terminal/live.html` by default. The live page:

- subscribes to public Binance USD-M Futures data for BTCUSDT, ETHUSDT and SOLUSDT;
- never uses exchange keys and never sends real orders;
- runs the long-only Galka paper bot while the browser tab is open;
- starts from a shared paper balance of $1,000 and 10x leverage;
- reserves $3,333.33 notional per symbol by default;
- uses six limit levels from 0.25% to 3.50% below V-low;
- saves paper trades, open campaigns, settings and drawings in browser local storage;
- supports pinch zoom, mouse-wheel zoom, chart dragging, zoom buttons and return-to-latest;
- provides trend line, horizontal level and rectangle drawing tools.

The initial live mode is an execution experiment, not a validated production strategy. It includes configurable fee/slippage assumptions and an approximate paper-liquidation model.

## Historical terminal

The historical audit remains available at `terminal/index.html`. The bundled result is `results/BTCUSDT_15m_dual_failure_v5.galka.zip`.

## First installation in Termux

```bash
pkg update -y && pkg install git python -y && git clone https://github.com/CryptoJonic/MeteoraAgent.git ~/Galka && cd ~/Galka && bash scripts/start-termux.sh
```

## Existing installation

```bash
cd ~/Galka && git pull --ff-only origin main && bash scripts/start-termux.sh
```

Early single-branch installations can use:

```bash
cd ~/Galka && git remote set-branches --add origin main && git fetch origin main:refs/remotes/origin/main && git switch -C main origin/main && bash scripts/start-termux.sh
```

The launcher selects a free local port from 8080 to 8089, opens a cache-busted live terminal URL, and stops when `Ctrl+C` is pressed in Termux.

## Project structure

- `terminal/live.html`, `live.css`, `live.js` — live paper terminal;
- `terminal/index.html` — historical audit terminal;
- `results/` — terminal-ready research packages;
- `research/` — reproducible Binance historical replay;
- `scripts/` — Termux launcher and regression checks.

## Desktop/local launch

```bash
python -m http.server 8080
```

Open `http://127.0.0.1:8080/terminal/live.html`.
