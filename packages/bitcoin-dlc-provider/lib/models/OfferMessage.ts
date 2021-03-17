import Outcome, { OutcomeJSON } from './Outcome';
import OracleInfo from './OracleInfo';
import PartyInputs, { PartyInputsJSON } from './PartyInputs';
import Payout, { PayoutJSON } from './Payout';
import Amount, { AmountJSON } from './Amount';
import { Messages } from '../@types/cfd-dlc-js';

export default class OfferMessage {
  constructor(
    readonly contractId: string,
    readonly localCollateral: Amount,
    readonly remoteCollateral: Amount,
    readonly payouts: Payout[],
    readonly messagesList: Messages[],
    readonly oracleInfo: OracleInfo,
    readonly localPartyInputs: PartyInputs,
    readonly feeRate: number,
    readonly refundLockTime: number,
  ) {}

  toJSON(): OfferMessageJSON {
    const payoutsJSON: PayoutJSON[] = [];
    for (let i = 0; i < this.payouts.length; i++) {
      const payout = this.payouts[i].toJSON();
      payoutsJSON.push(payout);
    }

    return Object.assign({}, this, {
      contractId: this.contractId,
      localCollateral: this.localCollateral.toJSON(),
      remoteCollateral: this.remoteCollateral.toJSON(),
      payouts: payoutsJSON,
      messagesList: this.messagesList,
      oracleInfo: this.oracleInfo,
      localPartyInputs: this.localPartyInputs.toJSON(),
      feeRate: this.feeRate,
      refundLockTime: this.refundLockTime,
    });
  }

  static fromJSON(json: OfferMessageJSON): OfferMessage {
    const offerMessage = Object.create(OfferMessage.prototype);

    const payouts: Payout[] = [];

    for (let i = 0; i < json.payouts.length; i++) {
      const outcome = Payout.fromJSON(json.payouts[i]);
      payouts.push(outcome);
    }

    return Object.assign(offerMessage, json, {
      contractId: json.contractId,
      localCollateral: Amount.fromJSON(json.localCollateral),
      remoteCollateral: Amount.fromJSON(json.remoteCollateral),
      payouts,
      messagesList: json.messagesList,
      oracleInfo: json.oracleInfo,
      localPartyInputs: PartyInputs.fromJSON(json.localPartyInputs),
      feeRate: json.feeRate,
      refundLockTime: json.refundLockTime,
    });
  }

  static reviver(key: string, value: any): any {
    return key === '' ? OfferMessage.fromJSON(value) : value;
  }
}

export interface OfferMessageJSON {
  contractId: string;
  localCollateral: AmountJSON;
  remoteCollateral: AmountJSON;
  payouts: PayoutJSON[];
  messagesList: Messages[];
  oracleInfo: OracleInfo;
  localPartyInputs: PartyInputsJSON;
  feeRate: number;
  refundLockTime: number;
}
