# @atomicfinance/bitcoin-ddk-address-derivation-provider

## 4.2.4

### Patch Changes

- 735d7b9: Bump @node-dlc to 1.1.4
- Updated dependencies [735d7b9]
  - @atomicfinance/types@4.2.4
  - @atomicfinance/provider@4.2.4

## 4.2.3

### Patch Changes

- f6e1e50: Bump @node-dlc to 1.1.3
- Updated dependencies [f6e1e50]
  - @atomicfinance/types@4.2.3
  - @atomicfinance/provider@4.2.3

## 4.2.2

### Patch Changes

- e0cda38: Fix fundingInputToInput derivationPath dlcInput
- Updated dependencies [e0cda38]
  - @atomicfinance/provider@4.2.2
  - @atomicfinance/types@4.2.2

## 4.2.1

### Patch Changes

- 8d13721: Fix lexographic ordering dlc input pubkeys
- Updated dependencies [8d13721]
  - @atomicfinance/provider@4.2.1
  - @atomicfinance/types@4.2.1

## 4.2.0

### Minor Changes

- ec43a60: Implement DDK DLC splicing support + util refactor

### Patch Changes

- b718514: Refactor funding input sorting
- Updated dependencies [ec43a60]
- Updated dependencies [b718514]
  - @atomicfinance/provider@4.2.0
  - @atomicfinance/types@4.2.0

## 4.1.13

### Patch Changes

- 9674167: Ensure consistent sequence numbers in funding sig verification
- Updated dependencies [9674167]
  - @atomicfinance/provider@4.1.13
  - @atomicfinance/types@4.1.13

## 4.1.12

### Patch Changes

- 054a95e: Add Buffer.from() wrapper for React Native compatibility
- ebe6af2: Bump @node-dlc to 1.1.2 to fix react native buffer compatibility issues
- Updated dependencies [054a95e]
- Updated dependencies [ebe6af2]
  - @atomicfinance/provider@4.1.12
  - @atomicfinance/types@4.1.12

## 4.1.11

### Patch Changes

- 4372f72: Wrap fromOutputScript in buffer for cross platform support
- Updated dependencies [4372f72]
  - @atomicfinance/provider@4.1.11
  - @atomicfinance/types@4.1.11

## 4.1.10

### Patch Changes

- 99f0550: Bump @node-dlc to 1.1.1 and ensure consistent oraclePublicKey
- Updated dependencies [99f0550]
  - @atomicfinance/types@4.1.10
  - @atomicfinance/provider@4.1.10

## 4.1.9

### Patch Changes

- 58031b0: React native compatibility
- Updated dependencies [58031b0]
  - @atomicfinance/provider@4.1.9
  - @atomicfinance/types@4.1.9

## 4.1.8

### Patch Changes

- e1d4e0d: Fix fund tx to use DER encoding for witness sig
- Updated dependencies [e1d4e0d]
  - @atomicfinance/provider@4.1.8
  - @atomicfinance/types@4.1.8

## 4.1.7

### Patch Changes

- 1203f06: Ensure refund tx includes sequence from original refund tx ddk provider
- Updated dependencies [1203f06]
  - @atomicfinance/provider@4.1.7
  - @atomicfinance/types@4.1.7

## 4.1.6

### Patch Changes

- 5b7d9ea: Fix refund sig generation bitcoin ddk provider
- Updated dependencies [5b7d9ea]
  - @atomicfinance/provider@4.1.6
  - @atomicfinance/types@4.1.6

## 4.1.5

### Patch Changes

- f1806a6: Implement rust-dlc/ddk compatible Contract ID computation
- Updated dependencies [f1806a6]
  - @atomicfinance/provider@4.1.5
  - @atomicfinance/types@4.1.5

## 4.1.4

### Patch Changes

- 77dd82f: Ensure compact signatures for refund signatures in BitcoinDdkProvider
- Updated dependencies [77dd82f]
  - @atomicfinance/provider@4.1.4
  - @atomicfinance/types@4.1.4

## 4.1.3

### Patch Changes

- bd75cc3: Ensure DER signature
- Updated dependencies [bd75cc3]
  - @atomicfinance/provider@4.1.3
  - @atomicfinance/types@4.1.3

## 4.1.2

### Patch Changes

- 5536d01: Add ensure buffer to BitcoinDdkProvider
- Updated dependencies [5536d01]
  - @atomicfinance/provider@4.1.2
  - @atomicfinance/types@4.1.2

## 4.1.1

### Patch Changes

- ece1dc1: Add DDK address derivation provider
- Updated dependencies [ece1dc1]
- Updated dependencies [0d882fc]
  - @atomicfinance/types@4.1.1
  - @atomicfinance/provider@4.1.1
