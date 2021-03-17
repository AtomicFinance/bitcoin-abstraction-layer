import { AdaptorPair } from '../@types/cfd-dlc-js';
import PartyInputs, { PartyInputsJSON } from './PartyInputs';

export default class AcceptMessage {
  constructor(
    readonly contractId: string,
    readonly remotePartyInputs: PartyInputs,
    readonly cetAdaptorPairs: AdaptorPair[],
    readonly refundSignature: string,
  ) {}

  toJSON(): AcceptMessageJSON {
    return Object.assign({}, this, {
      contractId: this.contractId,
      remotePartyInputs: this.remotePartyInputs.toJSON(),
      cetAdaptorPairs: this.cetAdaptorPairs,
      refundSignature: this.refundSignature,
    });
  }

  static fromJSON(json: AcceptMessageJSON): AcceptMessage {
    const outcome = Object.create(PartyInputs.prototype);
    return Object.assign(outcome, json, {
      contractId: json.contractId,
      remotePartyInputs: PartyInputs.fromJSON(json.remotePartyInputs),
      cetAdaptorPairs: json.cetAdaptorPairs,
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
  cetAdaptorPairs: AdaptorPair[];
  refundSignature: string;
}
