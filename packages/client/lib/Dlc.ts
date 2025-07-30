import {
  AddSignaturesToRefundTxRequest,
  AddSignaturesToRefundTxResponse,
  AddSignatureToFundTransactionRequest,
  AddSignatureToFundTransactionResponse,
  BatchAcceptDlcOfferResponse,
  BatchSignDlcAcceptResponse,
  CreateCetAdaptorSignatureRequest,
  CreateCetAdaptorSignatureResponse,
  CreateCetAdaptorSignaturesRequest,
  CreateCetAdaptorSignaturesResponse,
  CreateCetRequest,
  CreateCetResponse,
  CreateDlcTransactionsRequest,
  CreateDlcTransactionsResponse,
  CreateDlcTxsResponse,
  CreateFundTransactionRequest,
  CreateFundTransactionResponse,
  CreateRefundTransactionRequest,
  CreateRefundTransactionResponse,
  CreateSplicedDlcTransactionsRequest,
  CreateSplicedDlcTransactionsResponse,
  DlcInputInfoRequest,
  DlcProvider,
  GetRawDlcFundingInputSignatureRequest,
  GetRawDlcFundingInputSignatureResponse,
  GetRawFundTxSignatureRequest,
  GetRawFundTxSignatureResponse,
  GetRawRefundTxSignatureRequest,
  GetRawRefundTxSignatureResponse,
  Input,
  InputSupplementationMode,
  SignCetRequest,
  SignCetResponse,
  SignDlcFundingInputRequest,
  SignDlcFundingInputResponse,
  SignFundTransactionRequest,
  SignFundTransactionResponse,
  VerifyCetAdaptorSignatureRequest,
  VerifyCetAdaptorSignatureResponse,
  VerifyCetAdaptorSignaturesRequest,
  VerifyCetAdaptorSignaturesResponse,
  VerifyDlcFundingInputSignatureRequest,
  VerifyDlcFundingInputSignatureResponse,
  VerifyFundTxSignatureRequest,
  VerifyFundTxSignatureResponse,
  VerifyRefundTxSignatureRequest,
  VerifyRefundTxSignatureResponse,
} from '@atomicfinance/types';
import { Tx } from '@node-dlc/bitcoin';
import {
  ContractInfo,
  DlcAccept,
  DlcClose,
  DlcCloseMetadata,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  FundingInput,
  OracleAttestation,
} from '@node-dlc/messaging';

