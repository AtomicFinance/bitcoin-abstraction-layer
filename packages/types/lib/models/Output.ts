import Amount from './Amount';

export default class Output {
  constructor(readonly address: string, readonly amount: Amount) {}
}
