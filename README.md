# Galka

Galka is a research terminal for developing and visually auditing a V-reversal trading model.

## Current terminal

The bundled result is `results/BTCUSDT_15m_dual_failure_v5.galka.zip`. The mobile terminal opens it automatically and renders only the candle window around the selected trade, which keeps the phone responsive.

The terminal is an audit and paper-research interface. It does not place exchange orders and does not use API keys.

## First installation in Termux

```bash
pkg update -y && pkg install git python -y && git clone https://github.com/CryptoJonic/MeteoraAgent.git ~/Galka && cd ~/Galka && bash scripts/start-termux.sh
```

## Existing installation

Early installations were pinned to `feat/galka-terminal-mvp`. Use this safe migration command once:

```bash
cd ~/Galka && git stash push -u -m galka-phone-backup && git fetch origin main && git switch -C main origin/main && bash scripts/start-termux.sh
```

The command preserves uncommitted files in `git stash` before switching to `main`. On later launches use:

```bash
cd ~/Galka && git pull --ff-only origin main && bash scripts/start-termux.sh
```

The launcher:

- migrates obsolete branches to `main` when possible;
- selects a free local port from `8080` to `8089`;
- opens a cache-busted terminal URL;
- automatically loads the bundled BTC history;
- stops when `Ctrl+C` is pressed in Termux.

## Mobile review flow

1. Wait until the status shows that history is loaded.
2. Review `final_oos` trades first; this filter is selected by default.
3. Use `‹` and `›` below the chart to move through trades.
4. Filter by result and by pure long versus long-to-short switch.
5. Inspect each leg, entry, exit, V-low, break and reason in the details section.
6. Use the trade list or search by trade ID/date.

## Project structure

- `terminal/` — phone-first browser terminal;
- `results/` — verified terminal-ready research packages;
- `research/` — reproducible Binance historical replay;
- `docs/GALKA_PACKAGE_SPEC.md` — result package contract;
- `docs/MOBILE_LOOP_ENGINEERING_15.md` — the 15 mobile improvement iterations;
- `scripts/` — Termux launcher and regression checks.

## Desktop/local launch

```bash
python -m http.server 8080
```

Open `http://127.0.0.1:8080/terminal/`.
