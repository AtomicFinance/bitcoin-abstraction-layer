import Outcome, { OutcomeJSON } from "./Outcome";
import PartyInputs, { PartyInputsJSON } from "./PartyInputs";
import OracleInfo from "./OracleInfo";
import OfferMessage, { OfferMessageJSON } from "./OfferMessage";
import AcceptMessage, { AcceptMessageJSON } from "./AcceptMessage";
import SignMessage from "./SignMessage";
import Amount, { AmountJSON } from "./Amount";

export default class Contract {
  id: string;
  localCollateral: Amount;
  remoteCollateral: Amount;
  outcomes: Outcome[];
  maturityTime: Date;
  feeRate: number;
  localPartyInputs: PartyInputs;
  remotePartyInputs: PartyInputs;
  oracleInfo: OracleInfo;
  cetCsvDelay: number;
  refundLockTime: number;
  isLocalParty: boolean;
  fundTxHex: string;
  fundTxId: string;
  fundTxOutAmount: Amount;
  fundTxSignatures: string[];
  refundTransaction: string;
  refundLocalSignature: string;
  refundRemoteSignature: string;
  localCetsHex: string[];
  remoteCetsHex: string[];
  cetSignatures: string[];
  startingIndex: number;

  constructor() {
    this.outcomes = [];
  }

  public static FromOfferMessage(offerMessage: OfferMessage) {
    const contract = new Contract();
    contract.id = offerMessage.contractId;
    contract.localCollateral = offerMessage.localCollateral;
    contract.remoteCollateral = offerMessage.remoteCollateral;
    contract.maturityTime = offerMessage.maturityTime;
    contract.outcomes = offerMessage.outcomes;
    contract.oracleInfo = offerMessage.oracleInfo;
    contract.localPartyInputs = offerMessage.localPartyInputs;
    contract.feeRate = offerMessage.feeRate;
    contract.cetCsvDelay = offerMessage.cetCsvDelay;
    contract.refundLockTime = offerMessage.refundLockTime;
    contract.isLocalParty = false;
    return contract;
  }

  public GetOfferMessage(): OfferMessage {
    this.isLocalParty = true;
    return {
      contractId: this.id,
      localCollateral: this.localCollateral,
      remoteCollateral: this.remoteCollateral,
      maturityTime: this.maturityTime,
      outcomes: this.outcomes,
      oracleInfo: this.oracleInfo,
      localPartyInputs: this.localPartyInputs,
      feeRate: this.feeRate,
      cetCsvDelay: this.cetCsvDelay,
      refundLockTime: this.refundLockTime,
      toJSON: OfferMessage.prototype.toJSON
    };
  }

  public ApplyAcceptMessage(acceptMessage: AcceptMessage) {
    this.cetSignatures = acceptMessage.cetSignatures;
    this.refundRemoteSignature = acceptMessage.refundSignature;
    this.remotePartyInputs = acceptMessage.remotePartyInputs;
  }

  public ApplySignMessage(signMessage: SignMessage) {
    this.cetSignatures = signMessage.cetSignatures;
    this.refundLocalSignature = signMessage.refundSignature;
    this.fundTxSignatures = signMessage.fundTxSignatures;
  }

  toJSON(): ContractJSON {
    const outcomesJSON: OutcomeJSON[] = []
    for (let i = 0; i < this.outcomes.length; i++) {
      const outcome = this.outcomes[i].toJSON()
      outcomesJSON.push(outcome)
    }

    return Object.assign({}, this, {
      id: this.id,
      localCollateral: this.localCollateral.toJSON(),
      remoteCollateral: this.remoteCollateral.toJSON(),
      outcomes: outcomesJSON,
      maturityTime: this.maturityTime.toString(),
      feeRate: this.feeRate,
      localPartyInputs: this.localPartyInputs.toJSON(),
      remotePartyInputs: this.remotePartyInputs.toJSON(),
      oracleInfo: this.oracleInfo,
      cetCsvDelay: this.cetCsvDelay,
      refundLockTime: this.refundLockTime,
      isLocalParty: this.isLocalParty,
      fundTxHex: this.fundTxHex,
      fundTxId: this.fundTxId,
      fundTxOutAmount: this.fundTxOutAmount.toJSON(),
      fundTxSignatures: this.fundTxSignatures,
      refundTransaction: this.refundTransaction,
      refundLocalSignature: this.refundLocalSignature,
      refundRemoteSignature: this.refundRemoteSignature,
      localCetsHex: this.localCetsHex,
      remoteCetsHex: this.remoteCetsHex,
      cetSignatures: this.cetSignatures
    });
  }

  static fromJSON(json: ContractJSON): Contract {
    let contractMessage = Object.create(Contract.prototype);

    const outcomes: Outcome[] = []

    for (let i = 0; i < json.outcomes.length; i++) {
      const outcome = Outcome.fromJSON(json.outcomes[i])
      outcomes.push(outcome)
    }

    return Object.assign(contractMessage, json, {
      id: json.id,
      localCollateral: Amount.fromJSON(json.localCollateral),
      remoteCollateral: Amount.fromJSON(json.remoteCollateral),
      outcomes,
      maturityTime: new Date(json.maturityTime),
      localPartyInputs: PartyInputs.fromJSON(json.localPartyInputs),
      remotePartyInputs: PartyInputs.fromJSON(json.remotePartyInputs),
      fundTxOutAmount: Amount.fromJSON(json.fundTxOutAmount),
    });
  }

  static reviver(key: string, value: any): any {
    return key === "" ? Contract.fromJSON(value) : value;
  }
}

export interface ContractJSON {
  id: string,
  localCollateral: AmountJSON,
  remoteCollateral: AmountJSON,
  outcomes: OutcomeJSON[],
  maturityTime: string,
  feeRate: number,
  localPartyInputs: PartyInputsJSON,
  remotePartyInputs: PartyInputsJSON,
  oracleInfo: OracleInfo,
  cetCsvDelay: number,
  refundLockTime: number,
  isLocalParty: boolean,
  fundTxHex: string,
  fundTxId: string,
  fundTxOutAmount: AmountJSON,
  fundTxSignatures: string[],
  refundTransaction: string,
  refundLocalSignature: string,
  refundRemoteSignature: string,
  localCetsHex: string[],
  remoteCetsHex: string[],
  cetSignatures: string[]
}
