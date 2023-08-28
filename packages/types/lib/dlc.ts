/* eslint-disable max-len */
/* eslint-disable indent */

import {
  CetAdaptorSignatures,
  ContractInfo,
  DlcAccept,
  DlcClose,
  DlcCloseMetadata,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  FundingInput,
  OracleAttestationV0Pre167,
} from '@node-dlc/messaging';
import { Tx } from '@node-lightning/bitcoin';

import { TxOutRequest } from './common';
import Input from './models/Input';

export interface DlcProvider {
  GetInputsForAmount(
    amount: bigint,
    feeRatePerVb: bigint,
    fixedInputs: Input[],
  ): Promise<Input[]>;

  /**
   * Check whether wallet is offerer of DlcOffer or DlcAccept
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @returns {Promise<CreateDlcTxsResponse>}
   */
  isOfferer(_dlcOffer: DlcOffer, _dlcAccept: DlcAccept): Promise<boolean>;

  /**
   * Create DlcTxs object from DlcOffer and DlcAccept
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @returns {Promise<boolean>}
   */
  createDlcTxs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
  ): Promise<CreateDlcTxsResponse>;

  /**
   * Create DLC Offer Message
   * @param contractInfo ContractInfo TLV (V0 or V1)
   * @param offerCollateralSatoshis Amount DLC Initiator is putting into the contract
   * @param feeRatePerVb Fee rate in satoshi per virtual byte that both sides use to compute fees in funding tx
   * @param cetLocktime The nLockTime to be put on CETs
   * @param refundLocktime The nLockTime to be put on the refund transaction
   * @returns {Promise<DlcOffer>}
   */
  createDlcOffer(
    contractInfo: ContractInfo,
    offerCollateralSatoshis: bigint,
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktime: number,
    fixedInputs?: Input[],
  ): Promise<DlcOffer>;

  /**
   * Accept DLC Offer
   * @param _dlcOffer Dlc Offer Message
   * @param fixedInputs Optional inputs to use for Funding Inputs
   * @returns {Promise<AcceptDlcOfferResponse}
   */
  acceptDlcOffer(
    _dlcOffer: DlcOffer,
    fixedInputs?: Input[],
  ): Promise<AcceptDlcOfferResponse>;

  /**
   * Sign Dlc Accept Message
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @returns {Promise<SignDlcAcceptResponse}
   */
  signDlcAccept(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
  ): Promise<SignDlcAcceptResponse>;

  /**
   * Finalize Dlc Sign
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @param _dlcSign Dlc Sign Message
   * @param _dlcTxs Dlc Transactions Message
   * @returns {Promise<Tx>}
   */
  finalizeDlcSign(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
  ): Promise<Tx>;

  /**
   * Execute DLC
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @param _dlcSign Dlc Sign Message
   * @param _dlcTxs Dlc Transactions Message
   * @param oracleAttestation Oracle Attestations TLV (V0)
   * @param isOfferer Whether party is Dlc Offerer
   * @returns {Promise<Tx>}
   */
  execute(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    oracleAttestation: OracleAttestationV0Pre167,
    isOfferer?: boolean,
  ): Promise<Tx>;

  /**
   * Refund DLC
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @param _dlcSign Dlc Sign Message
   * @param _dlcTxs Dlc Transactions message
   * @returns {Promise<Tx>}
   */
  refund(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
  ): Promise<Tx>;

  /**
   * Generate multiple DlcClose messagetypes for closing DLC with Mutual Consent
   * @param _dlcOffer DlcOffer TLV (V0)
   * @param _dlcAccept DlcAccept TLV (V0)
   * @param _dlcTxs DlcTransactions TLV (V0)
   * @param initiatorPayouts Array of amounts initiator expects as payouts
   * @param isOfferer Whether offerer or not
   * @param _inputs Optionally specified closing inputs
   * @returns {Promise<DlcClose[]>}
   */
  createBatchDlcClose(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    initiatorPayouts: bigint[],
    isOfferer?: boolean,
    _inputs?: Input[],
  ): Promise<DlcClose[]>;

  verifyBatchDlcCloseUsingMetadata(
    dlcCloseMetadata: DlcCloseMetadata,
    _dlcCloses: DlcClose[],
    isOfferer?: boolean,
  ): Promise<void>;

  /**
   * Verify multiple DlcClose messagetypes for closing DLC with Mutual Consent
   * @param _dlcOffer DlcOffer TLV (V0)
   * @param _dlcAccept DlcAccept TLV (V0)
   * @param _dlcTxs DlcTransactions TLV (V0)
   * @param _dlcCloses DlcClose[] TLV (V0)
   * @param isOfferer Whether offerer or not
   * @returns {Promise<void>}
   */
  verifyBatchDlcClose(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    _dlcCloses: DlcClose[],
    isOfferer?: boolean,
  ): Promise<void>;

  /**
   * Finalize Dlc Close
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @param _dlcClose Dlc Close Message
   * @param _dlcTxs Dlc Transactions Message
   * @returns {Promise<string>}
   */
  finalizeDlcClose(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcClose: DlcClose,
    _dlcTxs: DlcTransactions,
  ): Promise<string>;

  AddSignatureToFundTransaction(
    jsonObject: AddSignatureToFundTransactionRequest,
  ): Promise<AddSignatureToFundTransactionResponse>;

  CreateCetAdaptorSignature(
    jsonObject: CreateCetAdaptorSignatureRequest,
  ): Promise<CreateCetAdaptorSignatureResponse>;

  CreateCetAdaptorSignatures(
    jsonObject: CreateCetAdaptorSignaturesRequest,
  ): Promise<CreateCetAdaptorSignaturesResponse>;

  AddSignaturesToRefundTx(
    jsonObject: AddSignaturesToRefundTxRequest,
  ): Promise<AddSignaturesToRefundTxResponse>;

  CreateCet(jsonObject: CreateCetRequest): Promise<CreateCetResponse>;

  CreateDlcTransactions(
    jsonObject: CreateDlcTransactionsRequest,
  ): Promise<CreateDlcTransactionsResponse>;

  CreateFundTransaction(
    jsonObject: CreateFundTransactionRequest,
  ): Promise<CreateFundTransactionResponse>;

  CreateRefundTransaction(
    jsonObject: CreateRefundTransactionRequest,
  ): Promise<CreateRefundTransactionResponse>;

  GetRawFundTxSignature(
    jsonObject: GetRawFundTxSignatureRequest,
  ): Promise<GetRawFundTxSignatureResponse>;

  GetRawRefundTxSignature(
    jsonObject: GetRawRefundTxSignatureRequest,
  ): Promise<GetRawRefundTxSignatureResponse>;

  SignCet(jsonObject: SignCetRequest): Promise<SignCetResponse>;

  VerifyCetAdaptorSignature(
    jsonObject: VerifyCetAdaptorSignatureRequest,
  ): Promise<VerifyCetAdaptorSignatureResponse>;

  VerifyCetAdaptorSignatures(
    jsonObject: VerifyCetAdaptorSignaturesRequest,
  ): Promise<VerifyCetAdaptorSignaturesResponse>;

  SignFundTransaction(
    jsonObject: SignFundTransactionRequest,
  ): Promise<SignFundTransactionResponse>;

  VerifyFundTxSignature(
    jsonObject: VerifyFundTxSignatureRequest,
  ): Promise<VerifyFundTxSignatureResponse>;

  VerifyRefundTxSignature(
    jsonObject: VerifyRefundTxSignatureRequest,
  ): Promise<VerifyRefundTxSignatureResponse>;

  fundingInputToInput(_input: FundingInput): Promise<Input>;

  inputToFundingInput(input: Input): Promise<FundingInput>;
}

