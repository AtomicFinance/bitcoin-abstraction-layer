import Amount, { AmountJSON } from './Amount';

export default class Payout {
  constructor(readonly local: Amount, readonly remote: Amount) {}

  toJSON(): PayoutJSON {
    return Object.assign({}, this, {
      local: this.local.toJSON(),
      remote: this.remote.toJSON(),
    });
  }

  static fromJSON(json: PayoutJSON): Payout {
    const payout = Object.create(Payout.prototype);
    return Object.assign(payout, json, {
      local: Amount.fromJSON(json.local),
      remote: Amount.fromJSON(json.remote),
    });
  }

  static reviver(key: string, value: any): any {
    return key === '' ? Payout.fromJSON(value) : value;
  }
}

export interface PayoutJSON {
  local: AmountJSON;
  remote: AmountJSON;
}
