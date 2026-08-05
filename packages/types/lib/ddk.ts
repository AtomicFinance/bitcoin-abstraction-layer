/*
 * Hand-maintained mirror of the NAPI-RS surface of `@bennyblader/ddk-ts`.
 * Kept structurally compatible so the module can be injected as a `DdkInterface`.
 *
 * Tracks @bennyblader/ddk-ts@1.0.0-rc1 — when bumping that dependency, diff
 * `node_modules/@bennyblader/ddk-ts/dist/index.d.ts` against this file.
 */

/**
 * The `max_witness_len` a DLC (splice) funding input must declare — the witness
 * spending a 2-of-2 multisig P2WSH funding output.
 *
 * Mirrors `dlcInputMaxWitnessLen()` in ddk-ts. It lives here as a constant
 * because `@atomicfinance/types` and the CFD-based providers have no ddk
 * instance to call; `BitcoinDdkProvider.DdkLoaded()` asserts the two agree so
 * the copy cannot silently drift.
 */
export const DLC_INPUT_MAX_WITNESS_LEN = 220;

export interface AdaptorSignature {
  signature: Buffer;
  proof: Buffer;
}

export interface ChangeOutputAndFees {
  changeOutput: TxOutput;
  fundFee: bigint;
  cetFee: bigint;
}

/**
 * Every input that feeds a CET adaptor signature, surfaced for debugging.
 *
 * Use this to diff against a remote signer (e.g. Fordefi) when an adaptor
 * signature is rejected — it isolates whether the mismatch is in the sighash,
 * the adaptor point, or the transaction being signed.
 */
export interface CetAdaptorSignatureDebugInfo {
  /** The sighash (32 bytes) - this is the message that gets signed */
  sighash: Buffer;
  /** The adaptor point (33 bytes compressed public key) */
  adaptorPoint: Buffer;
  /** Input index (always 0 for CETs) */
  inputIndex: number;
  /** The funding script pubkey used for sighash */
  scriptPubkey: Buffer;
  /** The fund output value used for sighash */
  value: bigint;
  /** The CET txid */
  cetTxid: string;
  /** Raw CET bytes for verification */
  cetRaw: Buffer;
}

export interface DdkDlcInputInfo {
  fundTx: DdkTransaction;
  fundVout: number;
  localFundPubkey: Buffer;
  remoteFundPubkey: Buffer;
  fundAmount: bigint;
  maxWitnessLen: number;
  inputSerialId: bigint;
  contractId: Buffer;
}

export interface DlcOutcome {
  localPayout: bigint;
  remotePayout: bigint;
}

export interface DdkDlcTransactions {
  fund: DdkTransaction;
  cets: Array<DdkTransaction>;
  refund: DdkTransaction;
  fundingScriptPubkey: Buffer;
}

export interface DdkOracleInfo {
  publicKey: Buffer;
  nonces: Array<Buffer>;
}

export interface PartyParams {
  fundPubkey: Buffer;
  changeScriptPubkey: Buffer;
  changeSerialId: bigint;
  payoutScriptPubkey: Buffer;
  payoutSerialId: bigint;
  inputs: Array<TxInputInfo>;
  inputAmount: bigint;
  collateral: bigint;
  dlcInputs: Array<DdkDlcInputInfo>;
}

export interface Payout {
  offer: bigint;
  accept: bigint;
}

export interface DdkTransaction {
  version: number;
  lockTime: number;
  inputs: Array<TxInput>;
  outputs: Array<TxOutput>;
  rawBytes: Buffer;
}

export interface TxInput {
  txid: string;
  vout: number;
  scriptSig: Buffer;
  sequence: number;
  witness: Array<Buffer>;
}

export interface TxInputInfo {
  txid: string;
  vout: number;
  scriptSig: Buffer;
  maxWitnessLength: number;
  serialId: bigint;
}

export interface TxOutput {
  value: bigint;
  scriptPubkey: Buffer;
}

// Main DDK interface that any implementation must provide
export interface DdkInterface {
  createCet(
    localOutput: TxOutput,
    localPayoutSerialId: bigint,
    remoteOutput: TxOutput,
    remotePayoutSerialId: bigint,
    fundTxId: string,
    fundVout: number,
    lockTime: number,
  ): DdkTransaction;

  cetAdaptorSignatureFromOracleInfo(
    cet: DdkTransaction,
    oracleInfo: DdkOracleInfo,
    fundingSk: Buffer,
    fundingScriptPubkey: Buffer,
    totalCollateral: bigint,
    msgs: Array<Buffer>,
  ): AdaptorSignature;

  createCetAdaptorSigsFromOracleInfo(
    cets: Array<DdkTransaction>,
    oracleInfo: Array<DdkOracleInfo>,
    fundingSecretKey: Buffer,
    fundingScriptPubkey: Buffer,
    fundOutputValue: bigint,
    msgs: Array<Array<Array<Buffer>>>,
  ): Array<AdaptorSignature>;

  verifyFromOracleInfo(
    adaptorSig: AdaptorSignature,
    cet: DdkTransaction,
    oracleInfo: Array<DdkOracleInfo>,
    pubkey: Buffer,
    fundingScriptPubkey: Buffer,
    totalCollateral: bigint,
    msgs: Array<Array<Buffer>>,
  ): boolean;

