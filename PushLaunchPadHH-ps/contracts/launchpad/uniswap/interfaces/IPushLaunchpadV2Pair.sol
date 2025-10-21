// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

// Only launchpad-specific functions, pair contract implements IUniswapV2Pair from univ2-core
interface IPushLaunchpadV2Pair {
    // Custom launchpad functions only
    function rewardsPoolActive() external view returns (uint256);
    function accruedLaunchpadFee0() external view returns (uint112);
    function accruedLaunchpadFee1() external view returns (uint112);
    function launchpadLp() external view returns (address);
    function launchpadFeeDistributor() external view returns (address);
    function REWARDS_FEE_SHARE() external view returns (uint256);

    function endRewardsAccrual() external;
}
