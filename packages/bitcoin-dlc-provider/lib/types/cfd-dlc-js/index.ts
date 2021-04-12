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

/** Create an adaptor signature using multiple oracles for a CET */
export interface CreateCetAdaptorSignatureMultiOracleRequest {
  cetHex: string;
  privkey: string;
  fundTxId: string;
  fundVout?: number;
  localFundPubkey: string;
  remoteFundPubkey: string;
  oracleInfos: OracleInfo[];
  fundInputAmount: bigint | number;
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
  remoteInputAmount: bigint | number;
  remoteCollateralAmount: bigint | number;
  refundLocktime: bigint | number;
  localInputs: TxInInfoRequest[];
  localChangeScriptPubkey: string;
  remoteInputs: TxInInfoRequest[];
  remoteChangeScriptPubkey: string;
  feeRate: number;
  cetLockTime?: bigint | number;
  fundLockTime?: bigint | number;
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
  localInputs: TxInRequest[];
  localChange: TxOutRequest;
  remoteInputs: TxInRequest[];
  remoteChange: TxOutRequest;
  feeRate: bigint | number;
  optionDest?: string;
  optionPremium?: bigint | number;
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

export interface ErrorResponse {
  error: InnerErrorResponse;
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

export interface InnerErrorResponse {
  code: number;
  type: string;
  message: string;
}

export interface Messages {
  messages: string[];
}

export interface OracleInfo {
  oraclePubkey: string;
  oracleRValues: string[];
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
}

export interface TxInRequest {
  txid: string;
  vout: number;
}

export interface TxOutRequest {
  amount: bigint | number;
  address: string;
}

/** Verify a signature for a CET */
export interface VerifyCetAdaptorSignatureMultiOracleRequest {
  cetHex: string;
  adaptorSignature: string;
  adaptorProof: string;
  oracleInfos: OracleInfo[];
  localFundPubkey: string;
  remoteFundPubkey: string;
  fundTxId: string;
  fundVout?: number;
  fundInputAmount: bigint | number;
  verifyRemote: boolean;
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
