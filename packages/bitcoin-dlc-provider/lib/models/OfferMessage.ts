import Outcome, { OutcomeJSON } from "./Outcome";
import OracleInfo, { OracleInfoJSON } from "./OracleInfo";
import PartyInputs, { PartyInputsJSON } from "./PartyInputs";
import Amount, { AmountJSON } from "./Amount";

export default class OfferMessage {
  constructor(
    readonly contractId: string,
    readonly localCollateral: Amount,
    readonly remoteCollateral: Amount,
    readonly maturityTime: Date,
    readonly outcomes: Outcome[],
    readonly oracleInfo: OracleInfo,
    readonly localPartyInputs: PartyInputs,
    readonly feeRate: number,
    readonly cetCsvDelay: number,
    readonly refundLockTime: number
  ) {}

  toJSON(): OfferMessageJSON {
    const outcomesJSON: OutcomeJSON[] = []
    for (let i = 0; i < this.outcomes.length; i++) {
      const outcome = this.outcomes[i].toJSON()
      outcomesJSON.push(outcome)
    }
    console.log('outcomesJSON', outcomesJSON)

    return Object.assign({}, this, {
      contractId: this.contractId,
      localCollateral: this.localCollateral.toJSON(),
      remoteCollateral: this.remoteCollateral.toJSON(),
      maturityTime: this.maturityTime.toString(),
      outcomes: outcomesJSON,
      oracleInfo: this.oracleInfo.toJSON(),
      localPartyInputs: this.localPartyInputs.toJSON(),
      feeRate: this.feeRate,
      cetCsvDelay: this.cetCsvDelay,
      refundLockTime: this.refundLockTime
    });
  }

  static fromJSON(json: OfferMessageJSON): OfferMessage {
    let offerMessage = Object.create(OfferMessage.prototype);

    const outcomes: Outcome[] = []

    for (let i = 0; i < json.outcomes.length; i++) {
      const outcome = Outcome.fromJSON(json.outcomes[i])
      outcomes.push(outcome)
    }

    return Object.assign(offerMessage, json, {
      contractId: new Date(json.contractId),
      localCollateral: Amount.fromJSON(json.localCollateral),
      remoteCollateral: Amount.fromJSON(json.remoteCollateral),
      maturityTime: new Date(json.maturityTime),
      outcomes,
      oracleInfo: OracleInfo.fromJSON(json.oracleInfo),
      localPartyInputs: PartyInputs.fromJSON(json.localPartyInputs),
      feeRate: json.feeRate,
      cetCsvDelay: json.cetCsvDelay,
      refundLockTime: json.refundLockTime
    });
  }

  static reviver(key: string, value: any): any {
    return key === "" ? OfferMessage.fromJSON(value) : value;
  }
}

interface OfferMessageJSON {
  contractId: string,
  localCollateral: AmountJSON,
  remoteCollateral: AmountJSON,
  maturityTime: string,
  outcomes: OutcomeJSON[],
  oracleInfo: OracleInfoJSON,
  localPartyInputs: PartyInputsJSON,
  feeRate: number,
  cetCsvDelay: number,
  refundLockTime: number
}
