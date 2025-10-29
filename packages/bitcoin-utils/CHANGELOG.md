# @atomicfinance/bitcoin-utils

## 4.2.6

### Patch Changes

- 4f7eaa7: Bump @node-dlc to 1.1.15
- Updated dependencies [4f7eaa7]
  - @atomicfinance/types@4.2.6
  - @atomicfinance/crypto@4.2.6
  - @atomicfinance/errors@4.2.6
  - @atomicfinance/utils@4.2.6

## 4.2.5

### Patch Changes

- 295d995: Ensure contractId is not null for dlcFundingInput
- Updated dependencies [295d995]
  - @atomicfinance/crypto@4.2.5
  - @atomicfinance/errors@4.2.5
  - @atomicfinance/types@4.2.5
  - @atomicfinance/utils@4.2.5

## 4.2.4

### Patch Changes

- 735d7b9: Bump @node-dlc to 1.1.4
- Updated dependencies [735d7b9]
  - @atomicfinance/types@4.2.4
  - @atomicfinance/crypto@4.2.4
  - @atomicfinance/errors@4.2.4
  - @atomicfinance/utils@4.2.4

## 4.2.3

### Patch Changes

- f6e1e50: Bump @node-dlc to 1.1.3
- Updated dependencies [f6e1e50]
  - @atomicfinance/types@4.2.3
  - @atomicfinance/crypto@4.2.3
  - @atomicfinance/errors@4.2.3
  - @atomicfinance/utils@4.2.3

## 4.2.2

### Patch Changes

- e0cda38: Fix fundingInputToInput derivationPath dlcInput
- Updated dependencies [e0cda38]
  - @atomicfinance/crypto@4.2.2
  - @atomicfinance/errors@4.2.2
  - @atomicfinance/types@4.2.2
  - @atomicfinance/utils@4.2.2

## 4.2.1

### Patch Changes

- 8d13721: Fix lexographic ordering dlc input pubkeys
- Updated dependencies [8d13721]
  - @atomicfinance/crypto@4.2.1
  - @atomicfinance/errors@4.2.1
  - @atomicfinance/types@4.2.1
  - @atomicfinance/utils@4.2.1

## 4.2.0

### Minor Changes

- ec43a60: Implement DDK DLC splicing support + util refactor

### Patch Changes

- b718514: Refactor funding input sorting
- Updated dependencies [ec43a60]
- Updated dependencies [b718514]
  - @atomicfinance/crypto@4.2.0
  - @atomicfinance/errors@4.2.0
  - @atomicfinance/types@4.2.0
  - @atomicfinance/utils@4.2.0

## 4.1.13

### Patch Changes

- 9674167: Ensure consistent sequence numbers in funding sig verification
- Updated dependencies [9674167]
  - @atomicfinance/crypto@4.1.13
  - @atomicfinance/errors@4.1.13
  - @atomicfinance/types@4.1.13
  - @atomicfinance/utils@4.1.13

## 4.1.12

### Patch Changes

- 054a95e: Add Buffer.from() wrapper for React Native compatibility
- ebe6af2: Bump @node-dlc to 1.1.2 to fix react native buffer compatibility issues
- Updated dependencies [054a95e]
- Updated dependencies [ebe6af2]
  - @atomicfinance/crypto@4.1.12
  - @atomicfinance/errors@4.1.12
  - @atomicfinance/types@4.1.12
  - @atomicfinance/utils@4.1.12

## 4.1.11

### Patch Changes

- 4372f72: Wrap fromOutputScript in buffer for cross platform support
- Updated dependencies [4372f72]
  - @atomicfinance/crypto@4.1.11
  - @atomicfinance/errors@4.1.11
  - @atomicfinance/types@4.1.11
  - @atomicfinance/utils@4.1.11

## 4.1.10

### Patch Changes

- 99f0550: Bump @node-dlc to 1.1.1 and ensure consistent oraclePublicKey
- Updated dependencies [99f0550]
  - @atomicfinance/types@4.1.10
  - @atomicfinance/crypto@4.1.10
  - @atomicfinance/errors@4.1.10
  - @atomicfinance/utils@4.1.10

## 4.1.9

### Patch Changes

