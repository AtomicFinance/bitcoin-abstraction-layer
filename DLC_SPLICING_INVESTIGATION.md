# DLC Splicing Investigation: "No Change" Issue

## Problem Statement

When creating a spliced DLC with exact UTXO amounts (no change), the system fails with:
```
Error: Not enough balance GetInputsForAmountWithMode. Error: Not enough balance for dual funding
```

**Test Scenario:**
1. Alice creates a single-funded DLC using her entire UTXO
2. Alice tries to splice that DLC's funding output + another UTXO into a new DLC
3. Alice wants to use exact amounts with no change outputs
4. System fails during coin selection

## Root Cause Analysis

### Issue Chain

1. **`InputSupplementationMode.None` still calls `getInputsForDualFunding`**
   - Even with "None" mode, the code path leads to dual funding coin selection
   - `GetInputsForAmountWithMode` calls `getInputsForDualFunding` for Required/Optional modes

2. **`dualFundingCoinSelect` assumes dual-funding with change**
   - Uses `@node-dlc/core.dualFundingCoinSelect` 
   - Expects to find UTXOs that can cover collateral + create change outputs for both parties
   - Cannot handle "exact amount, no change" scenarios

3. **Transaction builder always creates change outputs**
   - `BatchDlcTxBuilder` in TypeScript always creates 3 outputs for single DLC:
     - DLC funding output (P2WSH multisig)
     - Offerer change output
     - Accepter change output (even if accepter has 0 inputs!)

### Key Files & Logic

| Component | File | Issue |
|-----------|------|-------|
| Coin Selection | `BitcoinWalletProvider.getInputsForDualFunding` | Uses `dualFundingCoinSelect` |
| Core Selection | `@node-dlc/core.dualFundingCoinSelect` | Expects change outputs |
| Fee Calculation | `@node-dlc/core.DualFundingTxFinalizer` | Calculates fees assuming change |
| Transaction Building | `@node-dlc/core.BatchDlcTxBuilder` | Always creates change outputs |

## Required Calculations for "No Change" DLC

### 1. Total Input Value
```typescript
const totalInputValue = inputs.reduce((total, input) => {
  return total + input.prevTx.outputs[input.prevTxVout].value.sats;
}, BigInt(0));
```

### 2. Future Fees (CET/refund execution)
```typescript
const futureFeeWeight = 249 + 4 * payoutSPK.length;
const futureFee = feeRatePerVb * BigInt(Math.ceil(futureFeeWeight / 4));
```

### 3. Funding Transaction Fee (single output)
```typescript
const inputWeight = inputs.reduce((total, input) => {
  return total + 164 + input.maxWitnessLen;
}, 0);

// Single DLC output only (no change outputs)
const outputWeight = 43; // P2WSH output size
const totalWeight = 42 + inputWeight + outputWeight; // base + inputs + output
const fundingFee = feeRatePerVb * BigInt(Math.ceil(totalWeight / 4));
```

### 4. Maximum Collateral
```typescript
const maxCollateral = totalInputValue - futureFee - fundingFee;
```

### 5. DLC Output Value
```typescript
const dlcOutputValue = maxCollateral + futureFee;
```

### Balance Check
```typescript
totalInputValue === dlcOutputValue + fundingFee
```

## C++ Layer Analysis

**Good News: C++ code already handles "no change" correctly!**

### Evidence from `cfddlc_transactions.cpp`:

1. **Dust Filtering Implemented:**
```cpp
// Single-funded DLC: exclude zero-value change outputs (dust filtering)
if (!IsDustOutputInfo(local_output_info)) {
  outputs_info.push_back(local_output_info);
}
if (!IsDustOutputInfo(remote_output_info)) {
  outputs_info.push_back(remote_output_info);
}
```

2. **Dust Threshold Defined:**
```cpp
static const uint64_t DUST_LIMIT = 1000;

bool DlcManager::IsDustOutputInfo(const TxOutputInfo &output) {
  return output.value < DUST_LIMIT;
}
```

3. **Single-Funded Support:**
```cpp
// Single-funded DLC: party with no inputs contributes zero fees
if (total_input_amount == 0) {
  TxOut change_output(Amount::CreateBySatoshiAmount(0), params.change_script_pubkey);
  return std::make_tuple(change_output, 0, 0);
}
```

