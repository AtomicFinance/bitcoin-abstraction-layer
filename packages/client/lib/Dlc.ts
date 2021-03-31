import Client from './Client';
import {
  AddSignaturesToRefundTxRequest,
  AddSignaturesToRefundTxResponse,
  AddSignatureToFundTransactionRequest,
  AddSignatureToFundTransactionResponse,
  CreateCetAdaptorSignatureRequest,
  CreateCetAdaptorSignatureResponse,
  CreateCetAdaptorSignaturesRequest,
  CreateCetAdaptorSignaturesResponse,
  CreateCetRequest,
  CreateCetResponse,
  CreateDlcTransactionsRequest,
  CreateDlcTransactionsResponse,
  CreateFundTransactionRequest,
  CreateFundTransactionResponse,
  CreateRefundTransactionRequest,
  CreateRefundTransactionResponse,
  GetRawFundTxSignatureRequest,
  GetRawFundTxSignatureResponse,
  GetRawRefundTxSignatureRequest,
  GetRawRefundTxSignatureResponse,
  SignCetRequest,
  SignCetResponse,
  SignFundTransactionRequest,
  SignFundTransactionResponse,
  VerifyCetAdaptorSignatureRequest,
  VerifyCetAdaptorSignatureResponse,
  VerifyCetAdaptorSignaturesRequest,
  VerifyCetAdaptorSignaturesResponse,
  VerifyFundTxSignatureRequest,
  VerifyFundTxSignatureResponse,
  VerifyRefundTxSignatureRequest,
  VerifyRefundTxSignatureResponse,
  Messages,
} from './@types/cfd-dlc-js';
import {
  ContractInfo,
  FundingInput,
  DlcOffer,
  FundingInputV0,
  MessageType,
  DlcAccept,
  DlcOfferV0,
  DlcAcceptV0,
  DlcSign,
  DlcTransactions,
  DlcTransactionsV0,
  DlcSignV0,
  ContractInfoV0,
  ContractInfoV1,
  ContractDescriptorV0,
  ContractDescriptorV1,
  PayoutFunctionV0,
  HyperbolaPayoutCurvePiece,
  OracleEventV0,
  DigitDecompositionEventDescriptorV0,
  CetAdaptorSignaturesV0,
  NegotiationFieldsV0,
  ScriptWitnessV0,
  FundingSignaturesV0,
  OracleAttestationV0,
} from '@node-dlc/messaging';
import {
  Amount,
  Input,
  InputDetails,
  Output,
  OracleInfo,
  OfferMessage,
  AcceptMessage,
  SignMessage,
  Contract,
  PayoutDetails,
  MutualClosingMessage,
} from './@types/@atomicfinance/bitcoin-dlc-provider';

export default class Dlc {
  client: Client;

  constructor(client?: Client) {
    this.client = client;
  }

  async initializeContractAndOffer(
    contractInfo: ContractInfo,
    offerCollateralSatoshis: bigint,
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktime: number,
    fixedInputs?: Input[],
  ): Promise<OfferMessage> {
    return this.client.getMethod('initializeContractAndOffer')(
      contractInfo,
      offerCollateralSatoshis,
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      fixedInputs,
    );
  }

  async confirmContractOffer(
    dlcOffer: DlcOffer,
    fixedInputs?: Input[],
  ): Promise<ConfirmContractOfferResponse> {
    return this.client.getMethod('confirmContractOffer')(dlcOffer, fixedInputs);
  }

  async signContract(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
  ): Promise<SignContractResponse> {
    return this.client.getMethod('signContract')(dlcOffer, dlcAccept);
  }