export interface InitializeResponse {
  fundingPubKey: Buffer;
  payoutSPK: Buffer;
  payoutSerialId: bigint;
  fundingInputs: FundingInput[];
  changeSPK: Buffer;
  changeSerialId: bigint;
}

export interface AcceptDlcOfferResponse {
  dlcAccept: DlcAccept;
  dlcTransactions: DlcTransactions;
}

export interface SignDlcAcceptResponse {
  dlcSign: DlcSign;
  dlcTransactions: DlcTransactions;
}

export interface GetPayoutsResponse {
  payouts: PayoutRequest[];
  payoutGroups: PayoutGroup[];
  messagesList: Messages[];
}

export interface CreateDlcTxsResponse {
  dlcTransactions: DlcTransactions;
  messagesList: Messages[];
}

interface ISig {
  encryptedSig: Buffer;
  dleqProof: Buffer;
}

export interface CreateCetAdaptorAndRefundSigsResponse {
  cetSignatures: CetAdaptorSignatures;
  refundSignature: Buffer;
}

interface PayoutGroup {
  payout: bigint;
  groups: number[][];
}

interface FindOutcomeResponse {
  index: number;
  groupLength: number;
}

/* eslint-disable max-len */
/* eslint-disable indent */

export interface AdaptorPair {
  signature: string;
  proof: string;
}

