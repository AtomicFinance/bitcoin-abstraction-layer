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

Add DLC input splicing support

This release introduces DLC (Discreet Log Contract) input splicing functionality, enabling more flexible contract funding and management.

## Key Features

- **Core Types**: Added new types and interfaces for DLC input splicing operations
- **Provider Integration**: Implemented splicing support in BitcoinDlcProvider with proper input handling
- **Comprehensive Testing**: Added integration tests to validate splicing functionality
- **Dependency Updates**: Upgraded @node-dlc to v1.1.0 for enhanced splicing capabilities

## What's New

- DLC contracts can now be funded using spliced inputs
- Enhanced input selection and handling for splicing operations
- Improved test coverage for edge cases in DLC splicing scenarios

This feature enables more efficient Bitcoin transaction management when working with DLC contracts by allowing existing UTXOs to be split and used as contract inputs.
