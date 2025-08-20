# @atomicfinance/bitcoin-ddk-address-derivation-provider

Bitcoin Abstraction Layer DDK Address Derivation Provider

## Description

This provider implements address derivation functionality using the DDK (DLC Development Kit) library instead of CFD. It provides the same interface as the original AddressDerivationProvider but uses DDK's native cryptographic functions for mnemonic conversion and key derivation.

## Features

- Convert mnemonic to seed using DDK
- Derive extended private keys from parent paths
- Generate Bitcoin addresses from public keys
- Cache derived addresses for performance
- Support for different address types (BECH32, etc.)

## Usage

```typescript
import BitcoinDdkAddressDerivationProvider from '@atomicfinance/bitcoin-ddk-address-derivation-provider';
import * as ddkJs from '@bennyblader/ddk-ts';

const provider = new BitcoinDdkAddressDerivationProvider({
  network: bitcoinNetwork,
  mnemonic: 'your twelve word mnemonic phrase here',
  addressType: bitcoin.AddressType.BECH32,
  baseDerivationPath: "m/84'/0'/0'"
}, ddkJs);

// Get addresses
const addresses = await provider.getAddresses(0, 5, false);
```

## API

### Constructor

- `options.network`: Bitcoin network configuration
- `options.mnemonic`: BIP39 mnemonic phrase
- `options.addressType`: Address type (BECH32, etc.)
- `options.baseDerivationPath`: Base derivation path
- `ddk`: DDK interface instance

### Methods

- `getAddresses(startingIndex, numAddresses, change)`: Get multiple addresses
- `getDerivationPathAddress(path)`: Get address for specific derivation path
- `getDdkDerivationCache()`: Get cached addresses
- `setDdkDerivationCache(cache)`: Set cached addresses
