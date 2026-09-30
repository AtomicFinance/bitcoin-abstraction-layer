# @atomicfinance/bitcoin-ddk-provider

## 5.0.0

### Major Changes

- 5211f4a: Release 5.0.0: run on the ddk v2 engine and fund single-funded contracts the
  way ddk v2 builds them. Every `@atomicfinance` package moves to 5.0.0 together.

  **The engine is now the generated ddk binding**, `@bennyblader/ddk` (formerly
  `@bennyblader/ddk-ts`) or `@bennyblader/ddk-rn`, 1.0.0-rc7 or later.
  `DdkInterface` mirrors it:
  - Bytes are `Uint8Array`. A `Buffer` still passes as an argument; results are
    wrapped in `Buffer.from()` before BAL calls `Buffer`-only methods.
  - Functions that operate on one record are methods on that record's namespace:
    `ddk.Transaction.signCet(tx, ...)`, `ddk.Transaction.cetSighash(...)`,
    `ddk.Transaction.cetAdaptorSignatureInputs(...)`, `ddk.TxOutput.isDust(...)`,
    `ddk.AdaptorSignature.verifyFromOracleInfo(...)`,
    `ddk.PartyParams.changeOutputAndFees(...)`, and so on.
  - `DdkDlcTransactions.fundingScriptPubkey` is `fundingWitnessScript`; the bytes
    are the same 2-of-2 witness script.
  - `contractFlags` and the mnemonic passphrase are required arguments.

  An earlier engine (`@bennyblader/ddk-ts` 0.3.x through 1.0.0-rc5) no longer
  satisfies `DdkInterface`. The `BitcoinDdkProvider` constructor throws when the
  engine lacks `FeeRule`, `createDlcTransactionsWithFeeRule` or
  `createSplicedDlcTransactionsWithFeeRule`, or when its `dlcInputMaxWitnessLen()`
  differs from `DLC_INPUT_MAX_WITNESS_LEN`, so an unsupported engine fails at
  startup instead of on a live contract.

  **The engine is ESM-only.** From CommonJS, load it with a real dynamic
  `import()`, which TypeScript's CommonJS output rewrites to `require()`; the
  integration tests do this in `tests/integration/utils/load-ddk.mjs`.

  **Single-funded offers reserve the ddk v2 fees.** From `ddk-dlc` 2.0.0-rc.4, the
  party that funds the whole contract pays the full funding and CET base weights
  and the CET fee for the other party's payout output. `createDlcOffer` now selects
  coins for, and checks its inputs against, that rule, reserving for a 34-byte
  acceptor payout script because the real one is not known yet.
  `calculateMaxCollateral` uses the same rule for a single contract. Dual-funded
  contracts do not change.

  **A counterparty still on `ddk-dlc` 1.x can still sign.** It builds a
  single-funded contract under the old fee rule, so its signatures do not verify
  against the current rule's transactions. `signDlcAccept` then rebuilds under the
  old rule and signs those transactions if the acceptor's signatures verify
  against them. The contract is created under the old rule, and `createDlcTxs`
  with its `dlcSign` rebuilds it the same way. The reverse is not covered: an
  offerer on `ddk-dlc` 1.x cannot verify an accept made with this release.

  **Existing contracts still close.** `createDlcTxs` takes an optional `dlcSign`
  (also on `client.dlc.createDlcTxs`). Pass it whenever the contract already
  exists, for example to restore or splice it: a single-funded contract created
  before `ddk-dlc` 2.0.0-rc.4 is rebuilt under the fee rule whose funding
  transaction reproduces the sign message's contract id, and the call throws if
  neither rule does, with each rule's failure in the error. The
  legacy rule is also tried when the current rule cannot build because the old
  inputs do not cover the new fee. `execute`, `refund` and `createDlcClose` use
  the transactions they are given and are unaffected.

### Minor Changes

