import Amount from './models/Amount'

export interface InputDetails {
  localCollateral: Amount;
  remoteCollateral: Amount;
  feeRate: number;
  maturityTime: number;
  refundLockTime: number;
  cetCsvDelay: number;
}

export interface OutcomeDetails {
  localAmount: Amount;
  remoteAmount: Amount;
  message: string;
}