4. **DLC Splicing Functions Already Exist:**
- `CreateSplicedDlcTransactions()`
- `ConvertDlcInputsToTxInputs()`
- `GetDlcInputsWeight()`
- `SignDlcFundingInput()`

## Solution Architecture

### Two-Layer Approach

#### 1. **node-dlc** (Protocol Level)
Add dust filtering to `BatchDlcTxBuilder`:

```typescript
// In BatchDlcTxBuilder.buildFundingTransaction()
const DUST_LIMIT = 1000n;

const offerChangeValue = offerTotalFunding - offerInput - finalizer.offerFees;
const acceptChangeValue = acceptTotalFunding - acceptInput - finalizer.acceptFees;

// Only create change outputs if they're above dust threshold
if (offerChangeValue >= DUST_LIMIT) {
  outputs.push({
    value: Value.fromSats(Number(offerChangeValue)),
    script: Script.p2wpkhLock(this.dlcOffers[0].changeSpk.slice(2)),
    serialId: this.dlcOffers[0].changeSerialId,
  });
}

if (acceptChangeValue >= DUST_LIMIT) {
  outputs.push({
    value: Value.fromSats(Number(acceptChangeValue)),
    script: Script.p2wpkhLock(this.dlcAccepts[0].changeSpk.slice(2)),
    serialId: this.dlcAccepts[0].changeSerialId,
  });
}
```

#### 2. **bitcoin-abstraction-layer** (Wallet Level)
Add `calculateMaxCollateral` function:

```typescript
// In BitcoinDlcProvider
async calculateMaxCollateral(
  inputs: Input[],
  feeRatePerVb: bigint,
  isOfferer: boolean,
  contractInfo?: ContractInfo
): Promise<bigint> {
  // Convert inputs to FundingInput[]
  const fundingInputs = await Promise.all(inputs.map(i => this.inputToFundingInput(i)));
  
  // Calculate total input value
  const totalInputValue = fundingInputs.reduce((total, input) => {
    return total + input.prevTx.outputs[input.prevTxVout].value.sats;
  }, BigInt(0));
  
  // Calculate fees for exact amount scenario
  const fees = this.calculateFeesForExactAmount(fundingInputs, feeRatePerVb);
  
  return totalInputValue - fees;
}
```

### Usage Pattern

```typescript
// Instead of guessing collateral amounts:
const dlcOffer2 = await alice.dlc.createDlcOffer(
  contractInfo2,
  totalCollateral2 - BigInt(5000), // ❌ Guessing
  // ...
);

// Calculate max collateral upfront:
const maxCollateral = await alice.dlc.calculateMaxCollateral(
  [dlcFundingInput, aliceInput2],
  feeRatePerVb,
  true, // Alice is offerer
);

const dlcOffer2 = await alice.dlc.createDlcOffer(
  contractInfo2,
  maxCollateral, // ✅ Use exact maximum
  // ...
);
```

## Implementation Priority

1. **High Priority**: Fix `BatchDlcTxBuilder` in node-dlc to match C++ dust filtering behavior
2. **Medium Priority**: Add `calculateMaxCollateral` helper function
3. **Low Priority**: Optimize fee calculations for different scenarios

## Current vs Desired Transaction Structure

### Current (Always 3 outputs):
- **Input 1**: DLC funding output (970,332 sats)
- **Input 2**: Regular UTXO (100,000 sats)
- **Output 1**: DLC funding output (~1,065,000 sats)
- **Output 2**: Offerer change (tiny amount)
- **Output 3**: Accepter change (0 sats - dust!)

### Desired (1 output when no change):
- **Input 1**: DLC funding output (970,332 sats)  
- **Input 2**: Regular UTXO (100,000 sats)
- **Output 1**: DLC funding output (exact: 1,070,332 - fees)

## Key Insight

**The TypeScript layer (`node-dlc`) ignores the C++ dust filtering logic.** The C++ code is already perfect - we just need the TypeScript layer to match its behavior by implementing the same dust filtering in `BatchDlcTxBuilder`.

## Files to Modify

1. **node-dlc**: `packages/core/lib/dlc/TxBuilder.ts` (BatchDlcTxBuilder)
2. **bitcoin-abstraction-layer**: `packages/bitcoin-dlc-provider/lib/BitcoinDlcProvider.ts` (add calculateMaxCollateral)
3. **bitcoin-abstraction-layer**: Update test to use calculateMaxCollateral

This approach maintains backward compatibility while solving the exact-amount splicing use case. 