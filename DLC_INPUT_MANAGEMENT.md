# DLC Input Management in Bitcoin Abstraction Layer

## Overview

This document provides comprehensive guidance on managing DLC (Discreet Log Contract) inputs in the Bitcoin Abstraction Layer using a **unified `Input` class approach** that eliminates complexity and provides explicit control over input supplementation.

## Table of Contents

1. [Unified Architecture](#unified-architecture)
2. [Input Supplementation Modes](#input-supplementation-modes)
3. [DLC Input Creation](#dlc-input-creation)
4. [Witness Length Explanation](#witness-length-explanation)
5. [Implementation Guide](#implementation-guide)
6. [API Reference](#api-reference)
7. [Migration Guide](#migration-guide)
8. [Troubleshooting](#troubleshooting)

## Unified Architecture

The new design uses a **single `Input` class** that can represent both regular wallet inputs and DLC splice inputs. This eliminates the previous dual-type complexity while preserving all necessary information.

### Key Benefits

✅ **Single source of truth** - Everything uses `Input[]`  
✅ **Preserves wallet info** - Derivation paths, addresses remain intact  
✅ **DLC-aware** - Optional `dlcInput` field for splice transactions  
✅ **Explicit control** - `InputSupplementationMode` enum for clear behavior  
✅ **Type safe** - Compile-time checking prevents information loss  
✅ **Application friendly** - Easy to use in React Native and other environments

### Enhanced Input Class

```typescript
class Input {
  constructor(
    readonly txid: string,
    readonly vout: number,
    readonly address: string,
    readonly amount: number, // BTC
    readonly value: number,  // satoshis
    readonly derivationPath?: string,
    readonly maxWitnessLength?: number,
    readonly redeemScript?: string,
    readonly inputSerialId?: bigint,
    readonly scriptPubKey?: string,
    readonly label?: string,
    readonly confirmations?: number,
    readonly spendable?: boolean,
    readonly solvable?: boolean,
    readonly safe?: boolean,
    readonly dlcInput?: DlcInputInfo, // 👈 NEW: DLC support
  ) {}

  isDlcInput(): boolean;
  static createDlcInput(...): Input;
}
```

## Input Supplementation Modes

Clear, explicit control over how the wallet supplements provided inputs:

```typescript
enum InputSupplementationMode {
  None = "none",       // Use exactly these inputs, no supplementation
  Optional = "optional", // Try to supplement, fallback if fails  
  Required = "required"  // Must supplement or throw error
}
```

### Mode Behaviors

| Mode | Behavior | Use Case |
|------|----------|----------|
| **None** | Uses exactly the provided inputs | React Native apps with pre-selected UTXOs |
| **Optional** | Tries to supplement, falls back to provided inputs if fails | Flexible applications |
| **Required** | Must supplement or throws error | Traditional wallet behavior |

## DLC Input Creation

### Regular Wallet Input
```typescript
const regularInput = new Input(
  txid, vout, address, amount, value, derivationPath
);
```

### DLC Splice Input
```typescript
const dlcInput = Input.createDlcInput(
  txid, vout, multisigAddress, amount, value,
  "03abc...", // localFundPubkey  
  "02def...", // remoteFundPubkey
  100000000n  // fundValue
);

// Check if input contains DLC information
if (dlcInput.isDlcInput()) {
  console.log("DLC splice input detected");
  console.log("Local pubkey:", dlcInput.dlcInput.localFundPubkey);
}
```

## Witness Length Explanation

### DLC Inputs: 220 bytes
For **2-of-2 multisig P2WSH** (DLC funding outputs):

| Component | Size | Description |
|-----------|------|-------------|
| OP_0 | 1 byte | Required for CHECKMULTISIG |
| Signature 1 | ~73 bytes | DER-encoded signature |
| Signature 2 | ~73 bytes | DER-encoded signature |
| Witness Script | ~69 bytes | 2-of-2 multisig script |
| **Total** | **~216 bytes** | +4 bytes safety margin = 220 |

### Regular Inputs: 108 bytes
For **P2WPKH** (standard wallet inputs):

| Component | Size | Description |
|-----------|------|-------------|
| Signature | ~73 bytes | DER-encoded signature |
| Public Key | 33 bytes | Compressed public key |
| **Total** | **~106 bytes** | +2 bytes safety margin = 108 |

## Implementation Guide

### 1. Creating DLC Offers with Explicit Control

```typescript
// React Native: Use exactly these UTXOs
await dlcProvider.createDlcOffer(
  contractInfo, collateral, feeRate, cetLock, refundLock,
  mySpecificInputs,
  InputSupplementationMode.None  // 👈 No supplementation
);

// Server: Must find sufficient UTXOs
await dlcProvider.createDlcOffer(
  contractInfo, collateral, feeRate, cetLock, refundLock,
  someInputs,
  InputSupplementationMode.Required  // 👈 Must supplement
);

// Flexible: Try to supplement, use provided if fails
await dlcProvider.createDlcOffer(
  contractInfo, collateral, feeRate, cetLock, refundLock,
  someInputs,
  InputSupplementationMode.Optional  // 👈 Best effort
);
```

### 2. DLC Splice Transaction Flow

```typescript
// 1. Create DLC input from previous funding transaction
const dlcInput = Input.createDlcInput(
  prevFundTxid,
  prevFundVout,
  prevMultisigAddress,
  amount,
  value,
  localPubkey,
  remotePubkey,
  fundValue
);

// 2. Create offer with DLC input (splice mode auto-detected)
const dlcOffer = await dlcProvider.createDlcOffer(
  contractInfo,
  newCollateral,
  feeRate,
  cetLocktime,
  refundLocktime,
  [dlcInput], // Contains DLC info
  InputSupplementationMode.Optional
);

// 3. System automatically uses CreateSplicedDlcTransactions
const { dlcAccept, dlcTransactions } = await dlcProvider.acceptDlcOffer(dlcOffer);
```

### 3. Error Handling

```typescript
try {
  const dlcOffer = await dlcProvider.createDlcOffer(
    contractInfo, collateral, feeRate, cetLock, refundLock,
    insufficientInputs,
    InputSupplementationMode.Required
  );
} catch (error) {
  if (error.message.includes('Not enough balance')) {
    // Handle insufficient funds
    console.log('Need more UTXOs or lower collateral');
  }
}
```

## API Reference

### `Input.createDlcInput()`

Creates a DLC-aware input for splice transactions.

**Parameters**:
- `txid`: Transaction ID
- `vout`: Output index  
- `multisigAddress`: DLC multisig address
- `amount`: Amount in BTC
- `value`: Amount in satoshis
- `localFundPubkey`: Local funding public key (hex)
- `remoteFundPubkey`: Remote funding public key (hex)  
- `fundValue`: Fund value in satoshis
- `inputSerialId?`: Optional serial ID

**Returns**: `Input` with DLC information

### `input.isDlcInput()`

Checks if input contains DLC information.

**Returns**: `boolean`

### `createDlcOffer()` - Updated Signature

```typescript
async createDlcOffer(
  contractInfo: ContractInfo,
  offerCollateralSatoshis: bigint,
  feeRatePerVb: bigint,
  cetLocktime: number,
  refundLocktime: number,
  fixedInputs?: Input[], // 👈 Unified type
  supplementation: InputSupplementationMode = InputSupplementationMode.Required
): Promise<DlcOffer>
```

### `acceptDlcOffer()` - Updated Signature

```typescript
async acceptDlcOffer(
  dlcOffer: DlcOffer,
  fixedInputs?: Input[], // 👈 Unified type  
  supplementation: InputSupplementationMode = InputSupplementationMode.Required
): Promise<AcceptDlcOfferResponse>
```

## Migration Guide

### From Old Dual-Type System

**Before** (Problematic):
```typescript
// Lost DLC information during conversion
const inputs: Input[] = [regularInput];
const fundingInputs: FundingInput[] = await Promise.all(
  inputs.map(input => provider.inputToFundingInput(input))
); // DLC info lost!
```

**After** (Clean):
```typescript
// DLC information preserved throughout
const inputs: Input[] = [
  regularInput,
  Input.createDlcInput(...) // DLC info preserved
];

const dlcOffer = await provider.createDlcOffer(
  contractInfo, collateral, feeRate, cetLock, refundLock,
  inputs,
  InputSupplementationMode.Optional
);
```

### Application-Specific Patterns

**React Native App**:
```typescript
// Pre-select specific UTXOs, no supplementation
const selectedInputs = await myWallet.getSelectedUtxos();
const dlcOffer = await provider.createDlcOffer(
  contractInfo, collateral, feeRate, cetLock, refundLock,
  selectedInputs,
  InputSupplementationMode.None
);
```

**Server Application**:
```typescript
// Let wallet find sufficient UTXOs
const dlcOffer = await provider.createDlcOffer(
  contractInfo, collateral, feeRate, cetLock, refundLock,
  [], // No fixed inputs
  InputSupplementationMode.Required
);
```

## Troubleshooting

### Common Issues

1. **"Not enough balance" with None mode**
   - **Problem**: Provided inputs insufficient for transaction
   - **Solution**: Use `Optional` or `Required` mode, or provide more inputs

2. **DLC information not preserved**
   - **Problem**: Using old conversion methods
   - **Solution**: Use `Input.createDlcInput()` for DLC inputs

3. **Supplementation not working as expected**
   - **Problem**: Wrong `InputSupplementationMode`
   - **Solution**: Choose correct mode for your use case

4. **Wrong witness length calculation**
   - **Problem**: DLC inputs using 108 bytes instead of 220
   - **Solution**: Use `Input.createDlcInput()` which sets correct witness length

### Debugging Tips

```typescript
// Check if input has DLC information
inputs.forEach((input, i) => {
  console.log(`Input ${i}: ${input.isDlcInput() ? 'DLC' : 'Regular'}`);
  if (input.isDlcInput()) {
    console.log(`  Max witness: ${input.maxWitnessLength}`);
    console.log(`  Local pubkey: ${input.dlcInput.localFundPubkey}`);
  }
});

// Verify supplementation mode behavior
try {
  const result = await provider.createDlcOffer(
    contractInfo, collateral, feeRate, cetLock, refundLock,
    inputs,
    InputSupplementationMode.None
  );
  console.log(`Used exactly ${inputs.length} inputs`);
} catch (error) {
  console.log(`Failed with None mode: ${error.message}`);
}
```

## Best Practices

### 1. **Choose the Right Supplementation Mode**
- Use `None` for applications with pre-selected UTXOs
- Use `Required` for traditional wallet behavior  
- Use `Optional` for flexible applications

### 2. **DLC Input Creation**
- Always use `Input.createDlcInput()` for DLC splice inputs
- Verify witness length is 220 bytes for DLC inputs
- Check `input.isDlcInput()` before processing

### 3. **Error Handling**
- Handle "Not enough balance" errors appropriately
- Provide fallback strategies for different supplementation modes
- Log input types and counts for debugging

### 4. **Performance**
- Cache DLC input creation when possible
- Use appropriate supplementation modes to avoid unnecessary wallet queries
- Consider batching operations for multiple DLCs

The unified `Input` class approach provides a clean, type-safe, and application-friendly way to handle both regular and DLC inputs while giving explicit control over supplementation behavior. 