- 58031b0: React native compatibility
- Updated dependencies [58031b0]
  - @atomicfinance/utils@4.1.9
  - @atomicfinance/crypto@4.1.9
  - @atomicfinance/errors@4.1.9
  - @atomicfinance/types@4.1.9

## 4.1.8

### Patch Changes

- e1d4e0d: Fix fund tx to use DER encoding for witness sig
- Updated dependencies [e1d4e0d]
  - @atomicfinance/crypto@4.1.8
  - @atomicfinance/errors@4.1.8
  - @atomicfinance/types@4.1.8
  - @atomicfinance/utils@4.1.8

## 4.1.7

### Patch Changes

- 1203f06: Ensure refund tx includes sequence from original refund tx ddk provider
- Updated dependencies [1203f06]
  - @atomicfinance/crypto@4.1.7
  - @atomicfinance/errors@4.1.7
  - @atomicfinance/types@4.1.7
  - @atomicfinance/utils@4.1.7

## 4.1.6

### Patch Changes

- 5b7d9ea: Fix refund sig generation bitcoin ddk provider
- Updated dependencies [5b7d9ea]
  - @atomicfinance/crypto@4.1.6
  - @atomicfinance/errors@4.1.6
  - @atomicfinance/types@4.1.6
  - @atomicfinance/utils@4.1.6

## 4.1.5

### Patch Changes

- f1806a6: Implement rust-dlc/ddk compatible Contract ID computation
- Updated dependencies [f1806a6]
  - @atomicfinance/crypto@4.1.5
  - @atomicfinance/errors@4.1.5
  - @atomicfinance/types@4.1.5
  - @atomicfinance/utils@4.1.5

## 4.1.4

### Patch Changes

- 77dd82f: Ensure compact signatures for refund signatures in BitcoinDdkProvider
- Updated dependencies [77dd82f]
  - @atomicfinance/crypto@4.1.4
  - @atomicfinance/errors@4.1.4
  - @atomicfinance/types@4.1.4
  - @atomicfinance/utils@4.1.4

## 4.1.3

### Patch Changes

- bd75cc3: Ensure DER signature
- Updated dependencies [bd75cc3]
  - @atomicfinance/crypto@4.1.3
  - @atomicfinance/errors@4.1.3
  - @atomicfinance/types@4.1.3
  - @atomicfinance/utils@4.1.3

## 4.1.2

### Patch Changes

- 5536d01: Add ensure buffer to BitcoinDdkProvider
- Updated dependencies [5536d01]
  - @atomicfinance/crypto@4.1.2
  - @atomicfinance/errors@4.1.2
  - @atomicfinance/types@4.1.2
  - @atomicfinance/utils@4.1.2

## 4.1.1

### Patch Changes

- ece1dc1: Add DDK address derivation provider
- 0d882fc: Update changeset for ddk
- Updated dependencies [ece1dc1]
- Updated dependencies [0d882fc]
  - @atomicfinance/types@4.1.1
  - @atomicfinance/crypto@4.1.1
  - @atomicfinance/errors@4.1.1
  - @atomicfinance/utils@4.1.1

## 4.1.0

### Minor Changes

- 0224065: Switch from yarn to pnpm and update eslint config

### Patch Changes

- b2394fa: Add alpha ddk support in BitcoinDdkProvider
- Updated dependencies [b2394fa]
- Updated dependencies [0224065]
  - @atomicfinance/crypto@4.1.0
  - @atomicfinance/errors@4.1.0
  - @atomicfinance/types@4.1.0
  - @atomicfinance/utils@4.1.0

## 4.0.3

### Patch Changes

- c7e9691: Update import modules organize imports
- Updated dependencies [c7e9691]
  - @atomicfinance/crypto@4.0.3
  - @atomicfinance/errors@4.0.3
  - @atomicfinance/types@4.0.3
  - @atomicfinance/utils@4.0.3

## 4.0.2

### Patch Changes

- 79a403b: Fix typescript strict mode compilation errors
- Updated dependencies [79a403b]
  - @atomicfinance/crypto@4.0.2
  - @atomicfinance/errors@4.0.2
  - @atomicfinance/types@4.0.2
  - @atomicfinance/utils@4.0.2

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

