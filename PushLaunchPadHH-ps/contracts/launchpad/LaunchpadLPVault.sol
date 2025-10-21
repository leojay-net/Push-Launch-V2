// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.27;

import {Ownable2StepUpgradeable} from "@openzeppelin-contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {IERC721Receiver} from "@openzeppelin/token/ERC721/IERC721Receiver.sol";
import {INonfungiblePositionManager} from "./interfaces/INonfungiblePositionManager.sol";

contract LaunchpadLPVault is Ownable2StepUpgradeable, IERC721Receiver {
    /*▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀
                                ERRORS
    ▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀*/

    /// @dev sig: 0xaf62991d
    error FallbackRevert();
    /// @dev sig: 0x7e273289
    error OnlyPositionManager();
    /// @dev sig: 0xd92e233d
    error NoPositionForToken();

    /*▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀
                                EVENTS
    ▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀*/

    event PositionReceived(address indexed token, uint256 indexed tokenId, uint128 liquidity);
    event FeesCollected(address indexed token, uint256 indexed tokenId, uint256 amount0, uint256 amount1);

    /*▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀
                                STATES
    ▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀*/

    address public launchpad;
    INonfungiblePositionManager public positionManager;

    /// @dev The abi version of this impl so the indexer can handle event-changing upgrades
    uint256 public constant ABI_VERSION = 2;  // Incremented for V3

    /// @notice Maps launch token address to its V3 position NFT tokenId
    mapping(address token => uint256 tokenId) public tokenPositions;

    /// @notice Track all position token IDs held by this vault
    uint256[] public allPositions;

    /*▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀
                    CONSTRUCTOR AND INITIALIZATION
    ▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀*/

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address launchpad_,
        address positionManager_,
        address initialOwner
    ) external initializer {
        launchpad = launchpad_;
        positionManager = INonfungiblePositionManager(positionManager_);
        __Ownable_init(initialOwner);
    }

    /*▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀
                            ERC721 RECEIVER
    ▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀*/

    /// @notice Required to receive V3 position NFTs
    /// @dev Called when position NFT is transferred via safeTransferFrom
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        // Only accept NFTs from the position manager
        if (msg.sender != address(positionManager)) revert OnlyPositionManager();

        // Decode launch token address from data
        address token = abi.decode(data, (address));

        // Store position mapping
        tokenPositions[token] = tokenId;
        allPositions.push(tokenId);

        // Get position details for event
        (,,,,,,, uint128 liquidity,,,,) = positionManager.positions(tokenId);

        emit PositionReceived(token, tokenId, liquidity);

        return this.onERC721Received.selector;
    }

    /*▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀
                            FEE COLLECTION
    ▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀*/

    /// @notice Collect accumulated trading fees from a position
    /// @param token The launch token whose position fees to collect
    function collectFees(address token) external onlyOwner returns (uint256 amount0, uint256 amount1) {
        uint256 tokenId = tokenPositions[token];
        if (tokenId == 0) revert NoPositionForToken();

        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: address(this),  // Fees collected to vault
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });

        (amount0, amount1) = positionManager.collect(params);

        emit FeesCollected(token, tokenId, amount0, amount1);
    }

    /// @notice Get uncollected fee amounts for a position
    function getUnclaimedFees(address token) external view returns (uint256 amount0, uint256 amount1) {
        uint256 tokenId = tokenPositions[token];
        if (tokenId == 0) revert NoPositionForToken();

        (,,,,,,, uint128 liquidity,,, uint128 tokensOwed0, uint128 tokensOwed1) = positionManager.positions(tokenId);

        return (tokensOwed0, tokensOwed1);
    }

    /*▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀
                                FALLBACKS
    ▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀*/

    fallback() external {
        revert FallbackRevert();
    }
}
