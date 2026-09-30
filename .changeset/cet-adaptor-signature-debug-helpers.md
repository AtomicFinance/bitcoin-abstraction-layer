---
'@atomicfinance/bitcoin-ddk-provider': minor
'@atomicfinance/types': minor
---

Expose the CET adaptor signature debug helpers that `ddk-ts` has always
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
