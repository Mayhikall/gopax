// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GopaxToken} from "../src/GopaxToken.sol";
import {RewardManager} from "../src/RewardManager.sol";

contract DeployScript is Script {
    function run() external returns (GopaxToken token, RewardManager manager) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address rewardSigner = vm.envAddress("REWARD_SIGNER_ADDRESS");

        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        console.log("Deploying Gopax contracts with deployer:", deployer);
        console.log("Treasury address configured as:", treasury);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy GopaxToken
        token = new GopaxToken(deployer);
        console.log("GopaxToken deployed at:", address(token));

        // 2. Deploy RewardManager (maxReward = 100, minReduction = 0, treasury)
        manager = new RewardManager(address(token), deployer, rewardSigner, 100, 0, treasury);
        console.log("RewardManager deployed at:", address(manager));

        // 3. Grant mint authority to RewardManager while deployer remains admin
        token.grantRole(token.MINTER_ROLE(), address(manager));
        console.log("GopaxToken MINTER_ROLE granted to RewardManager");

        vm.stopBroadcast();

        console.log("\nDeployment completed successfully!");
        console.log("====================================");
        console.log("GOPAX_TOKEN_ADDRESS=", address(token));
        console.log("REWARD_MANAGER_ADDRESS=", address(manager));
    }
}
