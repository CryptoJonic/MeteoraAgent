import unittest

from live.hyperliquid_gateway import _parse_user_abstraction, _unified_usdc_values


class HyperliquidGatewayHelpersTests(unittest.TestCase):
    def test_parse_user_abstraction_across_response_shapes(self):
        self.assertEqual(_parse_user_abstraction("unifiedAccount"), "unifiedAccount")
        self.assertEqual(
            _parse_user_abstraction({"abstraction": "unifiedAccount"}),
            "unifiedAccount",
        )
        self.assertEqual(
            _parse_user_abstraction({"type": "portfolioMargin"}),
            "portfolioMargin",
        )
        self.assertEqual(_parse_user_abstraction(None), "default")

    def test_unified_usdc_values_use_total_minus_hold(self):
        account_value, available = _unified_usdc_values(
            {
                "balances": [
                    {"coin": "USDC", "total": "17.97553308", "hold": "0.97553308"},
                    {"coin": "HYPE", "total": "100", "hold": "0"},
                ]
            }
        )
        self.assertAlmostEqual(account_value, 17.97553308)
        self.assertAlmostEqual(available, 17.0)

    def test_unified_usdc_values_never_return_negative_available(self):
        account_value, available = _unified_usdc_values(
            {"balances": [{"coin": "USDC", "total": "1", "hold": "2"}]}
        )
        self.assertEqual(account_value, 1.0)
        self.assertEqual(available, 0.0)


if __name__ == "__main__":
    unittest.main()
