# Bitcoin DLC Provider

This package provides DLC (Discreet Log Contract) functionality for Bitcoin, including support for both standard dual-funded and single-funded DLCs.

## Single-Funded DLCs

The provider now supports single-funded DLCs where only one party (the offerer) provides funding, while the accepting party contributes zero collateral. This is useful for scenarios like:

- Insurance contracts where only one party has financial risk
- Prediction markets with asymmetric stakes
- Options contracts where the buyer pays a premium but the seller provides collateral

### Usage Example

```typescript
// Create a DLC offer where the offerer provides all funding
const dlcOffer = await dlcProvider.createDlcOffer(
  contractInfo,
  totalCollateral, // Offerer provides full collateral
  feeRatePerVb,
  cetLocktime,
  refundLocktime
);

// Accept the offer with zero collateral (single-funded)
// The method automatically detects this is single-funded when accept collateral = 0
const { dlcAccept, dlcTransactions } = await dlcProvider.acceptDlcOffer(dlcOffer);

// Continue with normal DLC flow (sign, finalize, etc.)
const { dlcSign } = await dlcProvider.signDlcAccept(dlcOffer, dlcAccept);
const fundTx = await dlcProvider.finalizeDlcSign(dlcOffer, dlcAccept, dlcSign, dlcTransactions);
```

### How It Works

When `acceptDlcOffer()` is called and the calculated accept collateral is 0, the method:

1. Automatically detects this is a single-funded DLC
2. Generates necessary addresses and keys without requiring funding inputs
3. Sets funding inputs to an empty array for the accept side
4. Skips funding validation since no funding is required
5. Continues with normal DLC transaction creation and signing

The rest of the DLC flow (execution, refund, closing) works identically to dual-funded DLCs.

## Standard Dual-Funded DLCs

For standard DLCs where both parties provide funding, the existing API remains unchanged and fully backward compatible. 