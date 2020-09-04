import Amount from './Amount'

export default class OutcomeDetails {
  constructor(
    readonly localAmount: Amount,
    readonly remoteAmount: Amount,
    readonly message: string
  ) {}
}
