# Reclaim trailing exit

The Galka paper bot remains long-only. New campaigns use `Reclaim trail` by default.

1. The bot fills the six planned long limits below V-low.
2. It does not close on the first return to V-low.
3. Trailing mode activates after bid reaches `V-low + reclaimBufferPct` (default 0.10%).
4. Initial stop is V-low.
5. The high-water mark records the highest bid after activation.
6. The stop is `max(V-low, high-water mark × (1 − trailDistancePct))` (default distance 0.75%).
7. The stop may rise but can never fall.
8. A stop hit exits with taker fee and configured slippage.
9. Activation resets the holding timer, giving the trail the configured maximum holding period.
10. The legacy immediate V-low target remains selectable for A/B comparison.

This is paper execution only and must be evaluated historically before live capital is considered.
