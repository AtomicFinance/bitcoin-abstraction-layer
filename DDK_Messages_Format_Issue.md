# DDK Messages Format Issue and Solution

## Problem Description

The `bitcoin-ddk-provider` was encountering an "InvalidArgument" error when calling the `createCetAdaptorSigsFromOracleInfo` function. The error was traced back to a mismatch in the messages data structure format between TypeScript and Rust.

## Root Cause

The issue was in the Rust wrapper function that was incorrectly wrapping the messages parameter in an extra array level:

```rust
// INCORRECT - This adds an extra array level
let adaptor_sigs = dlc::create_cet_adaptor_sigs_from_oracle_info(
    secp,
    &cets,
    &oracle_infos,
    &funding_sk,
    &funding_script,
    Amount::from_sat(fund_output_value),
    &[msgs],  // ❌ Extra &[] wrapper creates 4 levels instead of 3
)
```

## Expected Data Structure

The Rust function expects messages in this format:
```rust
msgs: &[Vec<Vec<Message>>]  // 3 levels: [CET][Oracle][Message]
```

Where:
- **Level 1**: Array of CETs
- **Level 2**: Array of oracles (usually just one)
- **Level 3**: Array of messages for that oracle

## TypeScript Implementation

The TypeScript code correctly provides the data in the expected 3-level structure:

```typescript
tempMessagesList.map((message) =>
  message.messages.map((m) => Buffer.from(m, 'hex')),
)
```

This creates:
```typescript
[
  [Buffer1],     // messages for first CET
  [Buffer2],     // messages for second CET  
  [Buffer3]      // messages for third CET
]
```

## The Fix

Remove the extra array wrapping in the Rust code:

```rust
// CORRECT - Pass messages directly without extra wrapping
let adaptor_sigs = dlc::create_cet_adaptor_sigs_from_oracle_info(
    secp,
    &cets,
    &oracle_infos,
    &funding_sk,
    &funding_script,
    Amount::from_sat(fund_output_value),
    &msgs,  // ✅ Direct reference, maintains 3-level structure
)
```

## Why This Happened

The original `&[msgs]` syntax was:
1. Taking `msgs: Vec<Vec<Vec<u8>>>` (3 levels)
2. Wrapping it in `&[msgs]` to create `&[Vec<Vec<Vec<u8>>>]` (4 levels)
3. Causing a type mismatch with the expected `&[Vec<Vec<Message>>]` (3 levels)

## Impact

This fix resolves:
- The "InvalidArgument" error from the Rust side
- The type mismatch between TypeScript and Rust
- Ensures the messages structure is correctly passed through all layers

## Files Modified

- `packages/bitcoin-ddk-provider/lib/BitcoinDdkProvider.ts` - Fixed TypeScript message processing
- Rust wrapper function - Fixed message parameter passing (remove `&[msgs]` wrapper)

## Testing

After applying the fix, the DLC tests should pass successfully as the message format now correctly matches between TypeScript and Rust layers.
