---
'@atomicfinance/bitcoin-ddk-provider': patch
'@atomicfinance/bitcoin-dlc-provider': patch
'@atomicfinance/types': minor
---

Replace the hardcoded DLC input witness length with a shared constant.

`220` was written out at five call sites across three packages. It is now
`DLC_INPUT_MAX_WITNESS_LEN`, exported from `@atomicfinance/types`.

The constant is duplicated from ddk rather than read from it because
`@atomicfinance/types` and the CFD-based `BitcoinDlcProvider` have no ddk
instance to call. To stop the copy drifting, `DdkInterface` now declares
`dlcInputMaxWitnessLen()` and `BitcoinDdkProvider.DdkLoaded()` throws if ddk's
value and the constant disagree.
