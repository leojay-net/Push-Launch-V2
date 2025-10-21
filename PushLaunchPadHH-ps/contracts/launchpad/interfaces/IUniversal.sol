// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

/// @notice Universal Account ID Struct from Push Chain
/// @dev Represents the origin identity of a user across different chains
struct UniversalAccountId {
    string chainNamespace; // e.g., "eip155" for Ethereum, "solana" for Solana
    string chainId; // e.g., "1" for Ethereum mainnet, "11155111" for Sepolia
    bytes owner; // The actual address/pubkey on the origin chain
}

/// @notice Interface for UEA (Universal Execution Account) Factory
/// @dev This is a system contract on Push Chain at address 0x00000000000000000000000000000000000000eA
interface IUEAFactory {
    /**
     * @dev Returns the owner key (UOA) for a given UEA address
     * @param addr Any given address (msg.sender) on push chain
     * @return account The Universal Account information associated with this UEA
     * @return isUEA True if the address is a UEA contract, false if it's a native Push Chain EOA
     */
    function getOriginForUEA(
        address addr
    ) external view returns (UniversalAccountId memory account, bool isUEA);
}
