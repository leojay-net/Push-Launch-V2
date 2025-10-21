// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "../../univ2-core/interfaces/IUniswapV2Factory.sol";
import "./PushLaunchpadV2Pair.sol";

contract PushLaunchpadV2PairFactory is IUniswapV2Factory {
    address public launchpad;
    address public launchpadLp;
    address public launchpadFeeDistributor;

    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event LaunchpadAddressesUpdated(
        address indexed launchpad,
        address indexed launchpadLp,
        address indexed launchpadFeeDistributor
    );

    constructor(
        address _feeToSetter,
        address _launchpad,
        address _launchpadLp,
        address _launchpadFeeDistributor
    ) {
        feeToSetter = _feeToSetter;
        launchpad = _launchpad;
        launchpadLp = _launchpadLp;
        launchpadFeeDistributor = _launchpadFeeDistributor;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair) {
        if (tokenA == tokenB) revert("UniswapV2: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        if (token0 == address(0)) revert("UniswapV2: ZERO_ADDRESS");
        if (getPair[token0][token1] != address(0))
            revert("UniswapV2: PAIR_EXISTS"); // single check is sufficient
        bytes memory bytecode = type(PushLaunchpadV2Pair).creationCode;

        (address _launchpadLp, address _launchpadFeeDistributor) = msg.sender ==
            launchpad
            ? (launchpadLp, launchpadFeeDistributor)
            : (address(0), address(0));

        bytes32 salt = keccak256(
            abi.encodePacked(
                token0,
                token1,
                _launchpadLp,
                _launchpadFeeDistributor
            )
        );
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IUniswapV2Pair(pair).initialize(
            token0,
            token1,
            _launchpadLp,
            _launchpadFeeDistributor
        );
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        if (msg.sender != feeToSetter) revert("UniswapV2: FORBIDDEN");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        if (msg.sender != feeToSetter) revert("UniswapV2: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }

    /**
     * @notice Updates the launchpad-related addresses
     * @dev Only callable by feeToSetter. This allows updating launchpad addresses
     *      after deployment to enable special fee-enabled pairs for launchpad graduations.
     * @param _launchpad Address of the launchpad contract
     * @param _launchpadLp Address of the launchpad LP vault
     * @param _launchpadFeeDistributor Address of the fee distributor
     */
    function setLaunchpadAddresses(
        address _launchpad,
        address _launchpadLp,
        address _launchpadFeeDistributor
    ) external {
        if (msg.sender != feeToSetter) revert("UniswapV2: FORBIDDEN");
        launchpad = _launchpad;
        launchpadLp = _launchpadLp;
        launchpadFeeDistributor = _launchpadFeeDistributor;
        emit LaunchpadAddressesUpdated(
            _launchpad,
            _launchpadLp,
            _launchpadFeeDistributor
        );
    }
}
