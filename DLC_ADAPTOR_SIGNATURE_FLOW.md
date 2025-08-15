# DLC Adaptor Signature Creation Flow

## Overview
This document traces the complete function call path for creating CET (Contract Execution Transaction) adaptor signatures in the DLC implementation, from the JavaScript/TypeScript layer down to the core Rust implementation.

## The Critical Fix
The key issue was that the parameter `funding_script_pubkey` is misleadingly named throughout the entire stack. Despite its name suggesting a scriptPubKey, it actually needs to be the **witness script** (the actual script being executed) for P2WSH transactions.

### What Was Wrong
- **Incorrect**: Passing `p2wsh.output` (the P2WSH scriptPubKey: `OP_0 <32-byte-hash>`)
- **Correct**: Passing `p2ms.output` (the multisig witness script: `OP_2 <pubkey1> <pubkey2> OP_2 OP_CHECKMULTISIG`)

## Complete Function Call Path

### 1. JavaScript/TypeScript Layer (BitcoinDdkProvider.ts)
```typescript
// In BitcoinDdkProvider.ts
const response = this._ddk.createCetAdaptorSigsFromOracleInfo(
  cetsForDdk,           // CETs as DDK Transaction objects
  [ddkOracleInfo],      // Oracle info with pubkey and nonces
  Buffer.from(fundPrivateKey, 'hex'),
  fundingSPK,           // Now correctly: p2ms.output (multisig redeem script)
  this.getFundOutputValueSats(dlcTxs),
  messagesForDdk,       // Tagged attestation messages (32-byte hashes)
);
```

**Key Points:**
- `fundingSPK` must be the multisig redeem script (`p2ms.output`)
- Messages must be tagged attestation messages (32-byte hashes)
- The messages follow DLC spec: `H(H("DLC/oracle/attestation/v0") || H("DLC/oracle/attestation/v0") || H(outcome))`

### 2. Node.js Native Binding (ddk-ts)
The TypeScript code calls into the native Node.js addon compiled from Rust:
```javascript
// In @bennyblader/ddk-ts/dist/index.js
module.exports.createCetAdaptorSigsFromOracleInfo = nativeBinding.createCetAdaptorSigsFromOracleInfo
```

This is auto-generated binding code that bridges JavaScript to the Rust NAPI layer.

### 3. Rust NAPI Binding Layer (ddk-ts/src/lib.rs)
```rust
#[napi]
pub fn create_cet_adaptor_sigs_from_oracle_info(
  cets: Vec<Transaction>,
  oracle_info: Vec<OracleInfo>,
  funding_secret_key: Buffer,
  funding_script_pubkey: Buffer,  // Named confusingly, but needs witness script
  fund_output_value: BigInt,
  msgs: Vec<Vec<Vec<Buffer>>>,
) -> Result<Vec<AdaptorSignature>> {
  // Convert JavaScript types to Rust types
  let ffi_msgs = msgs
    .into_iter()
    .map(|cet_msgs| {
      cet_msgs
        .into_iter()
        .map(|outcome_msgs| {
          outcome_msgs.iter().map(buffer_to_vec).collect::<Vec<_>>()
        })
        .collect::<Vec<_>>()
    })
    .collect::<Vec<_>>();
    
  // Call into ddk_ffi layer
  let sigs = ddk_ffi::create_cet_adaptor_sigs_from_oracle_info(
    cets.into_iter().map(|cet| cet.try_into()).collect::<Result<Vec<_>, _>>()?,
    oracle_info.into_iter().map(|info| info.into()).collect(),
    buffer_to_vec(&funding_secret_key),
    buffer_to_vec(&funding_script_pubkey),  // Passes the buffer as Vec<u8>
    bigint_to_u64(&fund_output_value)?,
    ffi_msgs,
  )
}
```

**Key Points:**
- Converts Node.js Buffer types to Rust Vec<u8>
- Handles the complex nested message structure
- Parameter naming suggests scriptPubKey but actually needs witness script

### 4. FFI Bridge Layer (ddk-ffi/src/lib.rs)
```rust
pub fn create_cet_adaptor_sigs_from_oracle_info(
    cets: Vec<Transaction>,
    oracle_info: Vec<OracleInfo>,
    funding_secret_key: Vec<u8>,
    funding_script_pubkey: Vec<u8>,  // Still confusingly named
    fund_output_value: u64,
    msgs: Vec<Vec<Vec<Vec<u8>>>>,
) -> Result<Vec<AdaptorSignature>, DLCError> {
    // Convert to Bitcoin/secp256k1 types
    let funding_sk = SecretKey::from_slice(&funding_secret_key)
        .map_err(|_| DLCError::InvalidArgument("Invalid funding secret key".to_string()))?;
    let funding_script = Script::from_bytes(&funding_script_pubkey);
    
    // Convert messages to Message type
    let msgs: Vec<Vec<Vec<Message>>> = msgs
        .iter()
        .map(|cet_msgs| {
            cet_msgs
                .iter()
                .map(|outcome_msgs| {
                    outcome_msgs
                        .iter()
                        .map(|msg_bytes| {
                            Message::from_digest_slice(msg_bytes).map_err(|_| {
                                DLCError::InvalidArgument("Invalid message".to_string())
                            })
                        })
                        .collect::<Result<Vec<_>, _>>()
                })
                .collect::<Result<Vec<_>, _>>()
        })
        .collect::<Result<Vec<_>, _>>()?;
    
    // Call into dlcdevkit core
    let adaptor_sigs = dlc::create_cet_adaptor_sigs_from_oracle_info(
        secp,
        &cets,
        &oracle_infos,
        &funding_sk,
        funding_script,  // Passes as &Script
        Amount::from_sat(fund_output_value),
        &msgs,
    )
}
```

