import Amount from './Amount';

export default class InputDetails {
  constructor(
    readonly localCollateral: Amount,
    readonly remoteCollateral: Amount,
    readonly feeRate: number,
    readonly maturityTime: Date,
    readonly refundLockTime: number,
    readonly cetCsvDelay: number
  ) {}
}
