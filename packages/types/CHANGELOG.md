# @atomicfinance/types

## 4.1.1

### Patch Changes

- ece1dc1: Add DDK address derivation provider
- 0d882fc: Update changeset for ddk

## 4.1.0

### Minor Changes

- 0224065: Switch from yarn to pnpm and update eslint config

### Patch Changes

- b2394fa: Add alpha ddk support in BitcoinDdkProvider

## 4.0.3

### Patch Changes

- c7e9691: Update import modules organize imports

## 4.0.2

### Patch Changes

- 79a403b: Fix typescript strict mode compilation errors

## 4.0.1

### Patch Changes

- 03c6974: Add DLC input splicing support

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

- d94fbbf: Fix TypeScript ESLint compatibility and improve type safety
  - Upgrade @typescript-eslint dependencies to v6.21.0 for TypeScript 4.9.5 support

- b83e3a8: Add single-funded DLC support and update to node-dlc v1.0.1
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

## 4.0.0

### Major Changes

- 8989c75: Upgrade to @node-dlc v1.0.0

  ## Breaking Changes

  This release upgrades to @node-dlc v1.0.0 with significant breaking changes:

  ### Dependencies
  - Upgraded @node-dlc packages from 0.24.0 to ^1.0.0
  - Minimum Node.js version now 18.18.2
  - Added decimal.js dependency for F64 type support

  ### API Changes
  - **Message Types**: Removed versioned suffixes (DlcOfferV0 → DlcOffer)
  - **Property Names**:
    - `fundingPubKey` → `fundingPubkey`
    - `payoutSPK` → `payoutSpk`
    - `changeSPK` → `changeSpk`
    - `cetSignatures` → `cetAdaptorSignatures`
    - `tempContractId` → `temporaryContractId`

  ### Type System
  - **Contract Descriptors**: V0/V1 types replaced with Enumerated/Numerical descriptors
  - **Oracle Types**: OracleInfoV0 → SingleOracleInfo/MultiOracleInfo
  - **Message Validation**: Switched from type-based to property-based checking
  - **Enum Outcomes**: Migrated from Buffer to string format

  ### New Features
  - Enhanced oracle event descriptor handling
  - Improved decimal precision with F64 types
  - Fallback outcome index search algorithm
  - Auto-generation of temporary contract IDs

  ## Migration Guide

  ### Code Updates Required

  ```javascript
  // Before
  const dlcOffer = new DlcOfferV0();
  dlcOffer.fundingPubKey = pubkey;
  dlcOffer.payoutSPK = spk;

  // After
  const dlcOffer = new DlcOffer();
  dlcOffer.fundingPubkey = pubkey;
  dlcOffer.payoutSpk = spk;
  ```

  ### Environment
  - Update Node.js to 18.18.2+
  - Run `yarn install` to update dependencies
  - Review custom DLC implementations for compatibility

  This is a **major breaking change** requiring code updates in consuming applications.

## 3.6.1

### Patch Changes

- 3c85279: Upgrade bitcoinjs-lib v6 with ECPair migration

## 3.6.0

### Minor Changes

- cbf35c5: - **BREAKING CHANGE**: Migrated from `@node-lightning` packages to `@node-dlc` packages
  - Updated all imports from `@node-lightning/*` to `@node-dlc/*`
  - Update @node-dlc 0.24.0 and Node 18+
  - Upgraded Node.js requirement to v18+
  - Updated cfd-dlc-js to v0.0.51 and cfd-js to v0.3.13
  - Removed unused dependencies: lerna, mocha-webpack

## 3.5.3

### Patch Changes

- 87ff085: Fix enum hashed outcomes

## 3.5.2

### Patch Changes

- 3e8815c: Add support for Enum DLCs

## 3.5.1

### Patch Changes

- 9aa93d3: Fix types for bitcoin-rpc-provider

## 3.5.0

### Minor Changes

- fb279b7: Update dependencies for Node LTS and fix payout index edge cases

## 3.4.7

### Patch Changes

- 0ba01ef: Bump @node-dlc to 0.23.6

## 3.4.6

### Patch Changes

- b765b9c: Bump nodep-dlc to 0.23.5

## 3.4.5

### Patch Changes

- 74b7a4f: Bump node-dlc to 0.23.4

## 3.4.4

### Patch Changes

- cc8f06a: Bump node-dlc to 0.23.3

## 3.4.3

### Patch Changes

- db49017: Bump node-dlc to 0.23.2 for all packages

## 3.4.2

### Patch Changes

- e701ba6: Bump node-dlc- to 0.23.1 and add node-dlc batch tx builder validation tests

## 3.4.1

### Patch Changes

- 9781efe: Add getInputsForDualFunding functionality and bump @node-dlc

## 3.4.0

### Minor Changes

- 314d7d7: Add batch dlc funding transactions

## 3.3.1

### Patch Changes

- 7f6f4a8: Fix rounding error with find payout

## 3.3.0

### Minor Changes

- 4a512ee: Fix find outcome index for hyperbola payout curve edge case

## 3.2.5

### Patch Changes

- a72c7b9: Bump node-dlc to 0.22.4 for all packages

## 3.2.4

### Patch Changes

- 177b76a: Upgrade node-dlc to 0.22.4

## 3.2.3

## 3.2.2

## 3.2.1

### Patch Changes

- f69141e: Bump @node-dlc to 0.21.2 to improve env compatibility

## 3.2.0

### Minor Changes

- dc9ac8a: Bump node-dlc to 0.21.0 for fee shifting and rounding intervals for cso

## 3.1.1

## 3.1.0

### Minor Changes

- c60033b: Fix DLC Input Ordering

## 3.0.1

## 3.0.0

### Major Changes

- a06082e: Create unified standalone `bitcoin-abstraction-layer` package

## 2.5.1

### Patch Changes

- Upgrade various package dependencies