/** Add signatures to a refund transaction */
export interface AddSignaturesToRefundTxRequest {
  refundTxHex: string;
  signatures: string[];
  fundTxId: string;
  fundVout?: number;
  localFundPubkey: string;
  remoteFundPubkey: string;
}

export interface AddSignaturesToRefundTxResponse {
  hex: string;
}

/** Add a signature to fund transaction */
export interface AddSignatureToFundTransactionRequest {
  fundTxHex: string;
  signature: string;
  prevTxId: string;
  prevVout: number;
  pubkey: string;
}

export interface AddSignatureToFundTransactionResponse {
  hex: string;
}

/** Create an adaptor signature for a CET */
export interface CreateCetAdaptorSignatureRequest {
  cetHex: string;
  privkey: string;
  fundTxId: string;
  fundVout?: number;
  localFundPubkey: string;
  remoteFundPubkey: string;
  oraclePubkey: string;
  oracleRValues: string[];
  fundInputAmount: bigint | number;
  messages: string[];
}

export interface CreateCetAdaptorSignatureResponse {
  signature: string;
  proof: string;
}

/** Create an adaptor signature for a CET */
export interface CreateCetAdaptorSignaturesRequest {
  cetsHex: string[];
  privkey: string;
  fundTxId: string;
  fundVout?: number;
  localFundPubkey: string;
  remoteFundPubkey: string;
  oraclePubkey: string;
  oracleRValues: string[];
  fundInputAmount: bigint | number;
  messagesList: Messages[];
}

export interface CreateCetAdaptorSignaturesResponse {
  adaptorPairs: AdaptorPair[];
}

/** Create a CET */
export interface CreateCetRequest {
  localFundPubkey: string;
  remoteFundPubkey: string;
  localFinalAddress: string;
  remoteFinalAddress: string;
  localPayout: bigint | number;
  remotePayout: bigint | number;
  fundTxId: string;
  fundVout?: number;
  lockTime: bigint | number;
  localSerialId?: bigint | number;
  remoteSerialId?: bigint | number;
}

export interface CreateCetResponse {
  hex: string;
}

/** Create Dlc transactions */
export interface CreateDlcTransactionsRequest {
  payouts: PayoutRequest[];
  localFundPubkey: string;
  localFinalScriptPubkey: string;
  remoteFundPubkey: string;
  remoteFinalScriptPubkey: string;
  localInputAmount: bigint | number;
  localCollateralAmount: bigint | number;
  localPayoutSerialId: bigint | number;
  localChangeSerialId: bigint | number;
  remoteInputAmount: bigint | number;
  remoteCollateralAmount: bigint | number;
  remotePayoutSerialId: bigint | number;
  remoteChangeSerialId: bigint | number;
  refundLocktime: bigint | number;
  localInputs: TxInInfoRequest[];
  localChangeScriptPubkey: string;
  remoteInputs: TxInInfoRequest[];
  remoteChangeScriptPubkey: string;
  feeRate: number;
  cetLockTime?: bigint | number;
  fundLockTime?: bigint | number;
  fundOutputSerialId?: bigint | number;
  optionDest?: string;
  optionPremium?: bigint | number;
}

export interface CreateDlcTransactionsResponse {
  fundTxHex: string;
  cetsHex: string[];
  refundTxHex: string;
}