**Key Points:**
- Converts raw bytes to Bitcoin Script type
- Messages are expected to be 32-byte digests
- Bridges between FFI types and dlcdevkit types

### 5. DLC Core Implementation (dlcdevkit/dlc/src/lib.rs)
```rust
/// Create a set of adaptor signatures for the given cet/message pairs.
pub fn create_cet_adaptor_sigs_from_oracle_info(
    secp: &Secp256k1<All>,
    cets: &[Transaction],
    oracle_infos: &[OracleInfo],
    funding_sk: &SecretKey,
    funding_script_pubkey: &Script,  // This is the witness script!
    fund_output_value: Amount,
    msgs: &[Vec<Vec<Message>>],
) -> Result<Vec<EcdsaAdaptorSignature>, Error> {
    // Iterate through CETs and create adaptor sig for each
    cets.iter()
        .zip(msgs.iter())
        .map(|(cet, msg)| {
            create_cet_adaptor_sig_from_oracle_info(
                secp, cet, oracle_infos, funding_sk,
                funding_script_pubkey,  // Passes to single CET function
                fund_output_value, msg,
            )
        })
        .collect()
}

/// Create an adaptor signature for the given cet using the provided oracle infos.
pub fn create_cet_adaptor_sig_from_oracle_info(
    secp: &Secp256k1<All>,
    cet: &Transaction,
    oracle_infos: &[OracleInfo],
    funding_sk: &SecretKey,
    funding_script_pubkey: &Script,
    fund_output_value: Amount,
    msgs: &[Vec<Message>],
) -> Result<EcdsaAdaptorSignature, Error> {
    // Calculate adaptor point from oracle info and messages
    let adaptor_point = get_adaptor_point_from_oracle_info(secp, oracle_infos, msgs)?;
    
    // Create the actual adaptor signature
    create_cet_adaptor_sig_from_point(
        secp,
        cet,
        &adaptor_point,
        funding_sk,
        funding_script_pubkey,
        fund_output_value,
    )
}

/// Create an adaptor signature for the given cet using the provided adaptor point.
pub fn create_cet_adaptor_sig_from_point(
    secp: &Secp256k1<C>,
    cet: &Transaction,
    adaptor_point: &PublicKey,
    funding_sk: &SecretKey,
    funding_script_pubkey: &Script,  // Used here!
    fund_output_value: Amount,
) -> Result<EcdsaAdaptorSignature, Error> {
    // HERE is where it's actually used:
    let sig_hash = util::get_sig_hash_msg(
        cet, 
        0,  // input index
        funding_script_pubkey,  // This needs to be the witness script!
        fund_output_value
    )?;
    
    // Create adaptor signature with the sig_hash
    EcdsaAdaptorSignature::encrypt(secp, &sig_hash, funding_sk, adaptor_point)
}
```

**Key Points:**
- Creates one adaptor signature per CET
- Combines oracle nonces with messages to create adaptor points
- Uses the witness script for signature hash calculation

### 6. Signature Hash Calculation (dlcdevkit/dlc/src/util.rs)
```rust
/// Get a BIP143 signature hash for a segwit transaction input
pub fn get_sig_hash_msg(
    tx: &Transaction,
    input_index: usize,
    script_pubkey: &Script,  // This is the witness script for P2WSH
    value: Amount,
) -> Result<Message, Error> {
    // Uses Bitcoin's P2WSH signature hash calculation
    let sig_hash = SighashCache::new(tx).p2wsh_signature_hash(
        input_index,
        script_pubkey,  // Bitcoin expects witness script here, not scriptPubKey!
        value,
        EcdsaSighashType::All,
    )?;
    
    Ok(Message::from_digest_slice(sig_hash.as_ref()).unwrap())
}
```

**Key Points:**
- Uses BIP143 signature hash algorithm for SegWit
- `p2wsh_signature_hash` expects the witness script, not the scriptPubKey
- This is where the actual signature hash is computed

## The Root Cause

The confusion stems from parameter naming:
- The parameter is called `funding_script_pubkey` throughout the entire stack
- However, Bitcoin's `p2wsh_signature_hash` function requires the **witness script** (the script that will be executed)
- For P2WSH outputs, the scriptPubKey and witness script are different things

### P2WSH Structure
1. **ScriptPubKey** (in the transaction output): `OP_0 <32-byte-hash>`
   - This is what goes in the UTXO
   - The 32-byte hash is SHA256(witness_script)
   
2. **Witness Script** (in the witness field when spending): The actual script to be executed
   - For 2-of-2 multisig: `OP_2 <pubkey1> <pubkey2> OP_2 OP_CHECKMULTISIG`
   - This is what needs to be passed to signature hash functions

## Summary

The fix was simple but the root cause was subtle:
- **Before**: Passing `p2wsh.output` (the P2WSH scriptPubKey)
- **After**: Passing `p2ms.output` (the multisig witness script)

This ensures that:
1. The same script is used for both creating and verifying adaptor signatures
2. The signature hash is calculated correctly according to BIP143
3. The adaptor signatures can be properly completed with oracle signatures

The parameter naming throughout the stack (`funding_script_pubkey`) is misleading and should ideally be renamed to `funding_witness_script` or `funding_redeem_script` to prevent this confusion.