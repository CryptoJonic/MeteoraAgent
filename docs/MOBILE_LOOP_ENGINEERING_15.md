# Mobile Terminal Loop Engineering — 15 iterations

This document records the acceptance target for the first phone-first Galka terminal rebuild.

1. **Branch delivery** — identify why merged changes did not reach the original Termux clone; add migration from the obsolete feature branch to `main`.
2. **History availability** — keep the verified BTC package inside the repository and expose a direct terminal action.
3. **Automatic opening** — load the bundled BTC history on terminal startup; retain a manual retry button.
4. **Vertical layout** — use one-column phone flow: controls, status, metrics, chart, filters, details, list.
5. **Touch targets** — make primary controls at least 44 px high and keep navigation buttons simple.
6. **Rendering performance** — never send all 228k candles to the chart; render a bounded window around the selected trade.
7. **OOS-first review** — default to the untouched `final_oos` trades rather than historical-fit results.
8. **Trade navigation** — provide previous/next controls with position counter.
9. **Result filtering** — filter wins and losses without rebuilding the dataset.
10. **Mode filtering** — distinguish pure long trades from long-to-short failure switches.
11. **Search and sorting** — support trade ID/date search and newest/oldest/best/worst sorting.
12. **Leg transparency** — decode `legs_json` and display each long/short leg, reason and return.
13. **Progress and errors** — show download, unzip, validation and failure states; leave a manual retry path.
14. **Cache and ports** — append commit version to the local URL and select the first available port from 8080–8089.
15. **Regression checks** — validate all phone features, inline JavaScript syntax, bundled history presence and migration logic in CI.

The terminal remains an audit interface. It does not place orders or connect to exchange accounts.
