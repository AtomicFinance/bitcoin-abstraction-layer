import PartyInputs, { PartyInputsJSON } from './PartyInputs';

export default class AcceptMessage {
  constructor(
    readonly contractId: string,
    readonly remotePartyInputs: PartyInputs,
    readonly cetSignatures: string[],
    readonly refundSignature: string
  ) {}

  toJSON(): AcceptMessageJSON {
    return Object.assign({}, this, {
      contractId: this.contractId,
      remotePartyInputs: this.remotePartyInputs.toJSON(),
      cetSignatures: this.cetSignatures,
      refundSignature: this.refundSignature,
    });
  }

  static fromJSON(json: AcceptMessageJSON): AcceptMessage {
    let outcome = Object.create(PartyInputs.prototype);
    return Object.assign(outcome, json, {
      contractId: json.contractId,
      remotePartyInputs: PartyInputs.fromJSON(json.remotePartyInputs),
      cetSignatures: json.cetSignatures,
      refundSignature: json.refundSignature,
    });
  }

  static reviver(key: string, value: any): any {
    return key === '' ? AcceptMessage.fromJSON(value) : value;
  }
}

export interface AcceptMessageJSON {
  contractId: string;
  remotePartyInputs: PartyInputsJSON;
  cetSignatures: string[];
  refundSignature: string;
}
