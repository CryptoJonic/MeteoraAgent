import unittest

from live.live_ladder import MANUAL_DEPTHS, MIN_ORDER_NOTIONAL, build_ladder, weighted_average


class LiveLadderTests(unittest.TestCase):
    def test_small_account_keeps_eight_valid_orders(self):
        levels = build_ladder(60_000, 150, 5)
        self.assertEqual(len(levels), 8)
        self.assertEqual(tuple(level.depth_pct for level in levels), MANUAL_DEPTHS)
        self.assertTrue(all(level.notional >= float(MIN_ORDER_NOTIONAL) for level in levels))
        self.assertLessEqual(sum(level.notional for level in levels), 150.01)
        self.assertGreater(levels[0].notional, levels[-1].notional)
        self.assertLess(weighted_average(levels), 60_000)

    def test_too_small_total_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "require at least"):
            build_ladder(60_000, 50, 5)

    def test_sol_precision_and_two_percent_depth(self):
        levels = build_ladder(150, 150, 2)
        self.assertAlmostEqual(levels[-1].price, 147.0, places=4)
        self.assertTrue(all(level.notional >= 10 for level in levels))


if __name__ == "__main__":
    unittest.main()
