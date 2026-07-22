# Hardened LIVE changelog

## v3 — 2026-07-22

### Critical correctness

- Added strict per-item parsing for order and cancel results.
- Added independent post-action venue verification for normal cancellation and emergency close.
- Added exchange-position reconciliation and owned-order/CLOID tracking.
- Removed heuristic that treated unknown close-long fills as GALKA targets.
- Added delayed target OID resolution through order status and CLOID.
- Blocked automatic rearm after unknown/manual fills.
- Added recovery workflow that cancels owned entries and maintains reduce-only target coverage.
- Fixed partial L1 remainder duplication before rearm.
- Added three clean flat confirmations before closing recovery.
- Added global orphan position/order watchdog.
- Added one-active-campaign limit and global BTC/ETH/SOL cleanliness check.

### Fail-closed state and risk

- Added SAFE MODE and explicit reconcile action.
- Corrupt state now creates a backup and blocks LIVE.
- State writes are atomic, fsynced, and mode 0600.
- Enforced isolated margin.
- Added finite-number validation for config and exchange responses.
- Added maximum initial margin fraction.
- Added monitor heartbeat/aliveness protection.
- Added bounded request timeout and rate-aware polling intervals.

### Security

- Removed runtime CDN dependency from the LIVE page.
- Restricted static files to `terminal/`.
- Added random session token, Host/Origin/Sec-Fetch-Site checks, CSP and no-store headers.
- Stopped printing the session token to normal launcher output.
- Kept API secret exclusively in the protected Termux config file.

### Testing and operations

- Expanded Python LIVE suite to 44 tests.
- Added server security tests and failure/race/recovery scenarios.
- Added `scripts/verify-galka-live.sh`.
- Added `scripts/check-galka-live-account.sh` read-only online verification.
- Updated static browser checks for the protected local session and local chart implementation.