export default class Dlc implements DlcProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any) {
    this.client = client;
  }

  /**
   * Check whether wallet is offerer of DlcOffer or DlcAccept
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @returns {Promise<boolean>}
   */
  async isOfferer(dlcOffer: DlcOffer, dlcAccept: DlcAccept): Promise<boolean> {
    return this.client.getMethod('isOfferer')(dlcOffer, dlcAccept);
  }

  /**
   * Create DlcTxs object from DlcOffer and DlcAccept
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @returns {Promise<CreateDlcTxsResponse>}
   */
  async createDlcTxs(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
  ): Promise<CreateDlcTxsResponse> {
    return this.client.getMethod('createDlcTxs')(dlcOffer, dlcAccept);
  }

  /**
   * Create DLC Offer Message
   * @param contractInfo ContractInfo TLV (V0 or V1)
   * @param offerCollateralSatoshis Amount DLC Initiator is putting into the contract
   * @param feeRatePerVb Fee rate in satoshi per virtual byte that both sides use to compute fees in funding tx
   * @param cetLocktime The nLockTime to be put on CETs
   * @param refundLocktime The nLockTime to be put on the refund transaction
   * @returns {Promise<DlcOffer>}
   */
  async createDlcOffer(
    contractInfo: ContractInfo,
    offerCollateralSatoshis: bigint,
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktime: number,
    fixedInputs?: IInput[],
    inputSupplementationMode?: InputSupplementationMode,
  ): Promise<DlcOffer> {
    return this.client.getMethod('createDlcOffer')(
      contractInfo,
      offerCollateralSatoshis,
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      fixedInputs,
      inputSupplementationMode,
    );
  }

  async batchCreateDlcOffer(
    contractInfos: ContractInfo[],
    offerCollaterals: bigint[],
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktimes: number[],
    fixedInputs?: IInput[],
  ): Promise<DlcOffer[]> {
    return this.client.getMethod('batchCreateDlcOffer')(
      contractInfos,
      offerCollaterals,
      feeRatePerVb,
      cetLocktime,
      refundLocktimes,
      fixedInputs,
    );
  }

  /**
   * Accept DLC Offer
   * @param dlcOffer Dlc Offer Message
   * @param fixedInputs Optional inputs to use for Funding Inputs
   * @returns {Promise<AcceptDlcOfferResponse}
   */
  async acceptDlcOffer(
    dlcOffer: DlcOffer,
    fixedInputs?: IInput[],
  ): Promise<AcceptDlcOfferResponse> {
    return this.client.getMethod('acceptDlcOffer')(dlcOffer, fixedInputs);
  }

  /**
   * Accept DLC Offer
   * @param dlcOffers Dlc Offer Messages
   * @param fixedInputs Optional inputs to use for Funding Inputs
   * @returns {Promise<BatchAcceptDlcOfferResponse}
   */
  async batchAcceptDlcOffer(
    dlcOffers: DlcOffer[],
    fixedInputs?: IInput[],
  ): Promise<BatchAcceptDlcOfferResponse> {
    return this.client.getMethod('batchAcceptDlcOffer')(dlcOffers, fixedInputs);
  }

  /**
   * Sign Dlc Accept Message
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @returns {Promise<SignDlcAcceptResponse}
   */
  async signDlcAccept(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
  ): Promise<SignDlcAcceptResponse> {
    return this.client.getMethod('signDlcAccept')(dlcOffer, dlcAccept);
  }

  /**
   * Batch Sign Dlc Accept Messages
   * @param dlcOffers Dlc Offer Messages
   * @param dlcAccepts Dlc Accept Messages
   * @returns {Promise<BatchSignDlcAcceptResponse}
   */
  async batchSignDlcAccept(
    dlcOffers: DlcOffer[],
    dlcAccepts: DlcAccept[],
  ): Promise<BatchSignDlcAcceptResponse> {
    return this.client.getMethod('batchSignDlcAccept')(dlcOffers, dlcAccepts);
  }

  /**
   * Finalize Dlc Sign
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @param dlcSign Dlc Sign Message
   * @param dlcTxs Dlc Transactions Message
   * @returns {Promise<Tx>}
   */
  async finalizeDlcSign(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
  ): Promise<Tx> {
    return this.client.getMethod('finalizeDlcSign')(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
    );
  }

  async batchFinalizeDlcSign(
    dlcOffers: DlcOffer[],
    dlcAccepts: DlcAccept[],
    dlcSigns: DlcSign[],
    dlcTxsList: DlcTransactions[],
  ): Promise<Tx> {
    return this.client.getMethod('batchFinalizeDlcSign')(
      dlcOffers,
      dlcAccepts,
      dlcSigns,
      dlcTxsList,
    );
  }

  /**
   * Execute DLC
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @param dlcSign Dlc Sign Message
   * @param dlcTxs Dlc Transactions Message
   * @param oracleAttestation Oracle Attestations TLV (V0)
   * @param isOfferer Whether party is Dlc Offerer
   * @returns {Promise<Tx>}
   */
  async execute(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    oracleAttestation: OracleAttestation,
    isOfferer?: boolean,
  ): Promise<Tx> {
    return this.client.getMethod('execute')(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
      oracleAttestation,
      isOfferer,
    );
  }

  /**
   * Refund DLC
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @param dlcSign Dlc Sign Message
   * @param dlcTxs Dlc Transactions message
   * @returns {Promise<Tx>}
   */
  async refund(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
  ): Promise<Tx> {
    return this.client.getMethod('refund')(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
    );
  }

  /**
   * Generate DlcClose messagetype for closing DLC with Mutual Consent
   * @param dlcOffer DlcOffer TLV (V0)
   * @param dlcAccept DlcAccept TLV (V0)
   * @param dlcTxs DlcTransactions TLV (V0)
   * @param initiatorPayoutSatoshis Amount initiator expects as a payout
   * @param isOfferer Whether offerer or not
   * @param inputs Optionally specified closing inputs
   * @returns {Promise<DlcClose>}
   */
  async createDlcClose(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTxs: DlcTransactions,
    initiatorPayoutSatoshis: bigint,
    isOfferer?: boolean,
    inputs?: Input[],
  ): Promise<DlcClose> {
    return this.client.getMethod('createDlcClose')(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      initiatorPayoutSatoshis,
      isOfferer,
      inputs,
    );
  }

  /**
   * Generate multiple DlcClose messagetypes for closing DLC with Mutual Consent
   * @param dlcOffer DlcOffer TLV (V0)
   * @param dlcAccept DlcAccept TLV (V0)
   * @param dlcTxs DlcTransactions TLV (V0)
   * @param initiatorPayouts Array of amounts initiator expects as payouts
   * @param isOfferer Whether offerer or not
   * @param inputs Optionally specified closing inputs
   * @returns {Promise<DlcClose[]>}
   */
  async createBatchDlcClose(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTxs: DlcTransactions,
    initiatorPayouts: bigint[],
    isOfferer?: boolean,
    inputs?: Input[],
  ): Promise<DlcClose[]> {
    return this.client.getMethod('createBatchDlcClose')(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      initiatorPayouts,
      isOfferer,
      inputs,
    );
  }

  async verifyBatchDlcCloseUsingMetadata(
    dlcCloseMetadata: DlcCloseMetadata,
    _dlcCloses: DlcClose[],
    isOfferer?: boolean,
  ): Promise<void> {
    return this.client.getMethod('verifyBatchDlcCloseUsingMetadata')(
      dlcCloseMetadata,
      _dlcCloses,
      isOfferer,
    );
  }

  /**
   * Verify multiple DlcClose messagetypes for closing DLC with Mutual Consent
   * @param dlcOffer DlcOffer TLV (V0)
   * @param dlcAccept DlcAccept TLV (V0)
   * @param dlcTxs DlcTransactions TLV (V0)
   * @param dlcCloses DlcClose[] TLV (V0)
   * @param isOfferer Whether offerer or not
   * @returns {Promise<void>}
   */
  async verifyBatchDlcClose(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTxs: DlcTransactions,
    dlcCloses: DlcClose[],
    isOfferer?: boolean,
  ): Promise<void> {
    return this.client.getMethod('verifyBatchDlcClose')(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      dlcCloses,
      isOfferer,
    );
  }

  /**
   * Finalize Dlc Close
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @param dlcClose Dlc Close Message
   * @param dlcTxs Dlc Transactions Message
   * @returns {Promise<string>}
   */
  finalizeDlcClose(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcClose: DlcClose,
    dlcTxs: DlcTransactions,
  ): Promise<string> {
    return this.client.getMethod('finalizeDlcClose')(
      dlcOffer,
      dlcAccept,
      dlcClose,
      dlcTxs,
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

  async VerifyCetAdaptorSignatures(
    jsonObject: VerifyCetAdaptorSignaturesRequest,
  ): Promise<VerifyCetAdaptorSignaturesResponse> {
    return this.client.getMethod('VerifyCetAdaptorSignatures')(jsonObject);
  }

  async GetInputsForAmount(
    amounts: bigint[],
    feeRatePerVb: bigint,
    fixedInputs: Input[],
  ): Promise<Input[]> {
    return this.client.getMethod('GetInputsForAmount')(
      amounts,
      feeRatePerVb,
      fixedInputs,
    );
  }

  async SignCet(jsonObject: SignCetRequest): Promise<SignCetResponse> {
    return this.client.getMethod('SignCet')(jsonObject);
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

  async CreateSplicedDlcTransactions(
    jsonObject: CreateSplicedDlcTransactionsRequest,
  ): Promise<CreateSplicedDlcTransactionsResponse> {
    return this.client.getMethod('CreateSplicedDlcTransactions')(jsonObject);
  }

  async GetRawDlcFundingInputSignature(
    jsonObject: GetRawDlcFundingInputSignatureRequest,
  ): Promise<GetRawDlcFundingInputSignatureResponse> {
    return this.client.getMethod('GetRawDlcFundingInputSignature')(jsonObject);
  }

  async SignDlcFundingInput(
    jsonObject: SignDlcFundingInputRequest,
  ): Promise<SignDlcFundingInputResponse> {
    return this.client.getMethod('SignDlcFundingInput')(jsonObject);
  }

  async VerifyDlcFundingInputSignature(
    jsonObject: VerifyDlcFundingInputSignatureRequest,
  ): Promise<VerifyDlcFundingInputSignatureResponse> {
    return this.client.getMethod('VerifyDlcFundingInputSignature')(jsonObject);
  }

  async fundingInputToInput(_input: FundingInput): Promise<IInput> {
    return this.client.getMethod('fundingInputToInput')(_input);
  }

  async inputToFundingInput(input: IInput): Promise<FundingInput> {
    return this.client.getMethod('inputToFundingInput')(input);
  }

  /**
   * Create DLC input info for splice transactions
   * @param fundTxid The funding transaction ID
   * @param fundVout The funding output index
   * @param fundAmount The funding amount in satoshis
   * @param localFundPubkey Local funding public key
   * @param remoteFundPubkey Remote funding public key
   * @param maxWitnessLength Maximum witness length
   * @param inputSerialId Optional input serial ID
   * @returns {DlcInputInfoRequest} DLC input info
   */
  createDlcInputInfo(
    fundTxid: string,
    fundVout: number,
    fundAmount: bigint | number,
    localFundPubkey: string,
    remoteFundPubkey: string,
    maxWitnessLength: number,
    inputSerialId?: bigint | number,
  ): DlcInputInfoRequest {
    return {
      fundTxid,
      fundVout,
      fundAmount,
      localFundPubkey,
      remoteFundPubkey,
      maxWitnessLength,
      inputSerialId,
    };
  }

  /**
   * Calculate the maximum collateral possible with given inputs
   * @param inputs Array of inputs to use for funding
   * @param feeRatePerVb Fee rate in satoshis per virtual byte
   * @param contractCount Number of DLC contracts (default: 1)
   * @returns {Promise<bigint>} Maximum collateral amount in satoshis
   */
  async calculateMaxCollateral(
    inputs: IInput[],
    feeRatePerVb: bigint,
    contractCount: number = 1,
  ): Promise<bigint> {
    return this.client.getMethod('calculateMaxCollateral')(
      inputs,
      feeRatePerVb,
      contractCount,
    );
  }

  /**
   * Create DLC funding input from DLC input info
   * @param dlcInputInfo DLC input information
   * @param fundTxHex Optional funding transaction hex
   * @returns {Promise<IInput>} DLC funding input
   */
  async createDlcFundingInput(
    dlcInputInfo: DlcInputInfoRequest,
    fundTxHex?: string,
  ): Promise<IInput> {
    const fundingInput = await this.client.getMethod('createDlcFundingInput')(
      dlcInputInfo,
      fundTxHex,
    );
    return this.fundingInputToInput(fundingInput);
  }
}

export interface AcceptDlcOfferResponse {
  dlcAccept: DlcAccept;
  dlcTransactions: DlcTransactions;
}

export interface SignDlcAcceptResponse {
  dlcSign: DlcSign;
  dlcTransactions: DlcTransactions;
}

export interface IInput {
  txid: string;
  vout: number;
  address: string;
  amount: number; // in BTC
  value: number; // in sats
  derivationPath?: string;
  maxWitnessLength?: number;
  redeemScript?: string;
  inputSerialId?: bigint;
  scriptPubKey?: string;
  label?: string;
  confirmations?: number;
  spendable?: boolean;
  solvable?: boolean;
  safe?: boolean;
  dlcInput?: {
    localFundPubkey: string;
    remoteFundPubkey: string;
    contractId: string;
  }; // DLC-specific information for splice transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toUtxo: any;
  isDlcInput(): boolean;
}
