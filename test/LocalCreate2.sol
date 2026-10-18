// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
/// @dev Test fixture only. Never include this contract in a launch deployment.
contract LocalCreate2 {
    function deploy(bytes32 salt, bytes memory code) external returns(address deployed) {
        assembly { deployed := create2(0,add(code,32),mload(code),salt) }
        require(deployed!=address(0),"fixture deployment failed");
    }
}