/** Create a fund transaction */
export interface CreateFundTransactionRequest {
  localPubkey: string;
  remotePubkey: string;
  outputAmount: bigint | number;
  localInputs: TxInInfoRequest[];
  localChange: TxOutRequest;
  remoteInputs: TxInInfoRequest[];
  remoteChange: TxOutRequest;
  feeRate: bigint | number;
  optionDest?: string;
  optionPremium?: bigint | number;
  lockTime?: bigint | number;
  localSerialId?: bigint | number;
  remoteSerialId?: bigint | number;
  outputSerialId?: bigint | number;
}

export interface CreateFundTransactionResponse {
  hex: string;
}

/** Create a refund transaction */
export interface CreateRefundTransactionRequest {
  localFinalScriptPubkey: string;
  remoteFinalScriptPubkey: string;
  localAmount: bigint | number;
  remoteAmount: bigint | number;
  lockTime: bigint | number;
  fundTxId: string;
  fundVout?: number;
}

export interface CreateRefundTransactionResponse {
  hex: string;
}

/** Get a signature for a fund transaction input */
export interface GetRawFundTxSignatureRequest {
  fundTxHex: string;
  privkey: string;
  prevTxId: string;
  prevVout: number;
  amount: bigint | number;
}

export interface GetRawFundTxSignatureResponse {
  hex: string;
}

/** Get a signature for a CET */
export interface GetRawRefundTxSignatureRequest {
  refundTxHex: string;
  privkey: string;
  fundTxId: string;
  fundVout?: number;
  localFundPubkey: string;
  remoteFundPubkey: string;
  fundInputAmount: bigint | number;
}

export interface GetRawRefundTxSignatureResponse {
  hex: string;
}

export interface Messages {
  messages: string[];
}

export interface PayoutRequest {
  local: bigint | number;
  remote: bigint | number;
}

/** Sign a CET */
export interface SignCetRequest {
  cetHex: string;
  fundPrivkey: string;
  fundTxId: string;
  fundVout?: number;
  localFundPubkey: string;
  remoteFundPubkey: string;
  fundInputAmount: bigint | number;
  adaptorSignature: string;
  oracleSignatures: string[];
}

export interface SignCetResponse {
  hex: string;
}

/** Sign a fund transaction input */
export interface SignFundTransactionRequest {
  fundTxHex: string;
  privkey: string;
  prevTxId: string;
  prevVout: number;
  amount: bigint | number;
}

export interface SignFundTransactionResponse {
  hex: string;
}

export interface TxInInfoRequest {
  txid: string;
  vout: number;
  redeemScript?: string;
  maxWitnessLength: number;
  inputSerialId?: bigint | number;
}

/** Verify a signature for a CET */
export interface VerifyCetAdaptorSignatureRequest {
  cetHex: string;
  adaptorSignature: string;
  adaptorProof: string;
  messages: string[];
  localFundPubkey: string;
  remoteFundPubkey: string;
  oraclePubkey: string;
  oracleRValues: string[];
  fundTxId: string;
  fundVout?: number;
  fundInputAmount: bigint | number;
  verifyRemote: boolean;
}

export interface VerifyCetAdaptorSignatureResponse {
  valid: boolean;
}

/** Verify a set of signatures for a set of CET */
export interface VerifyCetAdaptorSignaturesRequest {
  cetsHex: string[];
  adaptorPairs: AdaptorPair[];
  messagesList: Messages[];
  localFundPubkey: string;
  remoteFundPubkey: string;
  oraclePubkey: string;
  oracleRValues: string[];
  fundTxId: string;
  fundVout?: number;
  fundInputAmount: bigint | number;
  verifyRemote: boolean;
}

export interface VerifyCetAdaptorSignaturesResponse {
  valid: boolean;
}

/** Verify a signature for a mutual closing transaction */
export interface VerifyFundTxSignatureRequest {
  fundTxHex: string;
  signature: string;
  pubkey: string;
  prevTxId: string;
  prevVout: number;
  fundInputAmount: bigint | number;
}

export interface VerifyFundTxSignatureResponse {
  valid: boolean;
}

/** Verify a signature for a refund transaction */
export interface VerifyRefundTxSignatureRequest {
  refundTxHex: string;
  signature: string;
  localFundPubkey: string;
  remoteFundPubkey: string;
  fundTxId: string;
  fundVout?: number;
  fundInputAmount: bigint | number;
  verifyRemote: boolean;
}

export interface VerifyRefundTxSignatureResponse {
  valid: boolean;
}
