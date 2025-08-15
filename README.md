# Bitcoin Abstraction Layer

> :warning: This project is under heavy development. Expect bugs & breaking changes.

Query different blockchains with account management using a single and simple interface.

## Dependencies

This repository is a standalone project based off of [Chainify](https://github.com/liquality/chainify), with heavy modifications to the core Bitcoin wallet libaries. There are no dependencies on the upstream project.

## Chain Support

#### Bitcoin:

[bitcoin-cfd-provider](./packages/bitcoin-cfd-provider)
[bitcoin-dlc-provider](./packages/bitcoin-dlc-provider)
[bitcoin-wallet-provider](./packages/bitcoin-wallet-provider)

## Packages

|Package|Version|
|---|---|
|[@atomicfinance/bitcoin-cfd-provider](./packages/bitcoin-cfd-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/bitcoin-cfd-provider.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-cfd-provider)|
|[@atomicfinance/bitcoin-dlc-provider](./packages/bitcoin-dlc-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/bitcoin-dlc-provider.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-dlc-provider)|
|[@atomicfinance/bitcoin-esplora-api-provider](./packages/bitcoin-esplora-api-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/bitcoin-esplora-api-provider.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-esplora-api-provider)
|[@atomicfinance/bitcoin-esplora-batch-api-provider](./packages/bitcoin-esplora-batch-api-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/bitcoin-esplora-batch-api-provider.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-esplora-batch-api-provider)
|[@atomicfinance/bitcoin-js-wallet-provider](./packages/bitcoin-js-wallet-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/bitcoin-js-wallet-provider.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-js-wallet-provider)
|[@atomicfinance/bitcoin-utils](./packages/bitcoin-utils)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/bitcoin-utils.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-utils)
|[@atomicfinance/bitcoin-wallet-provider](./packages/bitcoin-wallet-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/bitcoin-wallet-provider.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-wallet-provider)|
|[@atomicfinance/client](./packages/client)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/client.svg)](https://npmjs.com/package/@atomicfinance/client)|
|[@atomicfinance/jsonrpc-provider](./packages/jsonrpc-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/jsonrpc-provider.svg)](https://npmjs.com/package/@atomicfinance/jsonrpc-provider)|
|[@atomicfinance/bitcoin-rpc-provider](./packages/bitcoin-rpc-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/bitcoin-rpc-provider.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-rpc-provider)|
|[@atomicfinance/bitcoin-node-wallet-provider](./packages/bitcoin-node-wallet-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/bitcoin-node-wallet-provider.svg)](https://npmjs.com/package/@atomicfinance/bitcoin-node-wallet-provider)|
|[@atomicfinance/provider](./packages/provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/provider.svg)](https://npmjs.com/package/@atomicfinance/provider)
|[@atomicfinance/types](./packages/types)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/types.svg)](https://npmjs.com/package/@atomicfinance/types)
|[@atomicfinance/utils](./packages/utils)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/utils.svg)](https://npmjs.com/package/@atomicfinance/utils)
|[@atomicfinance/crypto](./packages/crypto)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/crypto.svg)](https://npmjs.com/package/@atomicfinance/crypto)
|[@atomicfinance/errors](./packages/errors)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/errors.svg)](https://npmjs.com/package/@atomicfinance/errors)
|[@atomicfinance/node-provider](./packages/node-provider)|[![Bitcoin-Abstraction-Layer](https://img.shields.io/npm/v/@atomicfinance/node-provider.svg)](https://npmjs.com/package/@atomicfinance/node-provider)


## DLC Spec Compliance

`@atomicfinance/bitcoin-dlc-provider` builds on [`@node-dlc/messaging`](https://github.com/AtomicFinance/node-dlc), [`@node-dlc/core`](https://github.com/AtomicFinance/node-dlc) and [`cfd-dlc-js`](https://github.com/p2pderivatives/cfd-dlc-js/) and adds wallet support for some parts of the [Dlc Specification](https://github.com/discreetlogcontracts/dlcspecs).

Implemented features:
- Dlc Offer, Accept, Sign message generation support, including utxo selection and validation
- Finalize and broadcast Dlc Sign message support
- Execute and Refund support
- Mutual Close support
- HyperbolaPayoutCurve payout generation support
- DigitDecompositionEventDescriptor support
- ContractInfo V0 and V1 support
- ContractDescriptorV1 support

Missing features:
- PolynomialPayoutCurve payout generation support
- EnumEventDescriptor support
- ContractInfoV1 support
- ContractDescriptorV0 support

## Usage

```typescript
import Client from '@atomicfinance/client'
import BitcoinCfdProvider from '@atomicfinance/bitcoin-cfd-provider'
import BitcoinDlcProvider from '@atomicfinance/bitcoin-dlc-provider'
import BitcoinWalletProvider from '@atomicfinance/bitcoin-wallet-provider'
import BitcoinJsWalletProvider from '@atomicfinance/bitcoin-js-wallet-provider'
import BitcoinNetworks from 'bitcoin-networks'

const network = BitcoinNetworks.bitcoin_testnet

const bitcoin = new Client()
bitcoin.addProvider(new BitcoinJsWalletProvider({
	network,
	mnemonic: 'mnemonic_here',
	baseDerivationPath: `m/84'/${network.coinType}'/0'`,
	addressType: 'bech32',
}))
bitcoin.addProvider(new BitcoinCfdProvider(network));
bitcoin.addProvider(new BitcoinDlcProvider(network));
bitcoin.addProvider(new BitcoinWalletProvider(network));

const offerMessage = await alice.dlc.createDlcOffer(...)
```

## Development

```bash
pnpm install
pnpm run build
```

## Changeset Versioning

We use [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. When creating a pull request, include a summary of your changes in a changeset by running:

```bash
pnpm changeset
```

To bump the packages to the proper semantic version and publish:

```bash
pnpm version
pnpm publish
```

## Production

```bash
pnpm build
```
