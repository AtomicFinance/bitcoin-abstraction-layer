---
"@atomicfinance/bitcoin-dlc-provider": major
"@atomicfinance/bitcoin-js-wallet-provider": major
"@atomicfinance/bitcoin-wallet-provider": major
"@atomicfinance/client": major
"@atomicfinance/types": major
---

Migrate from @node-lightning to @node-dlc packages (v0.24.0)

- **BREAKING CHANGE**: Migrated from `@node-lightning` packages to `@node-dlc` packages
- Updated all imports from `@node-lightning/*` to `@node-dlc/*`
- Upgraded Node.js requirement to v18.18.2
- Updated cfd-dlc-js to v0.0.51 and cfd-js to v0.3.13
- Removed unused dependencies: lerna, mocha-webpack

This is a breaking change as it requires Node.js 18+ and changes the underlying cryptographic libraries. 