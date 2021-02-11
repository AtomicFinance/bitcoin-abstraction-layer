// declare module '@atomicfinance/bitcoin-dlc-provider' {
export class Amount {
  private readonly _satoshis;
  private constructor();
  static FromBitcoin(bitcoin: number): Amount;
  static FromSatoshis(satoshis: number): Amount;
  GetBitcoinAmount(): number;
  GetSatoshiAmount(): number;
  AddSatoshis(satoshis: number): Amount;
  AddBitcoins(bitcoins: number): Amount;
  AddAmount(amount: Amount): Amount;
  CompareWith(amount: Amount): number;
  toJSON(): AmountJSON;
  static fromJSON(json: AmountJSON): Amount;
  static reviver(key: string, value: any): any;
}

export interface AmountJSON {
  _satoshis: number;
}

export class Input {
  readonly txid: string;
  readonly vout: number;
  readonly address: string;
  readonly label: string;
  readonly scriptPubKey: string;
  readonly amount: number;
  readonly confirmations: number;
  readonly spendable: boolean;
  readonly solvable: boolean;
  readonly safe: boolean;
  readonly satoshis: number;
  readonly value: number;
  readonly derivationPath: string;
  constructor(txid: string, vout: number, address: string, label: string, scriptPubKey: string, amount: number, confirmations: number, spendable: boolean, solvable: boolean, safe: boolean, satoshis: number, value: number, derivationPath: string);
}

export class InputDetails {
  readonly localCollateral: Amount;
  readonly remoteCollateral: Amount;
  readonly feeRate: number;
  readonly maturityTime: Date;
  readonly refundLockTime: number;
  readonly cetCsvDelay: number;
  constructor(localCollateral: Amount, remoteCollateral: Amount, feeRate: number, maturityTime: Date, refundLockTime: number, cetCsvDelay: number);
}

export class OutcomeDetails {
  readonly localAmount: Amount;
  readonly remoteAmount: Amount;
  readonly message: string;
  constructor(localAmount: Amount, remoteAmount: Amount, message: string);
}

export class OracleInfo {
  readonly name: string;
  readonly rValue: string;
  readonly publicKey: string;
  constructor(name: string, rValue: string, publicKey: string);
}

export class Outcome {
  readonly message: string;
  readonly local: Amount;
  readonly remote: Amount;
  constructor(message: string, local: Amount, remote: Amount);
  toJSON(): OutcomeJSON;
  static fromJSON(json: OutcomeJSON): Outcome;
  static reviver(key: string, value: any): any;
}

export class PayoutDetails {
  readonly localAmount: Amount;
  readonly remoteAmount: Amount;
}

export interface OutcomeJSON {
  message: string;
  local: AmountJSON;
  remote: AmountJSON;
}

export class PartyInputs {
  readonly fundPublicKey: string;
  readonly sweepPublicKey: string;
  readonly changeAddress: string;
  readonly finalAddress: string;
  readonly utxos: Utxo[];
  constructor(fundPublicKey: string, sweepPublicKey: string, changeAddress: string, finalAddress: string, utxos: Utxo[]);
  GetTotalInputAmount(): number;
  toJSON(): PartyInputsJSON;
  static fromJSON(json: PartyInputsJSON): PartyInputs;
  static reviver(key: string, value: any): any;
}

export interface PartyInputsJSON {
  fundPublicKey: string;
  sweepPublicKey: string;
  changeAddress: string;
  finalAddress: string;
  utxos: UtxoJSON[];
}

export class OfferMessage {
  readonly contractId: string;
  readonly localCollateral: Amount;
  readonly remoteCollateral: Amount;
  readonly maturityTime: Date;
  readonly outcomes: Outcome[];
  readonly oracleInfo: OracleInfo;
  readonly localPartyInputs: PartyInputs;
  readonly feeRate: number;
  readonly cetCsvDelay: number;
  readonly refundLockTime: number;
  constructor(contractId: string, localCollateral: Amount, remoteCollateral: Amount, maturityTime: Date, outcomes: Outcome[], oracleInfo: OracleInfo, localPartyInputs: PartyInputs, feeRate: number, cetCsvDelay: number, refundLockTime: number);
  toJSON(): OfferMessageJSON;
  static fromJSON(json: OfferMessageJSON): OfferMessage;
  static reviver(key: string, value: any): any;
}

export interface OfferMessageJSON {
  contractId: string;
  localCollateral: AmountJSON;
  remoteCollateral: AmountJSON;
  maturityTime: string;
  outcomes: OutcomeJSON[];
  oracleInfo: OracleInfo;
  localPartyInputs: PartyInputsJSON;
  feeRate: number;
  cetCsvDelay: number;
  refundLockTime: number;
}

export class AcceptMessage {
  readonly contractId: string;
  readonly remotePartyInputs: PartyInputs;
  readonly cetSignatures: string[];
  readonly refundSignature: string;
  constructor(contractId: string, remotePartyInputs: PartyInputs, cetSignatures: string[], refundSignature: string);
  toJSON(): AcceptMessageJSON;
  static fromJSON(json: AcceptMessageJSON): AcceptMessage;
  static reviver(key: string, value: any): any;
}

export interface AcceptMessageJSON {
  contractId: string;
  remotePartyInputs: PartyInputsJSON;
  cetSignatures: string[];
  refundSignature: string;
}

export class SignMessage {
  readonly contractId: string;
  readonly fundTxSignatures: string[];
  readonly cetSignatures: string[];
  readonly refundSignature: string;
  readonly utxoPublicKeys: string[];
  constructor(contractId: string, fundTxSignatures: string[], cetSignatures: string[], refundSignature: string, utxoPublicKeys: string[]);
}

export class Contract {
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
  constructor();
  static FromOfferMessage(offerMessage: OfferMessage): Contract;
  GetOfferMessage(): OfferMessage;
  ApplyAcceptMessage(acceptMessage: AcceptMessage): void;
  ApplySignMessage(signMessage: SignMessage): void;
  toJSON(): ContractJSON;
  static fromJSON(json: ContractJSON): Contract;
  static reviver(key: string, value: any): any;
}

export interface ContractJSON {
  id: string;
  localCollateral: AmountJSON;
  remoteCollateral: AmountJSON;
  outcomes: OutcomeJSON[];
  maturityTime: string;
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
  localCetsHex: string[];
  remoteCetsHex: string[];
  cetSignatures: string[];
}

export class Utxo {
  readonly txid: string;
  readonly vout: number;
  readonly amount: Amount;
  readonly address: string;
  readonly derivationPath: string;
  constructor(txid: string, vout: number, amount: Amount, address: string, derivationPath: string);
  toJSON(): UtxoJSON;
  static fromJSON(json: UtxoJSON): Utxo;
  static reviver(key: string, value: any): any;
}

export interface UtxoJSON {
  txid: string;
  vout: number;
  amount: AmountJSON;
  address: string;
  derivationPath: string;
}  
// }