  async finalizeContract(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTransactions: DlcTransactions,
  ): Promise<string> {
    return this.client.getMethod('finalizeContract')(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
  }

  async execute(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTransactions: DlcTransactions,
    oracleAttestation: OracleAttestationV0,
    isLocalParty: boolean,
  ) {
    return this.client.getMethod('execute')(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      isLocalParty,
    );
  }

  async refund(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTransactions: DlcTransactions,
  ) {
    return this.client.getMethod('refund')(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
  }

  async initiateEarlyExit(contractId: string, outputs: Output[]) {
    return this.client.getMethod('initiateEarlyExit')(contractId, outputs);
  }

  async finalizeEarlyExit(
    contractId: string,
    mutualClosingMessage: MutualClosingMessage,
  ) {
    return this.client.getMethod('finalizeEarlyExit')(
      contractId,
      mutualClosingMessage,
    );
  }

  async unilateralClose(
    outcomeIndex: number,
    oracleSignatures: string[],
    contractId: string,
  ): Promise<string[]> {
    return this.client.getMethod('unilateralClose')(
      outcomeIndex,
      oracleSignatures,
      contractId,
    );
  }

  async buildUnilateralClose(
    oracleSignature: string,
    outcomeIndex: number,
    contractId: string,
  ): Promise<string[]> {
    return this.client.getMethod('buildUnilateralClose')(
      oracleSignature,
      outcomeIndex,
      contractId,
    );
  }

  async getFundingUtxoAddressesForOfferMessages(offerMessages: OfferMessage[]) {
    return this.client.getMethod('getFundingUtxoAddressesForOfferMessages')(
      offerMessages,
    );
  }

  async getFundingUtxoAddressesForAcceptMessages(
    acceptMessages: AcceptMessage[],
  ) {
    return this.client.getMethod('getFundingUtxoAddressesForAcceptMessages')(
      acceptMessages,
    );
  }

  hasDlc(contractId: string): boolean {
    return this.client.getMethod('hasDlc')(contractId);
  }

  async importContract(contract: Contract, startingIndex: number) {
    return this.client.getMethod('importContract')(contract, startingIndex);
  }

  exportContract(contractId: string): Contract {
    return this.client.getMethod('exportContract')(contractId);
  }

  exportContracts(): Contract[] {
    return this.client.getMethod('exportContracts')();
  }

  deleteContract(contractId: string) {
    return this.client.getMethod('deleteContract')(contractId);
  }

  async importContractFromOfferMessage(
    offerMessage: OfferMessage,
    startingIndex: number,
  ) {
    return this.client.getMethod('importContractFromOfferMessage')(
      offerMessage,
      startingIndex,
    );
  }

  async importContractFromAcceptMessage(
    offerMessage: OfferMessage,
    acceptMessage: AcceptMessage,
    startingIndex: number,
  ) {
    return this.client.getMethod('importContractFromAcceptMessage')(
      offerMessage,
      acceptMessage,
      startingIndex,
    );
  }

  async importContractFromAcceptAndSignMessage(
    offerMessage: OfferMessage,
    acceptMessage: AcceptMessage,
    signMessage: SignMessage,
    startingIndex: number,
  ) {
    return this.client.getMethod('importContractFromAcceptAndSignMessage')(
      offerMessage,
      acceptMessage,
      signMessage,
      startingIndex,
    );
  }

  async importContractFromSignMessageAndCreateFinal(
    offerMessage: OfferMessage,
    acceptMessage: AcceptMessage,
    signMessage: SignMessage,
    startingIndex = 0,
  ) {
    return this.client.getMethod('importContractFromSignMessageAndCreateFinal')(
      offerMessage,
      acceptMessage,
      signMessage,
      startingIndex,
    );
  }

  outputsToPayouts(
    outputs: GeneratedOutput[],
    oracleInfos: OracleInfo[],
    rValuesMessagesList: Messages[],
    localCollateral: Amount,
    remoteCollateral: Amount,
    payoutLocal: boolean,
  ): { payouts: PayoutDetails[]; messagesList: Messages[] } {
    return this.client.getMethod('outputsToPayouts')(
      outputs,
      oracleInfos,
      rValuesMessagesList,
      localCollateral,
      remoteCollateral,
      payoutLocal,
    );
  }

  async AddSignatureToFundTransaction(
    jsonObject: AddSignatureToFundTransactionRequest,
  ): Promise<AddSignatureToFundTransactionResponse> {
    return this.client.getMethod('AddSignatureToFundTransaction')(jsonObject);
  }

  async CreateCetAdaptorSignature(
    jsonObject: CreateCetAdaptorSignatureRequest,
  ): Promise<CreateCetAdaptorSignatureResponse> {
    return this.client.getMethod('CreateCetAdaptorSignature')(jsonObject);
  }

  async CreateCetAdaptorSignatures(
    jsonObject: CreateCetAdaptorSignaturesRequest,
  ): Promise<CreateCetAdaptorSignaturesResponse> {
    return this.client.getMethod('CreateCetAdaptorSignatures')(jsonObject);
  }

  async AddSignaturesToRefundTx(
    jsonObject: AddSignaturesToRefundTxRequest,
  ): Promise<AddSignaturesToRefundTxResponse> {
    return this.client.getMethod('AddSignaturesToRefundTx')(jsonObject);
  }

  async CreateCet(jsonObject: CreateCetRequest): Promise<CreateCetResponse> {
    return this.client.getMethod('CreateCet')(jsonObject);
  }

  async CreateDlcTransactions(
    jsonObject: CreateDlcTransactionsRequest,
  ): Promise<CreateDlcTransactionsResponse> {
    return this.client.getMethod('CreateDlcTransactions')(jsonObject);
  }

  async CreateFundTransaction(
    jsonObject: CreateFundTransactionRequest,
  ): Promise<CreateFundTransactionResponse> {
    return this.client.getMethod('CreateFundTransaction')(jsonObject);
  }

  async CreateRefundTransaction(
    jsonObject: CreateRefundTransactionRequest,
  ): Promise<CreateRefundTransactionResponse> {
    return this.client.getMethod('CreateRefundTransaction')(jsonObject);
  }

  async GetRawFundTxSignature(
    jsonObject: GetRawFundTxSignatureRequest,
  ): Promise<GetRawFundTxSignatureResponse> {
    return this.client.getMethod('GetRawFundTxSignature')(jsonObject);
  }

  async GetRawRefundTxSignature(
    jsonObject: GetRawRefundTxSignatureRequest,
  ): Promise<GetRawRefundTxSignatureResponse> {
    return this.client.getMethod('GetRawRefundTxSignature')(jsonObject);
  }

  async SignCetRequest(jsonObject: SignCetRequest): Promise<SignCetResponse> {
    return this.client.getMethod('SignCetRequest')(jsonObject);
  }

  async SignFundTransaction(
    jsonObject: SignFundTransactionRequest,
  ): Promise<SignFundTransactionResponse> {
    return this.client.getMethod('SignFundTransaction')(jsonObject);
  }

  async VerifyCetAdaptorSignature(
    jsonObject: VerifyCetAdaptorSignatureRequest,
  ): Promise<VerifyCetAdaptorSignatureResponse> {
    return this.client.getMethod('VerifyCetAdaptorSignature')(jsonObject);
  }

  async VerifyCetAdaptorSignaturesRequest(
    jsonObject: VerifyCetAdaptorSignaturesRequest,
  ): Promise<VerifyCetAdaptorSignaturesResponse> {
    return this.client.getMethod('VerifyCetAdaptorSignatures')(jsonObject);
  }

  async VerifyFundTxSignature(
    jsonObject: VerifyFundTxSignatureRequest,
  ): Promise<VerifyFundTxSignatureResponse> {
    return this.client.getMethod('VerifyFundTxSignature')(jsonObject);
  }

  async VerifyRefundTxSignature(
    jsonObject: VerifyRefundTxSignatureRequest,
  ): Promise<VerifyRefundTxSignatureResponse> {
    return this.client.getMethod('VerifyRefundTxSignature')(jsonObject);
  }
}

interface GeneratedOutput {
  payout: number;
  groups: number[][];
}

export interface ConfirmContractOfferResponse {
  dlcAccept: DlcAccept;
  dlcTransactions: DlcTransactions;
}

export interface SignContractResponse {
  dlcSign: DlcSign;
  dlcTransactions: DlcTransactions;
}