- Updated dependencies [03c6974]
- Updated dependencies [d94fbbf]
- Updated dependencies [b83e3a8]
  - @atomicfinance/types@4.0.1
  - @atomicfinance/crypto@4.0.1
  - @atomicfinance/errors@4.0.1
  - @atomicfinance/utils@4.0.1

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
  - @atomicfinance/types@4.0.0
  - @atomicfinance/crypto@4.0.0
  - @atomicfinance/errors@4.0.0
  - @atomicfinance/utils@4.0.0

## 3.6.1

### Patch Changes

- 3c85279: Upgrade bitcoinjs-lib v6 with ECPair migration
- Updated dependencies [3c85279]
  - @atomicfinance/utils@3.6.1
  - @atomicfinance/crypto@3.6.1
  - @atomicfinance/errors@3.6.1
  - @atomicfinance/types@3.6.1

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
  - @atomicfinance/types@3.6.0
  - @atomicfinance/crypto@3.6.0
  - @atomicfinance/errors@3.6.0
  - @atomicfinance/utils@3.6.0

## 3.5.3

### Patch Changes

- 87ff085: Fix enum hashed outcomes
- Updated dependencies [87ff085]
  - @atomicfinance/crypto@3.5.3
  - @atomicfinance/errors@3.5.3
  - @atomicfinance/types@3.5.3
  - @atomicfinance/utils@3.5.3

## 3.5.2

### Patch Changes

- 3e8815c: Add support for Enum DLCs
- Updated dependencies [3e8815c]
  - @atomicfinance/crypto@3.5.2
  - @atomicfinance/errors@3.5.2
  - @atomicfinance/types@3.5.2
  - @atomicfinance/utils@3.5.2

## 3.5.1

### Patch Changes

- 9aa93d3: Fix types for bitcoin-rpc-provider
- Updated dependencies [9aa93d3]
  - @atomicfinance/crypto@3.5.1
  - @atomicfinance/errors@3.5.1
  - @atomicfinance/types@3.5.1
  - @atomicfinance/utils@3.5.1

## 3.5.0

### Minor Changes

- fb279b7: Update dependencies for Node LTS and fix payout index edge cases

### Patch Changes

- Updated dependencies [fb279b7]
  - @atomicfinance/errors@3.5.0
  - @atomicfinance/crypto@3.5.0
  - @atomicfinance/types@3.5.0
  - @atomicfinance/utils@3.5.0

## 3.4.7

### Patch Changes

- 0ba01ef: Bump @node-dlc to 0.23.6
- Updated dependencies [0ba01ef]
  - @atomicfinance/types@3.4.7
  - @atomicfinance/crypto@3.4.7
  - @atomicfinance/errors@3.4.7
  - @atomicfinance/utils@3.4.7

## 3.4.6

### Patch Changes

- b765b9c: Bump nodep-dlc to 0.23.5
- Updated dependencies [b765b9c]
  - @atomicfinance/types@3.4.6
  - @atomicfinance/crypto@3.4.6
  - @atomicfinance/errors@3.4.6
  - @atomicfinance/utils@3.4.6

## 3.4.5

### Patch Changes

- 74b7a4f: Bump node-dlc to 0.23.4
- Updated dependencies [74b7a4f]
  - @atomicfinance/types@3.4.5
  - @atomicfinance/crypto@3.4.5
  - @atomicfinance/errors@3.4.5
  - @atomicfinance/utils@3.4.5

## 3.4.4

### Patch Changes

- cc8f06a: Bump node-dlc to 0.23.3
- Updated dependencies [cc8f06a]
  - @atomicfinance/types@3.4.4
  - @atomicfinance/crypto@3.4.4
  - @atomicfinance/errors@3.4.4
  - @atomicfinance/utils@3.4.4

## 3.4.3

### Patch Changes

- db49017: Bump node-dlc to 0.23.2 for all packages
- Updated dependencies [db49017]
  - @atomicfinance/types@3.4.3
  - @atomicfinance/crypto@3.4.3
  - @atomicfinance/errors@3.4.3
  - @atomicfinance/utils@3.4.3

## 3.4.2

### Patch Changes

- e701ba6: Bump node-dlc- to 0.23.1 and add node-dlc batch tx builder validation tests
- Updated dependencies [e701ba6]
  - @atomicfinance/types@3.4.2
  - @atomicfinance/crypto@3.4.2
  - @atomicfinance/errors@3.4.2
  - @atomicfinance/utils@3.4.2

