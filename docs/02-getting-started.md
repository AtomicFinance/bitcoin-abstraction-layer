# Getting Started with Bitcoin Abstraction Layer (BAL)

This guide will walk you through the basics of using the Bitcoin Abstraction Layer (BAL). By the end of this guide, you should have a good understanding of how to install and use the BAL.

### Prerequisites

Before you can use the BAL, you need to have Node.js and npm (Node Package Manager) installed on your machine. You can download Node.js and npm from the official website.

### Installation

You can install the BAL using npm. Open your terminal and run the following command:

```bash
pnpm add @atomicfinance/client
pnpm add @atomicfinance/bitcoin-cfd-provider
pnpm add @atomicfinance/bitcoin-dlc-provider
pnpm add @atomicfinance/bitcoin-wallet-provider
pnpm add @atomicfinance/bitcoin-js-wallet-provider
pnpm add bitcoin-network
```

And add [cfd-js](https://github.com/atomicfinance/cfd-dlc-js) and [cfd-dlc-js](https://github.com/atomicfinance/cfd-dlc-js)

```bash
pnpm add https://github.com/cryptogarageinc/cfd-js.git#v0.3.4
pnpm add https://github.com/atomicfinance/cfd-dlc-js.git#v0.0.34
```

Lastly add node-dlc modules

```bash
pnpm add @node-dlc/messaging
```

This will install the BAL and its dependencies.

### Basic Usage

Here's a basic example of how to use the BAL:

```ts
import Client from '@atomicfinance/client';
import { BitcoinRpcProvider } from '@atomicfinance/bitcoin-rpc-provider';
import { BitcoinJsWalletProvider } from '@atomicfinance/bitcoin-js-wallet-provider';
import { BitcoinCfdProvider } from '@atomicfinance/bitcoin-cfd-provider';
import { BitcoinDlcProvider } from '@atomicfinance/bitcoin-dlc-provider';
import { bitcoin } from '@atomicfinance/types';
import { BitcoinNetworks } from 'bitcoin-networks';
import * as cfdJs from 'cfd-js';
import cfdDlcJs from 'cfd-dlc-js';

const network = BitcoinNetworks.bitcoin_testnet

// Instantiate Client
const client = new Client()
// Add Chain Provider
client.addProvider(new BitcoinRpcProvider({
	uri: 'rpc_host',
	username: 'rpc_username',
	password: 'rpc_password',
	network,
}))
// Add Wallet Provider
client.addProvider(new BitcoinJsWalletProvider({
	network,
	mnemonic: 'mnemonic_here',
	baseDerivationPath: `m/84'/${network.coinType}'/0'`,
	addressType: bitcoin.AddressType.BECH32,
}))
// Add DLC Providers
client.addProvider(new BitcoinCfdProvider(cfdJs));
client.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));

const offerMessage = await client.dlc.createDlcOffer(...)
```

You can swap out providers. For example you can use `BitcoinEsploraApiProvider` instead

```ts
import { BitcoinEsploraApiProvider } from '@atomicfinance/bitcoin-esplora-api-provider';
...

// Instantiate Client
const client = new Client()
// Add Chain Provider
client.addProvider(new BitcoinEsploraApiProvider({ // Replace with Esplora API Provider
	url: 'https://blockstream.info/api'
	network,
}))
// Add Wallet Provider
client.addProvider(new BitcoinJsWalletProvider({
	network,
	mnemonic: 'mnemonic_here',
	baseDerivationPath: `m/84'/${network.coinType}'/0'`,
	addressType: bitcoin.AddressType.BECH32,
}))
// Add DLC Providers
client.addProvider(new BitcoinCfdProvider(cfdJs));
client.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));

const offerMessage = await client.dlc.createDlcOffer(...)
```

Or use the `BitcoinNodeWalletProvider` instead

```ts
import { BitcoinNodeWalletProvider } from '@atomicfinance/bitcoin-node-wallet-provider';
...

