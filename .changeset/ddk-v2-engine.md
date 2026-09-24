---
'@atomicfinance/types': major
'@atomicfinance/bitcoin-ddk-provider': major
'@atomicfinance/bitcoin-ddk-address-derivation-provider': major
---

Run on the ddk v2 engine and fund single-funded contracts the way ddk v2 builds them.

**The engine is now the generated ddk binding** (`@bennyblader/ddk-ts` 1.0.0-rc5,
renamed `@bennyblader/ddk` from its next release). `DdkInterface` mirrors it:

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

An engine from before the generated binding (`@bennyblader/ddk-ts` 0.3.x and the
hand-written 1.0.0-rc1) no longer satisfies `DdkInterface`.

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

The transactions themselves are built by the injected engine. They match the
ddk v2 construction when that engine is built on `ddk-dlc` 2.0.0-rc.4 or later.
Against an earlier engine, creating a single-funded contract with a ddk v2
counterparty fails with an invalid refund signature, because the two sides build
different funding transactions.

**Existing contracts still close.** `createDlcTxs` takes an optional `dlcSign`
(also on `client.dlc.createDlcTxs`). Pass it whenever the contract already
exists, for example to restore or splice it: a single-funded contract created
before `ddk-dlc` 2.0.0-rc.4 is rebuilt under the fee rule whose funding
transaction reproduces the sign message's contract id, and the call throws if
neither rule does. This needs an engine with `FeeRule` and
`createDlcTransactionsWithFeeRule`. `execute`, `refund` and `createDlcClose`
use the transactions they are given and are unaffected.
