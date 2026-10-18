// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {LaunchToken} from "../src/LaunchToken.sol";

contract LaunchTokenTest {
    function testPvpBoundaryAndSellingBelowRequirement() public {
        LaunchToken token = new LaunchToken();
        uint256 minimum = 50_000 ether;
        require(token.PVP_MINIMUM_HOLDING() == minimum);
        require(!token.isPvpEligible(address(0x1234)));
        token.transfer(address(0x1234), minimum - 1);
        require(!token.isPvpEligible(address(0x1234)));
        token.transfer(address(0x1234), 1);
        require(token.isPvpEligible(address(0x1234)));
        // Transfer away the deployer's balance down to the exact boundary,
        // then one atomic unit below it. Eligibility is never cached or sticky.
        token.transfer(address(0x2345), token.balanceOf(address(this)) - minimum);
        require(token.isPvpEligible(address(this)));
        token.transfer(address(0x2345), 1);
        require(!token.isPvpEligible(address(this)));
        require(token.totalSupply() == 1_000_000_000 ether);
        require(token.balanceOf(address(0x1234)) == minimum);
    }
    function testFactoryReceivesExactSupplyAndTransfersStayPlain() public {
        LaunchToken token = new LaunchToken();
        require(token.totalSupply() == 1_000_000_000 ether);
        require(token.balanceOf(address(this)) == token.totalSupply());
        require(token.decimals() == 18);
        token.transfer(address(0x1234), 100 ether);
        require(token.balanceOf(address(0x1234)) == 100 ether);
        require(token.balanceOf(address(this)) == token.totalSupply() - 100 ether);
        (bool mintable,) = address(token).call(abi.encodeWithSignature("mint(address,uint256)",address(this),1));
        require(!mintable);
    }
}
