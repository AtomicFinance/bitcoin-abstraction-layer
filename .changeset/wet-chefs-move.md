---
'@atomicfinance/bitcoin-js-wallet-provider': patch
'@atomicfinance/bitcoin-wallet-provider': patch
'@atomicfinance/bitcoin-dlc-provider': patch
'@atomicfinance/client': patch
'@atomicfinance/types': patch
'@atomicfinance/bitcoin-cfd-provider': patch
'@atomicfinance/bitcoin-esplora-api-provider': patch
'@atomicfinance/bitcoin-esplora-batch-api-provider': patch
'@atomicfinance/bitcoin-node-wallet-provider': patch
'@atomicfinance/bitcoin-rpc-provider': patch
'@atomicfinance/bitcoin-utils': patch
'@atomicfinance/crypto': patch
'@atomicfinance/errors': patch
'@atomicfinance/jsonrpc-provider': patch
'@atomicfinance/node-provider': patch
'@atomicfinance/provider': patch
'@atomicfinance/utils': patch
---

Add single-funded DLC support and update to node-dlc v1.0.1

- Add comprehensive single-funded DLC support to BitcoinDlcProvider
- Update @node-dlc dependencies to v1.0.1 with single-funded support
- Update cfd-dlc-js to v0.0.52
- Implement single-funded DLC detection and validation logic
- Handle acceptDlcOffer with 0 collateral scenarios (no funding)
- Fix fundTxVout calculation for parties with collateral only
- Add getFundOutputValueSats helper with proper error handling
- Add markAsSingleFunded() calls for proper DLC type identification
- Skip funding validation when accept collateral is 0
- Generate addresses/keys without requiring funding inputs

Enables single-funded DLCs where one party provides all collateral
while the other party participates without funding inputs.
