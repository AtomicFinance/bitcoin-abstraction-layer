---
'@atomicfinance/bitcoin-ddk-provider': minor
---

Add a `splicedFundLockTime` option to `BitcoinDdkProvider`, so a successor
contract can be signed in advance and held until its CET locktime.

`new BitcoinDdkProvider(network, ddk, { splicedFundLockTime: 'cetLocktime' })`
builds a new spliced contract, one that spends a DLC funding output, with its
funding transaction's nLockTime set to the offer's `cetLocktime`. ddk then sets
the funding inputs' nSequence to `0xfffffffe`. The default, `'zero'`, is the
funding locktime BAL has always used. Regular contracts always use 0.

The funding locktime is not in the offer, so both parties must use the same
setting. Otherwise they build different funding transactions and
`signDlcAccept` rejects the acceptor's signatures. `createDlcTxs` with a
`dlcSign` rebuilds a spliced contract under either setting, so contracts created
before the option was turned on still restore.

Funding signatures are now made and checked over the funding transaction's
real locktime. Before, the funding PSBTs in `CreateFundingSigs`,
`VerifyFundingSigs` and `CreateFundingTx` always used locktime 0. The input
lookups in those PSBT builders and in `getFundingTransactionSighashDetails` also
no longer reverse the transaction's input hashes in place.
