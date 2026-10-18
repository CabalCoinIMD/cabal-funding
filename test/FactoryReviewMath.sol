// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @dev Local compatibility fixture only. Not part of a production manifest.
contract FactoryReviewMath {
    function seed(bool token0, uint256 amount) external pure
        returns (uint160 price, int24 lower, int24 upper, uint128 liquidity)
    {
        // Approximately the current 2,500 IMD opening cap, with aligned boundary ticks.
        lower = token0 ? int24(-129000) : int24(-887220);
        upper = token0 ? int24(887220) : int24(129000);
        uint160 a = TickMath.getSqrtPriceAtTick(lower);
        uint160 b = TickMath.getSqrtPriceAtTick(upper);
        price = token0 ? a : b;
        uint256 q96 = 1 << 96;
        uint256 l = token0
            ? FullMath.mulDiv(amount, FullMath.mulDiv(a, b, q96), b - a)
            : FullMath.mulDiv(amount, q96, b - a);
        require(l <= type(uint128).max);
        liquidity = uint128(l);
    }
}
