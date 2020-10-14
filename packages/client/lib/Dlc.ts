import Client from './Client';
import {
  AddSignatureToFundTransactionRequest,
  AddSignatureToFundTransactionResponse,
  AddSignaturesToCetRequest,
  AddSignaturesToCetResponse,
  AddSignaturesToMutualClosingTxRequest,
  AddSignaturesToMutualClosingTxResponse,
  AddSignaturesToRefundTxRequest,
  AddSignaturesToRefundTxResponse,
  CreateCetRequest,
  CreateCetResponse,
  CreateClosingTransactionRequest,
  CreateClosingTransactionResponse,
  CreateDlcTransactionsRequest,
  CreateDlcTransactionsResponse,
  CreateFundTransactionRequest,
  CreateFundTransactionResponse,
  CreateMutualClosingTransactionRequest,
  CreateMutualClosingTransactionResponse,
  CreatePenaltyTransactionRequest,
  CreatePenaltyTransactionResponse,
  CreateRefundTransactionRequest,
  CreateRefundTransactionResponse,
  GetRawCetSignatureRequest,
  GetRawCetSignatureResponse,
  GetRawCetSignaturesRequest,
  GetRawCetSignaturesResponse,
  GetRawFundTxSignatureRequest,
  GetRawFundTxSignatureResponse,
  GetRawMutualClosingTxSignatureRequest,
  GetRawMutualClosingTxSignatureResponse,
  GetRawRefundTxSignatureRequest,
  GetRawRefundTxSignatureResponse,
  GetSchnorrPublicNonceRequest,
  GetSchnorrPublicNonceResponse,
  SchnorrSignRequest,
  SchnorrSignResponse,
  SignClosingTransactionRequest,
  SignClosingTransactionResponse,
  SignFundTransactionRequest,
  SignFundTransactionResponse,
  VerifyCetSignatureRequest,
  VerifyCetSignatureResponse,
  VerifyCetSignaturesRequest,
  VerifyCetSignaturesResponse,
  VerifyFundTxSignatureRequest,
  VerifyFundTxSignatureResponse,
  VerifyMutualClosingTxSignatureRequest,
  VerifyMutualClosingTxSignatureResponse,
  VerifyRefundTxSignatureRequest,
  VerifyRefundTxSignatureResponse,
} from 'cfd-dlc-js-wasm';

import {
  Input,
  InputDetails,
  OutcomeDetails,
  OracleInfo,
  OfferMessage,
  AcceptMessage,
  SignMessage,
  Contract,
} from '@atomicfinance/bitcoin-dlc-provider';

export default class Dlc {
  client: Client;

  constructor(client?: Client) {
    this.client = client;
  }

  async initializeContractAndOffer(
    input: InputDetails,
    outcomes: Array<OutcomeDetails>,
    oracleInfo: OracleInfo,
    startingIndex: number = 0,
    fixedInputs: Input[] = []
  ): Promise<OfferMessage> {
    return this.client.getMethod('initializeContractAndOffer')(
      input,
      outcomes,
      oracleInfo,
      startingIndex,
      fixedInputs
    );
  }

  async confirmContractOffer(
    offerMessage: OfferMessage,
    startingIndex: number = 0,
    fixedInputs: Input[] = []
  ): Promise<AcceptMessage> {
    return this.client.getMethod('confirmContractOffer')(
      offerMessage,
      startingIndex,
      fixedInputs
    );
  }

  async signContract(acceptMessage: AcceptMessage): Promise<SignMessage> {
    return this.client.getMethod('signContract')(acceptMessage);
  }

  async finalizeContract(signMessage: SignMessage): Promise<string> {
    return this.client.getMethod('finalizeContract')(signMessage);
  }

  async unilateralClose(
    oracleSignature: string,
    outcomeIndex: number,
    contractId: string
  ): Promise<string[]> {
    return this.client.getMethod('unilateralClose')(
      oracleSignature,
      outcomeIndex,
      contractId
    );
  }

  async buildUnilateralClose(
    oracleSignature: string,
    outcomeIndex: number,
    contractId: string
  ): Promise<string[]> {
    return this.client.getMethod('buildUnilateralClose')(
      oracleSignature,
      outcomeIndex,
      contractId
    );
  }

  hasDlc(contractId: string): boolean {
    return this.client.getMethod('hasDlc')(contractId);
  }

  async importContract(contract: Contract) {
    return this.client.getMethod('importContract')(contract);
  }

  exportContract(contractId: string): Contract {
    return this.client.getMethod('exportContract')(contractId);
  }

  exportContracts(): Contract[] {
    return this.client.getMethod('exportContracts')();
  }

  deleteContract (contractId: string) {
    return this.client.getMethod('deleteContract')(contractId)
  }

  async importContractFromOfferMessage (offerMessage: OfferMessage) {
    return this.client.getMethod('importContractFromOfferMessage')(offerMessage)
  }

  async importContractFromAcceptMessage (offerMessage: OfferMessage, acceptMessage: AcceptMessage) {
    return this.client.getMethod('importContractFromAcceptMessage')(offerMessage, acceptMessage)
  }

  async importContractFromSignMessage (offerMessage: OfferMessage, signMessage: SignMessage) {
    return this.client.getMethod('importContractFromSignMessage')(offerMessage, signMessage)
  }

  async AddSignatureToFundTransaction(
    jsonObject: AddSignatureToFundTransactionRequest
  ): Promise<AddSignatureToFundTransactionResponse> {
    return this.client.getMethod('AddSignatureToFundTransaction')(jsonObject);
  }

