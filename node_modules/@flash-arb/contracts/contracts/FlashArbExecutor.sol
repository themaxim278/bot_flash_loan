// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IAaveFlashLoanCallback {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

contract FlashArbExecutor is Ownable, Pausable {
    event Simulated(address indexed initiator, uint256 amountIn, uint256 amountOut);
    event Executed(address indexed initiator, uint256 profit, bytes details);
    event Reverted(address indexed initiator, string reason);
    error PausedOrLossLimit();
    event LossLimitTriggered(uint256 day, uint256 totalLossWei);
    uint256 public dailyLossLimitWei;
    mapping(uint256 => uint256) public lossesByDay;

    struct GuardParams {
        uint256 deadline;
        uint256 minAmountOut;
        uint256 slippageBpsMax;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setDailyLossLimitWei(uint256 limit) external onlyOwner {
        dailyLossLimitWei = limit;
    }

    function recordLoss(uint256 day, uint256 lossWei) external onlyOwner {
        lossesByDay[day] += lossWei;
        if (dailyLossLimitWei > 0 && lossesByDay[day] > dailyLossLimitWei) {
            emit LossLimitTriggered(day, lossesByDay[day]);
        }
    }

    function _checkPauseOrLossLimit() internal view {
        uint256 day = block.timestamp / 1 days;
        if (paused() || (dailyLossLimitWei > 0 && lossesByDay[day] > dailyLossLimitWei)) {
            revert PausedOrLossLimit();
        }
    }

    // Placeholder: actual flash loan initiation handled off-chain via Aave V3 Pool
    function executeOperation(
        address[] calldata /*assets*/,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        _checkPauseOrLossLimit();
        // Decode guard params and expected output
        (GuardParams memory gp, uint256 expectedOut) = abi.decode(params, (GuardParams, uint256));

        // deadline guard
        if (block.timestamp > gp.deadline) {
            emit Reverted(initiator, "deadline-expired");
            revert("deadline-expired");
        }

        // slippage guard (placeholder: compares expectedOut to minAmountOut and slippage cap)
        require(expectedOut >= gp.minAmountOut, "min-amount-out");

        // simulate repay check: amounts[0] + premiums[0] must be covered by expectedOut
        uint256 repay = amounts[0] + premiums[0];
        require(expectedOut >= repay, "repay-not-covered");

        uint256 profit = expectedOut - repay;
        emit Executed(initiator, profit, params);
        return true;
    }

    // Purely off-chain facing helper: runs guards without reverting, emits Simulated/Reverted
    function simulateOperation(
        address[] calldata /*assets*/,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        _checkPauseOrLossLimit();
        (GuardParams memory gp, uint256 expectedOut) = abi.decode(params, (GuardParams, uint256));

        emit Simulated(initiator, amounts[0], expectedOut);

        if (block.timestamp > gp.deadline) {
            emit Reverted(initiator, "deadline-expired");
            return false;
        }
        if (expectedOut < gp.minAmountOut) {
            emit Reverted(initiator, "min-amount-out");
            return false;
        }
        uint256 repay = amounts[0] + premiums[0];
        if (expectedOut < repay) {
            emit Reverted(initiator, "repay-not-covered");
            return false;
        }
        return true;
    }
}

// remove accidental declarations outside the contract