import PartyInputs, { PartyInputsJSON } from "./PartyInputs";

export default class AcceptMessage {
  constructor(
    readonly remotePartyInputs: PartyInputs,
    readonly cetSignatures: string[],
    readonly refundSignature: string
  ) {}

  toJSON(): AcceptMessageJSON {
    return Object.assign({}, this, {
      remotePartyInputs: this.remotePartyInputs.toJSON(),
      cetSignatures: this.cetSignatures,
      refundSignature: this.refundSignature
    });
  }

  static fromJSON(json: AcceptMessageJSON): AcceptMessage {
    let outcome = Object.create(PartyInputs.prototype);
    return Object.assign(outcome, json, {
      message: PartyInputs.fromJSON(json.remotePartyInputs),
      cetSignatures: json.cetSignatures,
      refundSignature: json.refundSignature
    });
  }

  static reviver(key: string, value: any): any {
    return key === "" ? AcceptMessage.fromJSON(value) : value;
  }
}

export interface AcceptMessageJSON {
  remotePartyInputs: PartyInputsJSON;
  cetSignatures: string[],
  refundSignature: string
}