  async AddSignaturesToCet(
    jsonObject: AddSignaturesToCetRequest
  ): Promise<AddSignaturesToCetResponse> {
    return this.client.getMethod('AddSignaturesToCet')(jsonObject);
  }

  async AddSignaturesToMutualClosingTx(
    jsonObject: AddSignaturesToMutualClosingTxRequest
  ): Promise<AddSignaturesToMutualClosingTxResponse> {
    return this.client.getMethod('AddSignaturesToMutualClosingTx')(jsonObject);
  }

  async AddSignaturesToRefundTx(
    jsonObject: AddSignaturesToRefundTxRequest
  ): Promise<AddSignaturesToRefundTxResponse> {
    return this.client.getMethod('AddSignaturesToRefundTx')(jsonObject);
  }

  async CreateCet(jsonObject: CreateCetRequest): Promise<CreateCetResponse> {
    return this.client.getMethod('CreateCet')(jsonObject);
  }

  async CreateClosingTransaction(
    jsonObject: CreateClosingTransactionRequest
  ): Promise<CreateClosingTransactionResponse> {
    return this.client.getMethod('CreateClosingTransaction')(jsonObject);
  }

  async CreateDlcTransactions(
    jsonObject: CreateDlcTransactionsRequest
  ): Promise<CreateDlcTransactionsResponse> {
    return this.client.getMethod('CreateDlcTransactions')(jsonObject);
  }

  async CreateFundTransaction(
    jsonObject: CreateFundTransactionRequest
  ): Promise<CreateFundTransactionResponse> {
    return this.client.getMethod('CreateFundTransaction')(jsonObject);
  }

  async CreateMutualClosingTransaction(
    jsonObject: CreateMutualClosingTransactionRequest
  ): Promise<CreateMutualClosingTransactionResponse> {
    return this.client.getMethod('CreateMutualClosingTransaction')(jsonObject);
  }

  async CreatePenaltyTransaction(
    jsonObject: CreatePenaltyTransactionRequest
  ): Promise<CreatePenaltyTransactionResponse> {
    return this.client.getMethod('CreatePenaltyTransaction')(jsonObject);
  }

  async CreateRefundTransaction(
    jsonObject: CreateRefundTransactionRequest
  ): Promise<CreateRefundTransactionResponse> {
    return this.client.getMethod('CreateRefundTransaction')(jsonObject);
  }

  async GetRawCetSignature(
    jsonObject: GetRawCetSignatureRequest
  ): Promise<GetRawCetSignatureResponse> {
    return this.client.getMethod('GetRawCetSignature')(jsonObject);
  }

  async GetRawCetSignatures(
    jsonObject: GetRawCetSignaturesRequest
  ): Promise<GetRawCetSignaturesResponse> {
    return this.client.getMethod('GetRawCetSignatures')(jsonObject);
  }

  async GetRawFundTxSignature(
    jsonObject: GetRawFundTxSignatureRequest
  ): Promise<GetRawFundTxSignatureResponse> {
    return this.client.getMethod('GetRawFundTxSignature')(jsonObject);
  }

  async GetRawMutualClosingTxSignature(
    jsonObject: GetRawMutualClosingTxSignatureRequest
  ): Promise<GetRawMutualClosingTxSignatureResponse> {
    return this.client.getMethod('GetRawMutualClosingTxSignature')(jsonObject);
  }

  async GetRawRefundTxSignature(
    jsonObject: GetRawRefundTxSignatureRequest
  ): Promise<GetRawRefundTxSignatureResponse> {
    return this.client.getMethod('GetRawRefundTxSignature')(jsonObject);
  }

  async GetSchnorrPublicNonce(
    jsonObject: GetSchnorrPublicNonceRequest
  ): Promise<GetSchnorrPublicNonceResponse> {
    return this.client.getMethod('GetSchnorrPublicNonce')(jsonObject);
  }

  async SchnorrSign(
    jsonObject: SchnorrSignRequest
  ): Promise<SchnorrSignResponse> {
    return this.client.getMethod('SchnorrSign')(jsonObject);
  }

  async SignClosingTransaction(
    jsonObject: SignClosingTransactionRequest
  ): Promise<SignClosingTransactionResponse> {
    return this.client.getMethod('SignClosingTransaction')(jsonObject);
  }

  async SignFundTransaction(
    jsonObject: SignFundTransactionRequest
  ): Promise<SignFundTransactionResponse> {
    return this.client.getMethod('SignFundTransaction')(jsonObject);
  }

  async VerifyCetSignature(
    jsonObject: VerifyCetSignatureRequest
  ): Promise<VerifyCetSignatureResponse> {
    return this.client.getMethod('VerifyCetSignature')(jsonObject);
  }

  async VerifyCetSignatures(
    jsonObject: VerifyCetSignaturesRequest
  ): Promise<VerifyCetSignaturesResponse> {
    return this.client.getMethod('VerifyCetSignatures')(jsonObject);
  }

  async VerifyFundTxSignature(
    jsonObject: VerifyFundTxSignatureRequest
  ): Promise<VerifyFundTxSignatureResponse> {
    return this.client.getMethod('VerifyFundTxSignature')(jsonObject);
  }

  async VerifyMutualClosingTxSignature(
    jsonObject: VerifyMutualClosingTxSignatureRequest
  ): Promise<VerifyMutualClosingTxSignatureResponse> {
    return this.client.getMethod('VerifyMutualClosingTxSignature')(jsonObject);
  }

  async VerifyRefundTxSignature(
    jsonObject: VerifyRefundTxSignatureRequest
  ): Promise<VerifyRefundTxSignatureResponse> {
    return this.client.getMethod('VerifyRefundTxSignature')(jsonObject);
  }
}
