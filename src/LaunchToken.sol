// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Fixed-supply, plain-transfer launch token. The factory allocates the supply.
contract LaunchToken is ERC20 {
    /// @notice Read-only PvP eligibility; token transfers remain unrestricted.
    uint256 public constant PVP_MINIMUM_HOLDING = 50_000 ether;

    constructor() ERC20("Cabal Coin", "CABAL") {
        _mint(msg.sender, 1_000_000_000 ether);
    }

    /// @dev The authoritative game server binds this wallet to a fresh signature
    /// and checks eligibility at every queue entry. This grants no game session.
    function isPvpEligible(address account) external view returns (bool) {
        return balanceOf(account) >= PVP_MINIMUM_HOLDING;
    }
}
