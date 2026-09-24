# Bitcoin DDK Provider

A Bitcoin provider that implements DLC (Discreet Log Contract) functionality using the DDK (Discreet Log Contract Development Kit) interface.

## Features

- **Interface-based design**: Uses a `DdkInterface` that allows different DDK implementations to be injected
- **Flexible**: Can work with `ddk-ts`, `ddk-rn`, or any custom DDK implementation
- **Type-safe**: Full TypeScript support with proper type definitions
- **Testable**: Easy to mock for unit testing

## Installation

```bash
npm install @atomicfinance/bitcoin-ddk-provider
```

## Usage

### Basic Usage with ddk-ts

```typescript
import BitcoinDdkProvider from '@atomicfinance/bitcoin-ddk-provider';
// ESM-only: from CommonJS, load it with a dynamic import().
import * as ddkTs from '@bennyblader/ddk-ts';
import { BitcoinNetwork } from 'bitcoin-network';

// Create provider with ddk-ts implementation
const network = BitcoinNetwork.MAINNET;
const provider = new BitcoinDdkProvider(network, ddkTs);

// Use the provider
const version = await provider.getVersion();
console.log(`DDK Version: ${version}`);
```

### Usage with ddk-rn

```typescript
import BitcoinDdkProvider from '@atomicfinance/bitcoin-ddk-provider';
import * as ddkRn from '@bennyblader/ddk-rn';
import { BitcoinNetwork } from 'bitcoin-network';

// Create provider with ddk-rn implementation
const network = BitcoinNetwork.MAINNET;
const provider = new BitcoinDdkProvider(network, ddkRn);
```

### Custom DDK Implementation

```typescript
import BitcoinDdkProvider from '@atomicfinance/bitcoin-ddk-provider';
import { DdkInterface, DlcOutcome, PartyParams, DlcTransactions } from '@atomicfinance/types';

// Create your own DDK implementation
class MyCustomDdk implements DdkInterface {
  createDlcTransactions(
    outcomes: DlcOutcome[],
    localParams: PartyParams,
    remoteParams: PartyParams,
    refundLocktime: number,
    feeRate: bigint,
    fundLockTime: number,
    cetLockTime: number,
    fundOutputSerialId: bigint,
  ): DlcTransactions {
    // Your custom implementation
    return {
      fund: { /* ... */ },
      cets: [],
      refund: { /* ... */ },
      fundingScriptPubkey: Buffer.alloc(0),
    };
  }

  // Implement all other required methods...
  createCet(/* ... */) { /* ... */ }
  createCets(/* ... */) { /* ... */ }
  // ... etc
}

// Use your custom implementation
const network = BitcoinNetwork.MAINNET;
const customDdk = new MyCustomDdk();
const provider = new BitcoinDdkProvider(network, customDdk);
```

### Testing with Mock Implementation

```typescript
import BitcoinDdkProvider from '@atomicfinance/bitcoin-ddk-provider';
import { DdkInterface } from '@atomicfinance/types';

// Create a mock for testing
const mockDdk: DdkInterface = {
  createDlcTransactions: jest.fn().mockResolvedValue(/* mock data */),
  createFundTxLockingScript: jest.fn().mockReturnValue(Buffer.alloc(0)),
  // ... implement other methods as needed
};

const provider = new BitcoinDdkProvider(BitcoinNetwork.TESTNET, mockDdk);
```

## API Reference

### Constructor

```typescript
constructor(network: BitcoinNetwork, ddkLib: DdkInterface)
```

- `network`: The Bitcoin network to use (mainnet, testnet, etc.)
- `ddkLib`: A DDK implementation that conforms to the `DdkInterface`

### Methods

The provider implements all the standard DLC methods:

- `createDlcTransactions()` - Create DLC transactions
- `createFundTx()` - Create funding transaction
- `createCet()` - Create CET (Contract Execution Transaction)
- `createCets()` - Create multiple CETs
- `createRefundTransaction()` - Create refund transaction
- `createCetAdaptorSignature()` - Create CET adaptor signature
- `signFundTransactionInput()` - Sign funding transaction input
- `verifyFundTxSignature()` - Verify funding transaction signature
- `getVersion()` - Get DDK version
- `getChangeOutputAndFees()` - Calculate change output and fees
- `getTotalInputVsize()` - Get total input vsize
- `isDustOutput()` - Check if output is dust
- `createSplicedDlcTransactions()` - Create spliced DLC transactions

## Benefits of Interface-Based Design

1. **Dependency Injection**: Easy to swap implementations
2. **Testing**: Simple to mock for unit tests
3. **Flexibility**: Support multiple DDK libraries
4. **Maintainability**: Clear contract for what any DDK implementation must provide
5. **Future-Proof**: Easy to add new DDK implementations or remove dependencies

## Type Safety

All methods are fully typed using TypeScript interfaces from `@atomicfinance/types`. The provider ensures type safety while maintaining flexibility through the interface-based design.

## Rebuild an existing contract

Pass the stored sign message when rebuilding a funded contract:

```typescript
const { dlcTransactions } = await client.dlc.createDlcTxs(
  dlcOffer,
  dlcAccept,
  dlcSign,
);
```

BAL tries the current fee rule first. If it cannot build the transaction, or
its contract ID does not match the stored sign message, BAL tries the legacy
rule. It returns transactions only when the contract ID matches. Supply those
transactions to `execute`, `refund`, `createDlcClose`, or splice input creation.
For a new contract, omit `dlcSign` to use only the current rule.

The engine must expose `FeeRule`, `createDlcTransactionsWithFeeRule`, and
`createSplicedDlcTransactionsWithFeeRule` to rebuild legacy contracts.
`@bennyblader/ddk-ts@1.0.0-rc5` does not expose them. The local `ddk-ffi`
branch has these bindings under the renamed `@bennyblader/ddk` package, but
that package must be released before BAL can pin it as a registry dependency.

To test the bindings before release, build the Node entry in `ddk-ffi`, then
run this from the BAL root with its absolute file URL:

```bash
DDK_ENGINE_MODULE=file:///absolute/path/to/ddk-ffi/typescript/dist/node/index.js pnpm test:legacy-fees
```

The suite uses the real engine and fails if the required bindings are absent.
It tests regular and spliced contracts, with and without enough input value
for the current fee, and rejects a contract ID that matches neither rule.