  verifyCetAdaptorSigsFromOracleInfo(
    adaptorSigs: Array<AdaptorSignature>,
    cets: Array<DdkTransaction>,
    oracleInfo: Array<DdkOracleInfo>,
    pubkey: Buffer,
    fundingScriptPubkey: Buffer,
    totalCollateral: bigint,
    msgs: Array<Array<Array<Buffer>>>,
  ): boolean;

  /**
   * Every input that goes into creating a CET adaptor signature.
   * Use this to compare values with a remote signer to debug signature mismatches.
   */
  cetAdaptorSignatureInputs(
    cet: DdkTransaction,
    oracleInfo: Array<DdkOracleInfo>,
    fundingScriptPubkey: Buffer,
    fundOutputValue: bigint,
    msgs: Array<Array<Buffer>>,
  ): CetAdaptorSignatureDebugInfo;

  /**
   * The sighash for a CET — the actual 32-byte message that gets signed.
   * Useful for comparing against a remote signer's sighash calculation.
   */
  cetSighash(
    cet: DdkTransaction,
    fundingScriptPubkey: Buffer,
    fundOutputValue: bigint,
  ): Buffer;

  createCets(
    fundTxId: string,
    fundVout: number,
    localFinalScriptPubkey: Buffer,
    remoteFinalScriptPubkey: Buffer,
    outcomes: Array<Payout>,
    lockTime: number,
    localSerialId: bigint,
    remoteSerialId: bigint,
  ): Array<DdkTransaction>;

  createDlcTransactions(
    outcomes: Array<Payout>,
    localParams: PartyParams,
    remoteParams: PartyParams,
    refundLocktime: number,
    feeRate: bigint,
    fundLockTime: number,
    cetLockTime: number,
    fundOutputSerialId: bigint,
    contractFlags?: number,
  ): DdkDlcTransactions;

  createFundTxLockingScript(
    localFundPubkey: Buffer,
    remoteFundPubkey: Buffer,
  ): Buffer;

  createRefundTransaction(
    localFinalScriptPubkey: Buffer,
    remoteFinalScriptPubkey: Buffer,
    localAmount: bigint,
    remoteAmount: bigint,
    lockTime: number,
    fundTxId: string,
    fundVout: number,
  ): DdkTransaction;

  createSplicedDlcTransactions(
    outcomes: Array<Payout>,
    localParams: PartyParams,
    remoteParams: PartyParams,
    refundLocktime: number,
    feeRate: bigint,
    fundLockTime: number,
    cetLockTime: number,
    fundOutputSerialId: bigint,
    contractFlags?: number,
  ): DdkDlcTransactions;

  changeOutputAndFees(
    params: PartyParams,
    feeRate: bigint,
  ): ChangeOutputAndFees;

  rawFundingInputSignature(
    fundingTransaction: DdkTransaction,
    privkey: Buffer,
    prevTxId: string,
    prevTxVout: number,
    value: bigint,
  ): Buffer;

  getTotalInputVsize(inputs: Array<TxInputInfo>): number;

  /** The required `max_witness_len` for a DLC (splice) funding input. */
  dlcInputMaxWitnessLen(): number;

  isDust(output: TxOutput): boolean;

  signFundInput(
    fundTransaction: DdkTransaction,
    privkey: Buffer,
    prevTxId: string,
    prevTxVout: number,
    value: bigint,
  ): DdkTransaction;

  verifyFundSignature(
    fundTx: DdkTransaction,
    signature: Buffer,
    pubkey: Buffer,
    txid: string,
    vout: number,
    inputAmount: bigint,
  ): boolean;

  signCet(
    cet: DdkTransaction,
    adaptorSignature: Buffer,
    oracleSignatures: Array<Buffer>,
    fundingSecretKey: Buffer,
    otherPubkey: Buffer,
    fundingScriptPubkey: Buffer,
    fundOutputValue: bigint,
  ): DdkTransaction;

  convertMnemonicToSeed(mnemonic: string, passphrase?: string | null): Buffer;

  // New clean API functions (DDK v0.3.23+)
  createExtkeyFromSeed(seed: Buffer, network: string): Buffer;
  createExtkeyFromParentPath(extkey: Buffer, path: string): Buffer;
  getPubkeyFromExtkey(extkey: Buffer, network: string): Buffer;

  // Legacy functions (maintained for backward compatibility)
  createXprivFromParentPath(
    seedOrXpriv: Buffer,
    baseDerivationPath: string,
    network: string,
    path: string,
  ): Buffer;

  getXpubFromXpriv(xpriv: Buffer, network: string): Buffer;

  version(): string;

  addSignature(
    tx: DdkTransaction,
    signature: Buffer,
    pubkey: Buffer,
    inputIndex: number,
  ): DdkTransaction;

  signMultiSigInput(
    tx: DdkTransaction,
    dlcInput: DdkDlcInputInfo,
    localPrivkey: Buffer,
    remoteSignature: Buffer,
  ): DdkTransaction;
}