// Instantiate Client
const client = new Client()
// Add Chain Provider
client.addProvider(new BitcoinEsploraApiProvider({ // Replace with Esplora API Provider
	url: 'https://blockstream.info/api'
	network,
}))
// Add Wallet Provider
client.addProvider(new BitcoinNodeWalletProvider({
	uri: 'rpc_host',
	username: 'rpc_username',
	password: 'rpc_password',
	network,
	addressType: bitcoin.AddressType.BECH32,
}))
// Add DLC Providers
client.addProvider(new BitcoinCfdProvider(cfdJs));
client.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));

const offerMessage = await client.dlc.createDlcOffer(...)
```

### Creating a DLC Example

Once you have the Client instantiated, you can construct and sign DLCs

#### Contract Descriptor

Contains the financial information about the contract and how payout curve / outcomes should be constructed and signed

```ts
import { ContractDescriptorV0 } from '@node-dlc/messaging';

const contractDescriptor = new ContractDescriptorV0();
contractDescriptor.outcomes = [{
	outcome: 'BIDEN_WIN',
	localPayout: BigInt(1e6)
}, {
	outcome: 'BIDEN_LOSE',
	localPayout: BigInt(0)
}];
```

#### Oracle Info

Contains the oracle information about the contract

```ts
import { OracleInfoV0, OracleAnnouncementV0 } from '@node-dlc/messaging';

const oracleInfo = new OracleInfoV0();
oracleInfo.announcement = OracleAnnouncementV0.deserialize(Buffer.from('insert_announcement_hex', 'hex')) 
// find the announcement hex from an oracle provide: https://oracle.suredbits.com/
```

#### Contract Info

```ts
import { ContractInfoV0 } from '@node-dlc/messaging';

const contractInfo = new ContractInfoV0;
contractInfo.totalCollateral = BigInt(1e6);
contractInfo.contractDescriptor = contractDescriptor;
contractInfo.oracleInfo = oracleInfo;
```

#### DLC Offer

```ts
const offerCollateral = BigInt(500000); // 500,000 sats
const feeRate = BigInt(15); // 15 sat/vB
const cetLocktime = Math.floor(new Date().getTime() / 1000);

const refundDate = new Date();
refundDate.setMonth(refundDate.getMethod() + 2)
const refundLocktime = Math.floor(refundDate.getTime() / 1000);

const dlcOffer = await client.dlc.createDlcOffer(
	contractInfo,
	offerCollateral,
	feeRate,
	cetLocktime,
	refundLocktime,
)
```

#### Dlc Accept

Your counterparty should generate the accept message. `acceptDlcOffer` validates the `DlcOffer`, and signs all the execution transactions.

```ts
const { dlcAccept, dlcTransactions } = await client.dlc.acceptDlcOffer(dlcOffer)
```

#### Dlc Sign

`signDlcAccept` validates the `DlcAccept`, signs all execution transactions, and signs the necessary funding transaction signatures.

```ts
const { dlcSign, dlcTransactions } = await client.dlc.signDlcAccept(dlcOffer, dlcAccept)
```

#### Broadcast

Your counterparty should run this step. 

```ts
const fundTx = await client.dlc.finalizeDlcSign(dlcOffer, dlcAccept, dlcSign, dlcTransactions)

const fundTxId = await client.chain.sendRawTransaction(
	fundTx.serialize().toString('hex'),
);
```

### Adding Providers

To use the BAL, you need to add providers that implement the functionality you need. The BAL currently supports the following types of providers:

#### Chain Provider

A Chain Provider interacts with the Bitcoin network. It is responsible for operations such as retrieving block information and sending transactions to the network. You can use an RPC provider if you're running a local Bitcoin node, or an Esplora provider if you're using the Esplora block explorer API.

#### Wallet Provider

A Wallet Provider manages a Bitcoin wallet. It is responsible for operations such as creating addresses, signing transactions, and managing the wallet's balance.

#### CFD Provider

A CFD (Crypto Finance Development Kit) Provider is a wrapper for cfd-js which is a base library for cfd-dlc-js.

#### DLC Provider

A DLC (Discreet Log Contract) Provider is used for creating and managing DLCs. DLCs are a type of smart contract that allows for trustless, private bets on external events.

To add a provider, you create an instance of it and then add it to the BAL client using the addProvider method. The order in which you add providers matters, as the BAL uses the first provider it finds that can perform a given operation.
