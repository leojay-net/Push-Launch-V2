// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.5.0;

import "../../../univ2-core/interfaces/IUniswapV2ERC20.sol";
import "../../../univ2-core/interfaces/IUniswapV2Pair.sol";

// Combined interface for router use - includes both ERC20 and Pair functions
interface IUniswapV2PairFull is IUniswapV2ERC20, IUniswapV2Pair {
    // This interface combines both ERC20 and Pair functionality
    // for use in routers that need to call both types of functions
}
