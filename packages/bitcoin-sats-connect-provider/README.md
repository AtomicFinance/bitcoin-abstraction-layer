# @atomicfinance/bitcoin-sats-connect-provider

Bitcoin provider for DLC operations with SatsConnect-compatible wallets.

## Overview

This package provides a `BitcoinSatsConnectProvider` that integrates with SatsConnect-compatible wallets (including Fordefi) for DLC operations. It's designed for the **offerer side** of DLC contracts.

## Installation

```bash
npm install @atomicfinance/bitcoin-sats-connect-provider
```

## Features

### Supported Operations (as DLC Offerer)

- `createDlcOffer()` - Create DLC offers with fixed inputs
- `signDlcAccept()` - Sign the accept message (funding, refund, CET adaptor signatures)
- `signCetForExecution()` - Sign CET for execution
- `getAddresses()` / `getPaymentAddress()` / `getOrdinalsAddress()`
- `isConnected()`

### Contract Types

- **Enum contracts only** - Only `EnumeratedDescriptor` contracts are supported (not numeric)

## Usage

### With FordefiWalletEmulator (for testing)

```typescript
import {
  BitcoinSatsConnectProvider,
  FordefiWalletEmulator,
} from '@atomicfinance/bitcoin-sats-connect-provider';
import * as ddkJs from '@bennyblader/ddk-ts';
import { BitcoinNetworks } from 'bitcoin-network';

const network = BitcoinNetworks.bitcoin_regtest;

// Create wallet emulator for testing
const wallet = new FordefiWalletEmulator({
  network,
  privateKey: 'your-private-key-hex', // 64 hex chars
  ddk: ddkJs,
});

// Create provider
const satsConnectProvider = new BitcoinSatsConnectProvider({
  network,
  wallet,
  ddk: ddkJs,
});

// Add to client
client.addProvider(satsConnectProvider);
```

### With Real SatsConnect Wallet

```typescript
import { BitcoinSatsConnectProvider } from '@atomicfinance/bitcoin-sats-connect-provider';
import * as ddkJs from '@bennyblader/ddk-ts';

// Your SatsConnect-compatible wallet must implement WalletInterface
const wallet: WalletInterface = yourSatsConnectWallet;

const satsConnectProvider = new BitcoinSatsConnectProvider({
  network,
  wallet,
  ddk: ddkJs,
});
```

### WalletInterface

Any wallet passed to the provider must implement:

```typescript
interface WalletInterface {
  request<T>(method: string, params?: unknown): Promise<SatsConnectResponse<T>>;
}

interface SatsConnectResponse<T> {
  status: 'success' | 'error';
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}
```

Required methods:
- `getAddresses` - Returns wallet addresses
- `dlc_signOffer` - Signs funding, refund, and creates CET adaptor signatures
- `signPsbt` - Standard PSBT signing (for CET execution)
- `wallet_getAccount` - Connection check

## DLC Flow Example

```typescript
// 1. Create DLC offer (offerer)
const dlcOffer = await client.dlc.createDlcOffer(
  contractInfo,
  offerCollateralSatoshis,
  feeRatePerVb,
  cetLocktime,
  refundLocktime,
  fixedInputs,
);

// 2. Accept DLC offer (accepter - uses BitcoinDdkProvider)
const { dlcAccept, dlcTransactions } = await accepterClient.dlc.acceptDlcOffer(dlcOffer);

// 3. Sign DLC accept (offerer - uses BitcoinSatsConnectProvider)
const { dlcSign } = await client.dlc.signDlcAccept(dlcOffer, dlcAccept, dlcTransactions);

// 4. Finalize and broadcast funding transaction
const fundingTx = await accepterClient.dlc.finalizeDlcSign(
  dlcOffer,
  dlcAccept,
  dlcSign,
  dlcTransactions,
);

// 5. Execute CET when oracle attests
const cet = await client.dlc.execute(
  dlcOffer,
  dlcAccept,
  dlcSign,
  dlcTransactions,
  oracleAttestation,
  outcomeIndex,
);
```

## Requirements

- **DDK** - You must provide a DDK instance (`@bennyblader/ddk-ts`) for adaptor signature creation
- **Wallet** - A SatsConnect-compatible wallet or the included `FordefiWalletEmulator`

## Components

### BitcoinSatsConnectProvider

Main provider class that handles DLC operations by delegating signing to a SatsConnect-compatible wallet.

### FordefiWalletEmulator

A local wallet emulator for testing that implements the `WalletInterface`. It uses DDK directly to create adaptor signatures, simulating what Fordefi wallet does.

```typescript
const emulator = new FordefiWalletEmulator({
  network,
  privateKey: 'hex-private-key', // or WIF format
  // OR use mnemonic:
  mnemonic: 'your twelve word mnemonic phrase ...',
  baseDerivationPath: "m/84'/0'/0'",
  ddk: ddkJs,
});
```

## License

MIT
