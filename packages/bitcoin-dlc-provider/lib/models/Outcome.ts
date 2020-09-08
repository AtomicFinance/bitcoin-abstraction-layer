import Amount, { AmountJSON } from "./Amount";

export default class Outcome {
  constructor(
    readonly message: string,
    readonly local: Amount,
    readonly remote: Amount
  ) {}

  toJSON(): OutcomeJSON {
    // copy all fields from `this` to an empty object and return in
    return Object.assign({}, this, {
      // convert fields that need converting
      message: this.message,
      local: this.local.toJSON(),
      remote: this.remote.toJSON()
    });
  }

  static fromJSON(json: OutcomeJSON): Outcome {
    let outcome = Object.create(Outcome.prototype);
    return Object.assign(outcome, json, {
      message: json.message,
      local: Amount.fromJSON(json.local),
      remote: Amount.fromJSON(json.remote)
    });
  }

  static reviver(key: string, value: any): any {
    return key === "" ? Outcome.fromJSON(value) : value;
  }
}

export interface OutcomeJSON {
  message: string;
  local: AmountJSON,
  remote: AmountJSON
}