## 3.4.1

### Patch Changes

- 9781efe: Add getInputsForDualFunding functionality and bump @node-dlc
- Updated dependencies [9781efe]
  - @atomicfinance/types@3.4.1
  - @atomicfinance/crypto@3.4.1
  - @atomicfinance/errors@3.4.1
  - @atomicfinance/utils@3.4.1

## 3.4.0

### Minor Changes

- 314d7d7: Add batch dlc funding transactions

### Patch Changes

- Updated dependencies [314d7d7]
  - @atomicfinance/types@3.4.0
  - @atomicfinance/crypto@3.4.0
  - @atomicfinance/errors@3.4.0
  - @atomicfinance/utils@3.4.0

## 3.3.1

### Patch Changes

- 7f6f4a8: Fix rounding error with find payout
- Updated dependencies [7f6f4a8]
  - @atomicfinance/crypto@3.3.1
  - @atomicfinance/errors@3.3.1
  - @atomicfinance/types@3.3.1
  - @atomicfinance/utils@3.3.1

## 3.3.0

### Minor Changes

- 4a512ee: Fix find outcome index for hyperbola payout curve edge case

### Patch Changes

- Updated dependencies [4a512ee]
  - @atomicfinance/crypto@3.3.0
  - @atomicfinance/errors@3.3.0
  - @atomicfinance/types@3.3.0
  - @atomicfinance/utils@3.3.0

## 3.2.5

### Patch Changes

- Updated dependencies [a72c7b9]
  - @atomicfinance/types@3.2.5
  - @atomicfinance/crypto@3.2.5
  - @atomicfinance/errors@3.2.5
  - @atomicfinance/utils@3.2.5

## 3.2.4

### Patch Changes

- 177b76a: Upgrade node-dlc to 0.22.4
- Updated dependencies [177b76a]
  - @atomicfinance/crypto@3.2.4
  - @atomicfinance/errors@3.2.4
  - @atomicfinance/types@3.2.4
  - @atomicfinance/utils@3.2.4

## 3.2.3

### Patch Changes

- @atomicfinance/crypto@3.2.3
- @atomicfinance/errors@3.2.3
- @atomicfinance/types@3.2.3
- @atomicfinance/utils@3.2.3

## 3.2.2

### Patch Changes

- @atomicfinance/crypto@3.2.2
- @atomicfinance/errors@3.2.2
- @atomicfinance/types@3.2.2
- @atomicfinance/utils@3.2.2

## 3.2.1

### Patch Changes

- Updated dependencies [f69141e]
  - @atomicfinance/types@3.2.1
  - @atomicfinance/crypto@3.2.1
  - @atomicfinance/errors@3.2.1
  - @atomicfinance/utils@3.2.1

## 3.2.0

### Patch Changes

- Updated dependencies [dc9ac8a]
  - @atomicfinance/types@3.2.0
  - @atomicfinance/crypto@3.2.0
  - @atomicfinance/errors@3.2.0
  - @atomicfinance/utils@3.2.0

## 3.1.1

### Patch Changes

- @atomicfinance/crypto@3.1.1
- @atomicfinance/errors@3.1.1
- @atomicfinance/types@3.1.1
- @atomicfinance/utils@3.1.1

## 3.1.0

### Patch Changes

- Updated dependencies [c60033b]
  - @atomicfinance/types@3.1.0
  - @atomicfinance/crypto@3.1.0
  - @atomicfinance/errors@3.1.0
  - @atomicfinance/utils@3.1.0

## 3.0.1

### Patch Changes

- @atomicfinance/crypto@3.0.1
- @atomicfinance/errors@3.0.1
- @atomicfinance/types@3.0.1
- @atomicfinance/utils@3.0.1

## 3.0.0

### Major Changes

- a06082e: Create unified standalone `bitcoin-abstraction-layer` package

### Patch Changes

- Updated dependencies [a06082e]
  - @atomicfinance/types@3.0.0
  - @atomicfinance/crypto@3.0.0
  - @atomicfinance/errors@3.0.0
  - @atomicfinance/utils@3.0.0
