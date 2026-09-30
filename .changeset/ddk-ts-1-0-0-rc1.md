---
'@atomicfinance/types': minor
---

Track the `@bennyblader/ddk-ts@1.0.0-rc1` API rename.

`DdkInterface` members renamed to match the new NAPI surface:

| Before | After |
| --- | --- |
| `addSignatureToTransaction` | `addSignature` |
| `createCetAdaptorSignatureFromOracleInfo` | `cetAdaptorSignatureFromOracleInfo` |
| `getChangeOutputAndFees` | `changeOutputAndFees` |
| `getRawFundingTransactionInputSignature` | `rawFundingInputSignature` |
| `isDustOutput` | `isDust` |
| `signFundTransactionInput` | `signFundInput` |
| `verifyCetAdaptorSigFromOracleInfo` | `verifyFromOracleInfo` |
| `verifyFundTxSignature` | `verifyFundSignature` |

No runtime behaviour changes — every `DdkInterface` method that BAL actually
calls kept its name and signature in `1.0.0-rc1`.

The unused legacy `declare function` block mirroring the same surface has been
removed from `@atomicfinance/types`; import `DdkInterface` instead.

The generated engine in `ddk-v2-engine` then moves every renamed member that
operates on one record onto that record's namespace (for example
`ddk.Transaction.addSignature`); see that changeset.
