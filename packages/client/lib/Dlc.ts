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
  Messages
} from './@types/cfd-dlc-js';

import {
  Amount,
  Input,
  InputDetails,
  OutcomeDetails,
  OracleInfo,
  OfferMessage,
  AcceptMessage,
  SignMessage,
  Contract,
  PayoutDetails
} from './@types/@atomicfinance/bitcoin-dlc-provider';

export default class Dlc {
  client: Client;

  constructor(client?: Client) {
    this.client = client;
  }

  async initializeContractAndOffer(
    input: InputDetails,
    payouts: PayoutDetails[],
    oracleInfo: OracleInfo,
    messagesList: Messages[],
    startingIndex: number = 0,
    fixedInputs: Input[] = []
  ): Promise<OfferMessage> {
    return this.client.getMethod('initializeContractAndOffer')(
      input,
      payouts,
      oracleInfo,
      messagesList,
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

  async refund(contractId: string) {
    return this.client.getMethod('refund')(contractId);
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

  async getFundingUtxoAddressesForOfferMessages (offerMessages: OfferMessage[]) {
    return this.client.getMethod('getFundingUtxoAddressesForOfferMessages')(offerMessages)
  }

  async getFundingUtxoAddressesForAcceptMessages (acceptMessages: AcceptMessage[]) {
    return this.client.getMethod('getFundingUtxoAddressesForAcceptMessages')(acceptMessages)
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

  deleteContract (contractId: string) {
    return this.client.getMethod('deleteContract')(contractId)
  }

  async importContractFromOfferMessage (offerMessage: OfferMessage, startingIndex: number) {
    return this.client.getMethod('importContractFromOfferMessage')(offerMessage, startingIndex)
  }

  async importContractFromAcceptMessage (offerMessage: OfferMessage, acceptMessage: AcceptMessage, startingIndex: number) {
    return this.client.getMethod('importContractFromAcceptMessage')(offerMessage, acceptMessage, startingIndex)
  }

  async importContractFromAcceptAndSignMessage (offerMessage: OfferMessage, acceptMessage: AcceptMessage, signMessage: SignMessage, startingIndex: number) {
    return this.client.getMethod('importContractFromAcceptAndSignMessage')(offerMessage, acceptMessage, signMessage, startingIndex)
  }

  async importContractFromSignMessageAndCreateFinal (offerMessage: OfferMessage, acceptMessage: AcceptMessage, signMessage: SignMessage, startingIndex: number = 0) {
    return this.client.getMethod('importContractFromSignMessageAndCreateFinal')(offerMessage, acceptMessage, signMessage, startingIndex)
  }

  outputsToPayouts(outputs: Output[], oracleInfos: OracleInfo[], rValuesMessagesList: Messages[], localCollateral: Amount, remoteCollateral: Amount, payoutLocal: boolean): { payouts: PayoutDetails[], messagesList: Messages[] } {
    return this.client.getMethod('outputsToPayouts')(outputs, oracleInfos, rValuesMessagesList, localCollateral, remoteCollateral, payoutLocal)
  }

  async AddSignatureToFundTransaction(
    jsonObject: AddSignatureToFundTransactionRequest
  ): Promise<AddSignatureToFundTransactionResponse> {
    return this.client.getMethod('AddSignatureToFundTransaction')(jsonObject);
  }

  async CreateCetAdaptorSignature(
    jsonObject: CreateCetAdaptorSignatureRequest
  ): Promise<CreateCetAdaptorSignatureResponse> {
    return this.client.getMethod('CreateCetAdaptorSignature')(jsonObject)
  }

  async CreateCetAdaptorSignatures(
    jsonObject: CreateCetAdaptorSignaturesRequest
  ): Promise<CreateCetAdaptorSignaturesResponse> {
    return this.client.getMethod('CreateCetAdaptorSignatures')(jsonObject)
  }

  async AddSignaturesToRefundTx(
    jsonObject: AddSignaturesToRefundTxRequest
  ): Promise<AddSignaturesToRefundTxResponse> {
    return this.client.getMethod('AddSignaturesToRefundTx')(jsonObject);
  }

  async CreateCet(jsonObject: CreateCetRequest): Promise<CreateCetResponse> {
    return this.client.getMethod('CreateCet')(jsonObject);
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

  async CreateRefundTransaction(
    jsonObject: CreateRefundTransactionRequest
  ): Promise<CreateRefundTransactionResponse> {
    return this.client.getMethod('CreateRefundTransaction')(jsonObject);
  }

  async GetRawFundTxSignature(
    jsonObject: GetRawFundTxSignatureRequest
  ): Promise<GetRawFundTxSignatureResponse> {
    return this.client.getMethod('GetRawFundTxSignature')(jsonObject);
  }

  async GetRawRefundTxSignature(
    jsonObject: GetRawRefundTxSignatureRequest
  ): Promise<GetRawRefundTxSignatureResponse> {
    return this.client.getMethod('GetRawRefundTxSignature')(jsonObject);
  }

  async SignCetRequest(
    jsonObject: SignCetRequest
  ): Promise<SignCetResponse> {
    return this.client.getMethod('SignCetRequest')(jsonObject)
  }

  async SignFundTransaction(
    jsonObject: SignFundTransactionRequest
  ): Promise<SignFundTransactionResponse> {
    return this.client.getMethod('SignFundTransaction')(jsonObject);
  }

  async VerifyCetAdaptorSignature(
    jsonObject: VerifyCetAdaptorSignatureRequest
  ): Promise<VerifyCetAdaptorSignatureResponse> {
    return this.client.getMethod('VerifyCetAdaptorSignature')(jsonObject)
  }

  async VerifyCetAdaptorSignaturesRequest(
    jsonObject: VerifyCetAdaptorSignaturesRequest
  ): Promise<VerifyCetAdaptorSignaturesResponse> {
    return this.client.getMethod('VerifyCetAdaptorSignatures')(jsonObject)
  }

  async VerifyFundTxSignature(
    jsonObject: VerifyFundTxSignatureRequest
  ): Promise<VerifyFundTxSignatureResponse> {
    return this.client.getMethod('VerifyFundTxSignature')(jsonObject);
  }

  async VerifyRefundTxSignature(
    jsonObject: VerifyRefundTxSignatureRequest
  ): Promise<VerifyRefundTxSignatureResponse> {
    return this.client.getMethod('VerifyRefundTxSignature')(jsonObject);
  }
}

interface Output {
  payout: number,
  groups: number[][]
}