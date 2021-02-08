# Chain Abstraction Layer Finance

> :warning: This project is under heavy development. Expect bugs & breaking changes.

Query different blockchains with account management using a single and simple interface.

## Dependencies

This repository was built as an extension to the [ChainAbstractionLayer](https://github.com/liquality/chainabstractionlayer) maintained by the core contributors of [Liquality](https://liquality.io). It is necessary to include the `Client` and `providers` from the `@liquality` npm packages in order to use providers such as the `BitcoinDlcProvider`.

## Chain Support

#### Bitcoin:

[bitcoin-cfd-provider](./packages/bitcoin-cfd-provider)
[bitcoin-dlc-provider](./packages/bitcoin-dlc-provider)
[bitcoin-wallet-provider](./packages/bitcoin-wallet-provider)

## Packages

|Package|Version|
|---|---|
|[@atomicfinance/bitcoin-cfd-provider](./packages/bitcoin-cfd-provider)|[![ChainAbstractionLayer-Finance](https://img.shields.io/npm/v/@atomicfinance/bitcoin-cfd-provider.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-cfd-provider)|
|[@atomicfinance/bitcoin-dlc-provider](./packages/bitcoin-dlc-provider)|[![ChainAbstractionLayer-Finance](https://img.shields.io/npm/v/@atomicfinance/bitcoin-dlc-provider.svg)](https://npmjs.com/package/@atomicloans/bitcoin-dlc-provider)|
|[@atomicfinance/bitcoin-wallet-provider](./packages/bitcoin-wallet-provider)|[![ChainAbstractionLayer-Finance](https://img.shields.io/npm/v/@atomicfinance/bitcoin-wallet-provider.svg)](https://npmjs.com/package/@atomicloans/bitcoin-wallet-provider)|
|[@atomicfinance/bundle](./packages/bundle)|[![ChainAbstractionLayer-Finance](https://img.shields.io/npm/v/@atomicfinance/bundle.svg)](https://npmjs.com/package/@atomicfinance/bundle)|
|[@atomicfinance/client](./packages/client)|[![ChainAbstractionLayer-Finance](https://img.shields.io/npm/v/@atomicfinance/client.svg)](https://npmjs.com/package/@atomicfinance/client)|
|[@atomicfinance/provider](./packages/provider)|[![ChainAbstractionLayer-Finance](https://img.shields.io/npm/v/@atomicfinance/provider.svg)](https://npmjs.com/package/@atomicfinance/provider)

## Usage

```javascript

import { Client } from '@liquality/bundle'
import BitcoinNetworks from '@liquality/bitcoin-networks'
import BitcoinRpcProvider from '@liquality/bitcoin-rpc-provider'
import BitcoinJsWalletProvider from '@liquality/bitcoin-js-wallet-provider'

import { Client as FinanceClient } from '@atomicfinance/bundle'
import BitcoinCfdProvider from '@atomicfinance/bitcoin-cfd-provider'
import BitcoinDlcProvider from '@atomicfinance/bitcoin-dlc-provider'
import BitcoinWalletProvider from '@atomicfinance/bitcoin-wallet-provider'

const network = BitcoinNetworks.bitcoin_testnet

const bitcoin = new Client()
const bitcoinFinance = new FinanceClient(bitcoin);
bitcoin.finance = bitcoinFinance
bitcoin.addProvider(new BitcoinRpcProvider('https://liquality.io/bitcointestnetrpc/', 'bitcoin', 'local321'))
bitcoin.addProvider(new BitcoinJsWalletProvider(network, '_insert_mnemonic_', 'bech32'))
bitcoin.finance.addProvider(new BitcoinCfdProvider(network));
bitcoin.finance.addProvider(new BitcoinDlcProvider(network));
bitcoin.finance.addProvider(new BitcoinWalletProvider(network));

const offerMessage = await alice.finance.dlc.initializeContractAndOffer(...)
```

## Development

```bash
yarn install
yarn bootstrap
yarn watch
```

## Production

```bash
yarn build
```