- 5211f4a: Expose the CET adaptor signature debug helpers that `ddk-ts` has always
  shipped but `DdkInterface` never mirrored.

  `DdkInterface` gains `cetAdaptorSignatureInputs` and `cetSighash`, along with
  the `CetAdaptorSignatureDebugInfo` type.

  `BitcoinDdkProvider` gains two methods that resolve the funding script, oracle
  info and outcome messages for a CET and hand them to ddk:
  - `getCetAdaptorSignatureDetails(dlcOffer, dlcAccept, dlcTxs, cetIndex)` —
    returns the sighash, adaptor point, funding script, fund output value and raw
    CET used for that CET's adaptor signature.
  - `getCetSighash(dlcOffer, dlcAccept, dlcTxs, cetIndex)` — returns just the
    32-byte sighash, hex encoded.

  These are for diffing against a remote signer (e.g. Fordefi) when an adaptor
  signature is rejected, isolating whether the mismatch is in the sighash, the
  adaptor point, or the CET itself. They complement the existing
  `getFundingTransactionSighashDetails`.

### Patch Changes

- 5211f4a: Replace the hardcoded DLC input witness length with a shared constant.

  `220` was written out at five call sites across three packages. It is now
  `DLC_INPUT_MAX_WITNESS_LEN`, exported from `@atomicfinance/types`.

  The constant is duplicated from ddk rather than read from it because
  `@atomicfinance/types` and the CFD-based `BitcoinDlcProvider` have no ddk
  instance to call. To stop the copy drifting, `DdkInterface` now declares
  `dlcInputMaxWitnessLen()` and `BitcoinDdkProvider.DdkLoaded()` throws if ddk's
  value and the constant disagree.

- Updated dependencies [5211f4a]
- Updated dependencies [5211f4a]
- Updated dependencies [5211f4a]
- Updated dependencies [5211f4a]
  - @atomicfinance/types@5.0.0
  - @atomicfinance/bitcoin-utils@5.0.0
  - @atomicfinance/provider@5.0.0
  - @atomicfinance/utils@5.0.0

## 4.3.6

### Patch Changes

- @atomicfinance/bitcoin-utils@4.3.6
- @atomicfinance/provider@4.3.6
- @atomicfinance/types@4.3.6
- @atomicfinance/utils@4.3.6

## 4.3.5

### Patch Changes

- 3b4f7b3: Fix execute failing with InvalidSignature after DLC messages are serialized and deserialized. @node-dlc/messaging splits the 162-byte ECDSA adaptor signature into encryptedSig (65) + dleqProof (97) on deserialize, but the signCet call sites passed encryptedSig alone; they now recombine the full adaptor signature.
  - @atomicfinance/bitcoin-utils@4.3.5
  - @atomicfinance/provider@4.3.5
  - @atomicfinance/types@4.3.5
  - @atomicfinance/utils@4.3.5

## 4.3.4

### Patch Changes

- @atomicfinance/bitcoin-utils@4.3.4
- @atomicfinance/provider@4.3.4
- @atomicfinance/types@4.3.4
- @atomicfinance/utils@4.3.4

## 4.3.3

### Patch Changes

- 4ed94d2: Bump @node-dlc to 1.2.1, which estimates taproot witness length in fee calculations
- Updated dependencies [4ed94d2]
  - @atomicfinance/types@4.3.3
  - @atomicfinance/bitcoin-utils@4.3.3
  - @atomicfinance/provider@4.3.3
  - @atomicfinance/utils@4.3.3

## 4.3.2

### Patch Changes

- dd55924: Bump @node-dlc to 1.2.0, which preserves raw DLC change scripts (taproot change output support)
- Updated dependencies [dd55924]
  - @atomicfinance/types@4.3.2
  - @atomicfinance/bitcoin-utils@4.3.2
  - @atomicfinance/provider@4.3.2
  - @atomicfinance/utils@4.3.2

## 4.3.1

### Patch Changes

- 3df9ca2: Bump @node-dlc 1.1.9 and ddk-ts 0.3.41 to fix backward compatibility dlc protocol issues contract flags
- Updated dependencies [3df9ca2]
  - @atomicfinance/types@4.3.1
  - @atomicfinance/bitcoin-utils@4.3.1
  - @atomicfinance/provider@4.3.1
  - @atomicfinance/utils@4.3.1

## 4.3.0

### Minor Changes

- d041351: Add contractFlags parameter to DLC offer and transaction creation

### Patch Changes

- Updated dependencies [d041351]
  - @atomicfinance/types@4.3.0
  - @atomicfinance/bitcoin-utils@4.3.0
  - @atomicfinance/provider@4.3.0
  - @atomicfinance/utils@4.3.0

