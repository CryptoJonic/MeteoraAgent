# Galka Hyperliquid LIVE

## Status

This branch contains a guarded first live implementation for manual GALKA trading on Hyperliquid. It is separate from the paper terminal and must remain a draft until Android/Termux verification and a deliberately tiny real-order smoke test are complete.

## Trading contract

- Mainnet Hyperliquid perpetuals.
- BTC, ETH, SOL only.
- Long only.
- Manual GALKA price only.
- Eight entry levels below GALKA: 0.15%, 0.30%, 0.45%, 0.60%, 0.90%, 1.20%, 1.50%, 2.00%.
- Total requested notional defaults to $150 at 10x isolated, intended for an approximately $19 account while leaving a margin buffer.
- Every entry is ALO/post-only.
- Every entry is submitted together with an exchange-native, reduce-only, non-market TP at GALKA using `normalTpsl` grouping.
- If only L1 participates and closes at GALKA, L1 is rearmed and the campaign stays active.
- If L2 or deeper participates and the managed position closes at GALKA, all remaining campaign orders are canceled and the campaign is complete.
- No automatic expiration or timeout.
- Normal exits are limit exits. The market-close method is exposed only through a double-confirmed emergency action.

## Small-account allocation

Hyperliquid requires a minimum order value. With eight orders and a $150 campaign, the fixed paper percentages cannot be copied literally because the last levels would be below the minimum. The live ladder therefore:

1. starts with the paper weights;
2. raises every level to the exchange minimum after lot-size rounding;
3. reduces excess allocation from larger levels;
4. refuses the campaign if all eight valid orders cannot fit inside the requested notional.

The preview displays the actual rounded values before any order is sent.

## Secret handling

The browser never receives the API Wallet private key.

Local file:

```text
~/.config/galka-live.env
```

Required permissions:

```bash
chmod 600 ~/.config/galka-live.env
```

Required values:

```text
HL_ACCOUNT_ADDRESS=<public main account address>
HL_API_SECRET_KEY=<private key of approved API Wallet / Agent Wallet>
```

Do not use a seed phrase. Do not commit the file. Do not paste the secret into chat, GitHub, browser storage, screenshots, or logs.

The SDK signs locally in Termux. Account queries use the main account address; the API Wallet key is used only to sign authorized exchange actions.

## Setup

```bash
bash scripts/setup-galka-live.sh
```

The script creates a private virtual environment, installs the pinned official SDK, creates the local configuration file, sets mode 600, and opens it in nano.

LIVE remains disabled until both settings are present:

```text
HL_LIVE_ENABLED=YES
HL_LIVE_CONFIRM=I_UNDERSTAND_REAL_MONEY
```

Start:

```bash
bash scripts/start-galka-live.sh
```

The server binds only to `127.0.0.1` and opens:

```text
http://127.0.0.1:8098/terminal/live.html
```

## Safety behavior

- Refuses a new campaign when the selected coin already has a real position or any open order.
- Checks free margin before placement.
- Persists each entry/TP pair immediately after placement.
- On partial creation failure, cancels all newly created coin orders. If a position appeared during the failure, it places a fallback reduce-only limit at GALKA and stops after that position closes.
- Tracks only order IDs created by the campaign.
- Uses exchange-native child TP orders so an already-filled entry retains its GALKA exit even if Android pauses the local process.
- Reconciles fills and open orders after reconnect.
- Normal cancellation is disabled once the campaign has an open managed position.
- Emergency close cancels campaign orders and closes the complete coin position by an aggressive reduce-only IOC; it can also close an unrelated manual position on that coin and therefore requires two confirmations.

## Promotion checklist

1. CI syntax, unit, allocation, and lifecycle tests pass.
2. Termux installs the SDK successfully on the user's Python version.
3. Read-only launch shows the correct main account, balance, mids, and Hyperliquid candles.
4. Testnet or controlled mainnet preview produces eight valid orders and expected margin.
5. Minimum-size real smoke test verifies one entry plus native TP.
6. L1 rearm and L2+ completion are verified with exchange order history.
7. Notifications and reconnect behavior are verified on the Samsung S24.
8. Only then consider increasing notional or merging.
