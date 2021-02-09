import Outcome, { OutcomeJSON } from './Outcome';
import PartyInputs, { PartyInputsJSON } from './PartyInputs';
import OracleInfo from './OracleInfo';
import OfferMessage, { OfferMessageJSON } from './OfferMessage';
import AcceptMessage, { AcceptMessageJSON } from './AcceptMessage';
import Payout, { PayoutJSON } from './Payout'
import SignMessage from './SignMessage';
import Amount, { AmountJSON } from './Amount';
import { AdaptorPair, Messages } from '../cfdDlcJsTypes';

export default class Contract {
  id: string;
  localCollateral: Amount;
  remoteCollateral: Amount;
  payouts: Payout[];
  messagesList: Messages[];
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
  cetsHex: string[];
  cetAdaptorPairs: AdaptorPair[];
  startingIndex: number;

  constructor() {
    this.payouts = [];
    this.messagesList = [];
  }

  public static FromOfferMessage(offerMessage: OfferMessage) {
    const contract = new Contract();
    contract.id = offerMessage.contractId;
    contract.localCollateral = offerMessage.localCollateral;
    contract.remoteCollateral = offerMessage.remoteCollateral;
    contract.payouts = offerMessage.payouts;
    contract.oracleInfo = offerMessage.oracleInfo;
    contract.localPartyInputs = offerMessage.localPartyInputs;
    contract.feeRate = offerMessage.feeRate;
    contract.refundLockTime = offerMessage.refundLockTime;
    contract.isLocalParty = false;
    contract.messagesList = offerMessage.messagesList;
    return contract;
  }

  public GetOfferMessage(): OfferMessage {
    this.isLocalParty = true;
    return {
      contractId: this.id,
      localCollateral: this.localCollateral,
      remoteCollateral: this.remoteCollateral,
      payouts: this.payouts,
      oracleInfo: this.oracleInfo,
      localPartyInputs: this.localPartyInputs,
      feeRate: this.feeRate,
      refundLockTime: this.refundLockTime,
      messagesList: this.messagesList,
      toJSON: OfferMessage.prototype.toJSON,
    };
  }

  public ApplyAcceptMessage(acceptMessage: AcceptMessage) {
    this.cetAdaptorPairs = acceptMessage.cetAdaptorPairs;
    this.refundRemoteSignature = acceptMessage.refundSignature;
    this.remotePartyInputs = acceptMessage.remotePartyInputs;
  }

  public ApplySignMessage(signMessage: SignMessage) {
    this.cetAdaptorPairs = signMessage.cetAdaptorPairs;
    this.refundLocalSignature = signMessage.refundSignature;
    this.fundTxSignatures = signMessage.fundTxSignatures;
  }

  toJSON(): ContractJSON {
    const payoutsJSON: PayoutJSON[] = [];
    for (let i = 0; i < this.payouts.length; i++) {
      const payout = this.payouts[i].toJSON();
      payoutsJSON.push(payout);
    }

    return Object.assign({}, this, {
      id: this.id,
      localCollateral: this.localCollateral?.toJSON(),
      remoteCollateral: this.remoteCollateral?.toJSON(),
      payouts: payoutsJSON,
      feeRate: this.feeRate,
      localPartyInputs: this.localPartyInputs?.toJSON(),
      remotePartyInputs: this.remotePartyInputs?.toJSON(),
      oracleInfo: this.oracleInfo,
      cetCsvDelay: this.cetCsvDelay,
      refundLockTime: this.refundLockTime,
      isLocalParty: this.isLocalParty,
      fundTxHex: this.fundTxHex,
      fundTxId: this.fundTxId,
      fundTxOutAmount: this.fundTxOutAmount?.toJSON(),
      fundTxSignatures: this.fundTxSignatures,
      refundTransaction: this.refundTransaction,
      refundLocalSignature: this.refundLocalSignature,
      refundRemoteSignature: this.refundRemoteSignature,
      cetsHex: this.cetsHex,
      cetAdaptorPairs: this.cetAdaptorPairs
    });
  }

  static fromJSON(json: ContractJSON): Contract {
    let contractMessage = Object.create(Contract.prototype);

    const payouts: Payout[] = [];

    for (let i = 0; i < json.payouts.length; i++) {
      const payout = Payout.fromJSON(json.payouts[i]);
      payouts.push(payout);
    }

    return Object.assign(contractMessage, json, {
      id: json.id,
      localCollateral: Amount.fromJSON(json.localCollateral),
      remoteCollateral: Amount.fromJSON(json.remoteCollateral),
      payouts,
      messagesList: json.messagesList,
      localPartyInputs: PartyInputs.fromJSON(json.localPartyInputs),
      remotePartyInputs: PartyInputs.fromJSON(json.remotePartyInputs),
      fundTxOutAmount: Amount.fromJSON(json.fundTxOutAmount),
    });
  }

  static reviver(key: string, value: any): any {
    return key === '' ? Contract.fromJSON(value) : value;
  }
}

export interface ContractJSON {
  id: string;
  localCollateral: AmountJSON;
  remoteCollateral: AmountJSON;
  payouts: PayoutJSON[];
  messagesList: Messages[];
  feeRate: number;
  localPartyInputs: PartyInputsJSON;
  remotePartyInputs: PartyInputsJSON;
  oracleInfo: OracleInfo;
  cetCsvDelay: number;
  refundLockTime: number;
  isLocalParty: boolean;
  fundTxHex: string;
  fundTxId: string;
  fundTxOutAmount: AmountJSON;
  fundTxSignatures: string[];
  refundTransaction: string;
  refundLocalSignature: string;
  refundRemoteSignature: string;
  cetsHex: string[];
  cetAdaptorPairs: AdaptorPair[];
}