## 4.2.8

### Patch Changes

- 82c2f2b: Lazy load ECC
- Updated dependencies [82c2f2b]
  - @atomicfinance/utils@4.2.8
  - @atomicfinance/bitcoin-utils@4.2.8
  - @atomicfinance/provider@4.2.8
  - @atomicfinance/types@4.2.8

## 4.2.7

### Patch Changes

- 8e9f8f0: Bump @node-dlc to 1.1.7
- Updated dependencies [8e9f8f0]
  - @atomicfinance/types@4.2.7
  - @atomicfinance/bitcoin-utils@4.2.7
  - @atomicfinance/provider@4.2.7
  - @atomicfinance/utils@4.2.7

## 4.2.6

### Patch Changes

- 4f7eaa7: Bump @node-dlc to 1.1.15
- Updated dependencies [4f7eaa7]
  - @atomicfinance/types@4.2.6
  - @atomicfinance/bitcoin-utils@4.2.6
  - @atomicfinance/provider@4.2.6
  - @atomicfinance/utils@4.2.6

## 4.2.5

### Patch Changes

- 295d995: Ensure contractId is not null for dlcFundingInput
- Updated dependencies [295d995]
  - @atomicfinance/bitcoin-utils@4.2.5
  - @atomicfinance/provider@4.2.5
  - @atomicfinance/types@4.2.5
  - @atomicfinance/utils@4.2.5

## 4.2.4

### Patch Changes

- 735d7b9: Bump @node-dlc to 1.1.4
- Updated dependencies [735d7b9]
  - @atomicfinance/types@4.2.4
  - @atomicfinance/bitcoin-utils@4.2.4
  - @atomicfinance/provider@4.2.4
  - @atomicfinance/utils@4.2.4

## 4.2.3

### Patch Changes

- f6e1e50: Bump @node-dlc to 1.1.3
- Updated dependencies [f6e1e50]
  - @atomicfinance/types@4.2.3
  - @atomicfinance/bitcoin-utils@4.2.3
  - @atomicfinance/provider@4.2.3
  - @atomicfinance/utils@4.2.3

## 4.2.2

### Patch Changes

- e0cda38: Fix fundingInputToInput derivationPath dlcInput
- Updated dependencies [e0cda38]
  - @atomicfinance/bitcoin-utils@4.2.2
  - @atomicfinance/provider@4.2.2
  - @atomicfinance/types@4.2.2
  - @atomicfinance/utils@4.2.2

## 4.2.1

### Patch Changes

- 8d13721: Fix lexographic ordering dlc input pubkeys
- Updated dependencies [8d13721]
  - @atomicfinance/bitcoin-utils@4.2.1
  - @atomicfinance/provider@4.2.1
  - @atomicfinance/types@4.2.1
  - @atomicfinance/utils@4.2.1

## 4.2.0

### Minor Changes

- ec43a60: Implement DDK DLC splicing support + util refactor

### Patch Changes

- b718514: Refactor funding input sorting
- Updated dependencies [ec43a60]
- Updated dependencies [b718514]
  - @atomicfinance/bitcoin-utils@4.2.0
  - @atomicfinance/provider@4.2.0
  - @atomicfinance/types@4.2.0
  - @atomicfinance/utils@4.2.0

## 4.1.13

### Patch Changes

- 9674167: Ensure consistent sequence numbers in funding sig verification
- Updated dependencies [9674167]
  - @atomicfinance/bitcoin-utils@4.1.13
  - @atomicfinance/provider@4.1.13
  - @atomicfinance/types@4.1.13
  - @atomicfinance/utils@4.1.13

## 4.1.12

### Patch Changes

- 054a95e: Add Buffer.from() wrapper for React Native compatibility
- ebe6af2: Bump @node-dlc to 1.1.2 to fix react native buffer compatibility issues
- Updated dependencies [054a95e]
- Updated dependencies [ebe6af2]
  - @atomicfinance/bitcoin-utils@4.1.12
  - @atomicfinance/provider@4.1.12
  - @atomicfinance/types@4.1.12
  - @atomicfinance/utils@4.1.12

## 4.1.11

### Patch Changes

