---
'@atomicfinance/bitcoin-js-wallet-provider': minor
'@atomicfinance/bitcoin-wallet-provider': minor
'@atomicfinance/bitcoin-dlc-provider': minor
'@atomicfinance/client': minor
'@atomicfinance/types': minor
'@atomicfinance/bitcoin-cfd-provider': minor
'@atomicfinance/bitcoin-esplora-api-provider': minor
'@atomicfinance/bitcoin-esplora-batch-api-provider': minor
'@atomicfinance/bitcoin-node-wallet-provider': minor
'@atomicfinance/bitcoin-rpc-provider': minor
'@atomicfinance/bitcoin-utils': minor
'@atomicfinance/crypto': minor
'@atomicfinance/errors': minor
'@atomicfinance/jsonrpc-provider': minor
'@atomicfinance/node-provider': minor
'@atomicfinance/provider': minor
'@atomicfinance/utils': minor
---

- **BREAKING CHANGE**: Migrated from `@node-lightning` packages to `@node-dlc` packages
- Updated all imports from `@node-lightning/*` to `@node-dlc/*`
- Update @node-dlc 0.24.0 and Node 18+
- Upgraded Node.js requirement to v18+
- Updated cfd-dlc-js to v0.0.51 and cfd-js to v0.3.13
- Removed unused dependencies: lerna, mocha-webpack
