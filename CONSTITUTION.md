# Galka Constitution

## 1. Purpose

Galka exists to test whether a narrowly defined V-reversal setup has durable statistical value after realistic costs and execution constraints.

## 2. Non-negotiable strategy rules

- Every trade must be linked to a detected V-pattern and an immutable `V-low`.
- Entries begin only after a confirmed break below `V-low`.
- The entry ladder has a predefined deepest price.
- No order may be added below the deepest configured limit.
- Maximum monetary loss is calculated before the first order can fill.
- The default target is `V-low`; alternative exits must be separately labelled and compared.

## 3. Research integrity

- No future data may influence pattern detection, entries, sizing or exits.
- Fees, spread, slippage, latency assumptions and partial fills must be explicit.
- In-sample optimization and out-of-sample evaluation must be separated.
- Every reported result must include baselines, parameter ranges and failed variants.
- A model is not selected from net profit alone. Drawdown, stability, trade count, tail loss and parameter sensitivity are mandatory.
- Results must be reproducible from versioned data, code, configuration and random seed.

## 4. Visual auditability

Every trade exported to the terminal must expose:

- V-low and break event;
- planned ladder and actual fills;
- deepest allowed limit;
- average entry and position size;
- target, stop/forced exit and fees;
- maximum planned risk and realized PnL;
- exact strategy/model version and parameters.

## 5. Safety boundary

The repository must not contain exchange API keys, live order placement or unattended execution. Live trading is outside the MVP.

## 6. Change control

A change that violates a strategy invariant must be treated as a new experiment family, never silently merged into the Galka baseline.
