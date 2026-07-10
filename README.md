# Galka

Galka is a research terminal for developing and visually auditing a V-reversal limit-buy strategy.

## Strategy invariant

1. Detect a V-shaped pattern and record its minimum as `V-low`.
2. Wait for price to break below `V-low`.
3. Place a finite ladder of limit buys below `V-low`.
4. Never average below the configured last limit.
5. Size the ladder so maximum loss is fixed in money before entry.
6. Primary target is a return to `V-low`.

The research engine may optimize detection, confirmation, ladder geometry, position sizing and exits, but it must not violate these invariants unless the experiment is explicitly labelled as a different strategy.

## Product structure

- `terminal/` — browser terminal for loading a result package and auditing every pattern, order and trade on a scrollable candlestick chart.
- `docs/GALKA_PACKAGE_SPEC.md` — contract between the research engine and terminal.
- `research/` — reserved for reproducible backtests, walk-forward validation and model selection.
- `tests/` — package and invariant validation.

## Run locally

Serve the repository with any static HTTP server and open `terminal/`.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/terminal/`.

## Run in Termux

First installation from the current MVP branch:

```bash
pkg update -y && pkg install git python -y && rm -rf ~/Galka && git clone --branch feat/galka-terminal-mvp --single-branch https://github.com/CryptoJonic/MeteoraAgent.git ~/Galka && cd ~/Galka && bash scripts/start-termux.sh
```

Later launches:

```bash
cd ~/Galka && git pull && bash scripts/start-termux.sh
```

The launcher opens `http://127.0.0.1:8080/terminal/` in the phone browser. Return to Termux and press `Ctrl+C` to stop the local server.

The terminal can load:

- `.galka.zip` for full research runs;
- `.galka.json` for compact runs and debugging.

No exchange keys, order placement or live trading are included. The project is research and paper-trading only.
