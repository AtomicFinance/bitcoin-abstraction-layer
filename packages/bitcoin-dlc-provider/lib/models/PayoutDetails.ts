import Amount from './Amount';

export default class PayoutDetails {
  constructor(
    readonly localAmount: Amount,
    readonly remoteAmount: Amount
  ) {}
}