- 4372f72: Wrap fromOutputScript in buffer for cross platform support
- Updated dependencies [4372f72]
  - @atomicfinance/bitcoin-utils@4.1.11
  - @atomicfinance/provider@4.1.11
  - @atomicfinance/types@4.1.11
  - @atomicfinance/utils@4.1.11

## 4.1.10

### Patch Changes

- 99f0550: Bump @node-dlc to 1.1.1 and ensure consistent oraclePublicKey
- Updated dependencies [99f0550]
  - @atomicfinance/types@4.1.10
  - @atomicfinance/bitcoin-utils@4.1.10
  - @atomicfinance/provider@4.1.10
  - @atomicfinance/utils@4.1.10

## 4.1.9

### Patch Changes

- 58031b0: React native compatibility
- Updated dependencies [58031b0]
  - @atomicfinance/bitcoin-utils@4.1.9
  - @atomicfinance/utils@4.1.9
  - @atomicfinance/provider@4.1.9
  - @atomicfinance/types@4.1.9

## 4.1.8

### Patch Changes

- e1d4e0d: Fix fund tx to use DER encoding for witness sig
- Updated dependencies [e1d4e0d]
  - @atomicfinance/bitcoin-utils@4.1.8
  - @atomicfinance/provider@4.1.8
  - @atomicfinance/types@4.1.8
  - @atomicfinance/utils@4.1.8

## 4.1.7

### Patch Changes

- 1203f06: Ensure refund tx includes sequence from original refund tx ddk provider
- Updated dependencies [1203f06]
  - @atomicfinance/bitcoin-utils@4.1.7
  - @atomicfinance/provider@4.1.7
  - @atomicfinance/types@4.1.7
  - @atomicfinance/utils@4.1.7

## 4.1.6

### Patch Changes

- 5b7d9ea: Fix refund sig generation bitcoin ddk provider
- Updated dependencies [5b7d9ea]
  - @atomicfinance/bitcoin-utils@4.1.6
  - @atomicfinance/provider@4.1.6
  - @atomicfinance/types@4.1.6
  - @atomicfinance/utils@4.1.6

## 4.1.5

### Patch Changes

- f1806a6: Implement rust-dlc/ddk compatible Contract ID computation
- Updated dependencies [f1806a6]
  - @atomicfinance/bitcoin-utils@4.1.5
  - @atomicfinance/provider@4.1.5
  - @atomicfinance/types@4.1.5
  - @atomicfinance/utils@4.1.5

## 4.1.4

### Patch Changes

- 77dd82f: Ensure compact signatures for refund signatures in BitcoinDdkProvider
- Updated dependencies [77dd82f]
  - @atomicfinance/bitcoin-utils@4.1.4
  - @atomicfinance/provider@4.1.4
  - @atomicfinance/types@4.1.4
  - @atomicfinance/utils@4.1.4

## 4.1.3

### Patch Changes

- bd75cc3: Ensure DER signature
- Updated dependencies [bd75cc3]
  - @atomicfinance/bitcoin-utils@4.1.3
  - @atomicfinance/provider@4.1.3
  - @atomicfinance/types@4.1.3
  - @atomicfinance/utils@4.1.3

## 4.1.2

### Patch Changes

- 5536d01: Add ensure buffer to BitcoinDdkProvider
- Updated dependencies [5536d01]
  - @atomicfinance/bitcoin-utils@4.1.2
  - @atomicfinance/provider@4.1.2
  - @atomicfinance/types@4.1.2
  - @atomicfinance/utils@4.1.2

## 4.1.1

### Patch Changes

- ece1dc1: Add DDK address derivation provider
- 0d882fc: Update changeset for ddk
- Updated dependencies [ece1dc1]
- Updated dependencies [0d882fc]
  - @atomicfinance/types@4.1.1
  - @atomicfinance/bitcoin-utils@4.1.1
  - @atomicfinance/provider@4.1.1
  - @atomicfinance/utils@4.1.1

## 4.1.0

### Patch Changes

- b2394fa: Add alpha ddk support in BitcoinDdkProvider
- Updated dependencies [b2394fa]
- Updated dependencies [0224065]
  - @atomicfinance/bitcoin-utils@4.1.0
  - @atomicfinance/provider@4.1.0
  - @atomicfinance/types@4.1.0
  - @atomicfinance/utils@4.1.0
