---
'@atomicfinance/types': major
'@atomicfinance/bitcoin-ddk-provider': major
'@atomicfinance/bitcoin-ddk-address-derivation-provider': major
---

Release 5.0.0: run on the ddk v2 engine and fund single-funded contracts the
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
