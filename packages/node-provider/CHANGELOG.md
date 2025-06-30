# @atomicfinance/node-provider

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

### Patch Changes

- Updated dependencies [8989c75]
  - @atomicfinance/errors@4.0.0
  - @atomicfinance/provider@4.0.0

## 3.6.1

### Patch Changes

- 3c85279: Upgrade bitcoinjs-lib v6 with ECPair migration
- Updated dependencies [3c85279]
  - @atomicfinance/errors@3.6.1
  - @atomicfinance/provider@3.6.1

## 3.6.0

### Minor Changes

- cbf35c5: - **BREAKING CHANGE**: Migrated from `@node-lightning` packages to `@node-dlc` packages
  - Updated all imports from `@node-lightning/*` to `@node-dlc/*`
  - Update @node-dlc 0.24.0 and Node 18+
  - Upgraded Node.js requirement to v18+
  - Updated cfd-dlc-js to v0.0.51 and cfd-js to v0.3.13
  - Removed unused dependencies: lerna, mocha-webpack

### Patch Changes

- Updated dependencies [cbf35c5]
  - @atomicfinance/errors@3.6.0
  - @atomicfinance/provider@3.6.0

## 3.5.3

### Patch Changes

- 87ff085: Fix enum hashed outcomes
- Updated dependencies [87ff085]
  - @atomicfinance/errors@3.5.3
  - @atomicfinance/provider@3.5.3

## 3.5.2

### Patch Changes

- 3e8815c: Add support for Enum DLCs
- Updated dependencies [3e8815c]
  - @atomicfinance/errors@3.5.2
  - @atomicfinance/provider@3.5.2

## 3.5.1

### Patch Changes

- 9aa93d3: Fix types for bitcoin-rpc-provider
- Updated dependencies [9aa93d3]
  - @atomicfinance/errors@3.5.1
  - @atomicfinance/provider@3.5.1

## 3.5.0

### Minor Changes

- fb279b7: Update dependencies for Node LTS and fix payout index edge cases

### Patch Changes

- Updated dependencies [fb279b7]
  - @atomicfinance/errors@3.5.0
  - @atomicfinance/provider@3.5.0

## 3.4.7

### Patch Changes

- 0ba01ef: Bump @node-dlc to 0.23.6
- Updated dependencies [0ba01ef]
  - @atomicfinance/errors@3.4.7
  - @atomicfinance/provider@3.4.7

## 3.4.6

### Patch Changes

- b765b9c: Bump nodep-dlc to 0.23.5
- Updated dependencies [b765b9c]
  - @atomicfinance/errors@3.4.6
  - @atomicfinance/provider@3.4.6

## 3.4.5

### Patch Changes

- 74b7a4f: Bump node-dlc to 0.23.4
- Updated dependencies [74b7a4f]
  - @atomicfinance/errors@3.4.5
  - @atomicfinance/provider@3.4.5

## 3.4.4

### Patch Changes

- cc8f06a: Bump node-dlc to 0.23.3
- Updated dependencies [cc8f06a]
  - @atomicfinance/errors@3.4.4
  - @atomicfinance/provider@3.4.4

## 3.4.3

### Patch Changes

- db49017: Bump node-dlc to 0.23.2 for all packages
- Updated dependencies [db49017]
  - @atomicfinance/errors@3.4.3
  - @atomicfinance/provider@3.4.3

## 3.4.2

### Patch Changes

- e701ba6: Bump node-dlc- to 0.23.1 and add node-dlc batch tx builder validation tests
- Updated dependencies [e701ba6]
  - @atomicfinance/errors@3.4.2
  - @atomicfinance/provider@3.4.2

## 3.4.1

### Patch Changes

- 9781efe: Add getInputsForDualFunding functionality and bump @node-dlc
- Updated dependencies [9781efe]
  - @atomicfinance/errors@3.4.1
  - @atomicfinance/provider@3.4.1

## 3.4.0

### Minor Changes

- 314d7d7: Add batch dlc funding transactions

### Patch Changes

- Updated dependencies [314d7d7]
  - @atomicfinance/errors@3.4.0
  - @atomicfinance/provider@3.4.0

## 3.3.1

### Patch Changes

- 7f6f4a8: Fix rounding error with find payout
- Updated dependencies [7f6f4a8]
  - @atomicfinance/errors@3.3.1
  - @atomicfinance/provider@3.3.1

## 3.3.0

### Minor Changes

- 4a512ee: Fix find outcome index for hyperbola payout curve edge case

### Patch Changes

- Updated dependencies [4a512ee]
  - @atomicfinance/errors@3.3.0
  - @atomicfinance/provider@3.3.0

## 3.2.5

### Patch Changes

- @atomicfinance/errors@3.2.5
- @atomicfinance/provider@3.2.5

## 3.2.4

### Patch Changes

- 177b76a: Upgrade node-dlc to 0.22.4
- Updated dependencies [177b76a]
  - @atomicfinance/errors@3.2.4
  - @atomicfinance/provider@3.2.4

## 3.2.3

### Patch Changes

- @atomicfinance/errors@3.2.3
- @atomicfinance/provider@3.2.3

## 3.2.2

### Patch Changes

- @atomicfinance/errors@3.2.2
- @atomicfinance/provider@3.2.2

## 3.2.1

### Patch Changes

- @atomicfinance/errors@3.2.1
- @atomicfinance/provider@3.2.1

## 3.2.0

### Patch Changes

- @atomicfinance/errors@3.2.0
- @atomicfinance/provider@3.2.0

## 3.1.1

### Patch Changes

- @atomicfinance/errors@3.1.1
- @atomicfinance/provider@3.1.1

## 3.1.0

### Patch Changes

- @atomicfinance/errors@3.1.0
- @atomicfinance/provider@3.1.0

## 3.0.1

### Patch Changes

- 0ff98b5: Remove @types/axios dependency
  - @atomicfinance/errors@3.0.1
  - @atomicfinance/provider@3.0.1

## 3.0.0

### Major Changes

- a06082e: Create unified standalone `bitcoin-abstraction-layer` package

### Patch Changes

- Updated dependencies [a06082e]
  - @atomicfinance/provider@3.0.0
  - @atomicfinance/errors@3.0.0
