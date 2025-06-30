---
'@atomicfinance/bitcoin-js-wallet-provider': major
'@atomicfinance/bitcoin-wallet-provider': major
'@atomicfinance/bitcoin-dlc-provider': major
'@atomicfinance/client': major
'@atomicfinance/types': major
'@atomicfinance/bitcoin-cfd-provider': major
'@atomicfinance/bitcoin-esplora-api-provider': major
'@atomicfinance/bitcoin-esplora-batch-api-provider': major
'@atomicfinance/bitcoin-node-wallet-provider': major
'@atomicfinance/bitcoin-rpc-provider': major
'@atomicfinance/bitcoin-utils': major
'@atomicfinance/crypto': major
'@atomicfinance/errors': major
'@atomicfinance/jsonrpc-provider': major
'@atomicfinance/node-provider': major
'@atomicfinance/provider': major
'@atomicfinance/utils': major
---

Upgrade to @node-dlc v1.0.0

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
