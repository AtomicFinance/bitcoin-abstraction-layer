/*
 * Structural mirror of the ddk engine BAL is injected with: the generated
 * TypeScript bindings of ddk-ffi, published as `@bennyblader/ddk` (and, before
 * the rename, `@bennyblader/ddk-ts` 1.0.0-rc5). Kept structurally compatible so
 * the module itself can be passed as a `DdkInterface`.
 *
 * The transactions BAL signs are built by this engine, not by BAL. To match the
 * ddk v2 construction (for example the single-funded CET fee rule of
 * `ddk-dlc` 2.0.0-rc.6), inject an engine built on that ddk-dlc release.
 *
 * Differences from the earlier hand-written NAPI surface:
 * - Bytes are `Uint8Array`. A `Buffer` is a `Uint8Array`, so arguments pass
 *   unchanged, but results must go through `Buffer.from()` before any
 *   `Buffer`-only call such as `toString('hex')`.
 * - Functions that operate on one record are methods on that record's
 *   namespace: `ddk.Transaction.signCet(tx, ...)`, not `ddk.signCet(tx, ...)`.
 *
 * When bumping the engine, diff its `ddk_ffi.d.ts` against this file.
 */

/**
 * The `max_witness_len` a DLC (splice) funding input must declare — the witness
 * spending a 2-of-2 multisig P2WSH funding output.
 *
 * Mirrors `dlcInputMaxWitnessLen()` in ddk. It lives here as a constant
 * because `@atomicfinance/types` and the CFD-based providers have no ddk
 * instance to call; `BitcoinDdkProvider.DdkLoaded()` asserts the two agree so
 * the copy cannot silently drift.
 */
export const DLC_INPUT_MAX_WITNESS_LEN = 220;

export interface AdaptorSignature {
  signature: Uint8Array;
  proof: Uint8Array;
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
  sighash: Uint8Array;
  /** The adaptor point (33 bytes compressed public key) */
  adaptorPoint: Uint8Array;
  /** Input index (always 0 for CETs) */
  inputIndex: number;
  /** The funding script pubkey used for sighash */
  scriptPubkey: Uint8Array;
  /** The fund output value used for sighash */
  value: bigint;
  /** The CET txid */
  cetTxid: string;
  /** Raw CET bytes for verification */
  cetRaw: Uint8Array;
}

export interface DdkDlcInputInfo {
  fundTx: DdkTransaction;
  fundVout: number;
  localFundPubkey: Uint8Array;
  remoteFundPubkey: Uint8Array;
  fundAmount: bigint;
  maxWitnessLen: number;
  inputSerialId: bigint;
  contractId: Uint8Array;
}

export interface DlcOutcome {
  localPayout: bigint;
  remotePayout: bigint;
}

export interface DdkDlcTransactions {
  fund: DdkTransaction;
  cets: Array<DdkTransaction>;
  refund: DdkTransaction;
  /** The 2-of-2 funding witness script (not a script pubkey). */
  fundingWitnessScript: Uint8Array;
}

export interface DdkOracleInfo {
  publicKey: Uint8Array;
  nonces: Array<Uint8Array>;
}

export interface PartyParams {
  fundPubkey: Uint8Array;
  changeScriptPubkey: Uint8Array;
  changeSerialId: bigint;
  payoutScriptPubkey: Uint8Array;
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
  rawBytes: Uint8Array;
}

export interface TxInput {
  txid: string;
  vout: number;
  scriptSig: Uint8Array;
  sequence: number;
  witness: Array<Uint8Array>;
}

export interface TxInputInfo {
  txid: string;
  vout: number;
  scriptSig: Uint8Array;
  maxWitnessLength: number;
  serialId: bigint;
}

export interface TxOutput {
  value: bigint;
  scriptPubkey: Uint8Array;
}

/** Methods on the engine's `Transaction` record namespace. */
export interface DdkTransactionMethods {
  addSignature(
    self_: DdkTransaction,
    signature: Uint8Array,
    pubkey: Uint8Array,
    inputIndex: number,
  ): DdkTransaction;

  cetAdaptorSignatureFromOracleInfo(
    self_: DdkTransaction,
    oracleInfo: DdkOracleInfo,
    fundingSk: Uint8Array,
    fundingScriptPubkey: Uint8Array,
    totalCollateral: bigint,
    msgs: Array<Uint8Array>,
  ): AdaptorSignature;

  /**
   * Every input that goes into creating a CET adaptor signature.
   * Use this to compare values with a remote signer to debug signature mismatches.
   */
  cetAdaptorSignatureInputs(
    self_: DdkTransaction,
    oracleInfo: Array<DdkOracleInfo>,
    fundingScriptPubkey: Uint8Array,
    fundOutputValue: bigint,
    msgs: Array<Array<Uint8Array>>,
  ): CetAdaptorSignatureDebugInfo;

  /**
   * The sighash for a CET — the actual 32-byte message that gets signed.
   * Useful for comparing against a remote signer's sighash calculation.
   */
  cetSighash(
    self_: DdkTransaction,
    fundingScriptPubkey: Uint8Array,
    fundOutputValue: bigint,
  ): Uint8Array;

  rawFundingInputSignature(
    self_: DdkTransaction,
    privkey: Uint8Array,
    prevTxId: string,
    prevTxVout: number,
    value: bigint,
  ): Uint8Array;

  signCet(
    self_: DdkTransaction,
    adaptorSignature: Uint8Array,
    oracleSignatures: Array<Uint8Array>,
    fundingSecretKey: Uint8Array,
    otherPubkey: Uint8Array,
    fundingScriptPubkey: Uint8Array,
    fundOutputValue: bigint,
  ): DdkTransaction;

  signFundInput(
    self_: DdkTransaction,
    privkey: Uint8Array,
    prevTxId: string,
    prevTxVout: number,
    value: bigint,
  ): DdkTransaction;

  signMultiSigInput(
    self_: DdkTransaction,
    dlcInput: DdkDlcInputInfo,
    localPrivkey: Uint8Array,
    remoteSignature: Uint8Array,
  ): DdkTransaction;

  verifyFundSignature(
    self_: DdkTransaction,
    signature: Uint8Array,
    pubkey: Uint8Array,
    txid: string,
    vout: number,
    inputAmount: bigint,
  ): boolean;
}

/** Methods on the engine's `TxOutput` record namespace. */
export interface DdkTxOutputMethods {
  isDust(self_: TxOutput): boolean;
}

/** Methods on the engine's `AdaptorSignature` record namespace. */
export interface DdkAdaptorSignatureMethods {
  verifyFromOracleInfo(
    self_: AdaptorSignature,
    cet: DdkTransaction,
    oracleInfos: Array<DdkOracleInfo>,
    pubkey: Uint8Array,
    fundingScriptPubkey: Uint8Array,
    totalCollateral: bigint,
    msgs: Array<Array<Uint8Array>>,
  ): boolean;
}

/** Methods on the engine's `PartyParams` record namespace. */
export interface DdkPartyParamsMethods {
  /**
   * Assumes a dual-funded contract (total collateral = 2 × this party's), and
   * does not price the counterparty's payout output, so it under-reports a
   * single-funded party's CET fee under ddk-dlc 2.0.0-rc.6.
   */
  changeOutputAndFees(self_: PartyParams, feeRate: bigint): ChangeOutputAndFees;
}

// Main DDK interface that any implementation must provide
export interface DdkInterface {
  Transaction: DdkTransactionMethods;
  TxOutput: DdkTxOutputMethods;
  AdaptorSignature: DdkAdaptorSignatureMethods;
  PartyParams: DdkPartyParamsMethods;

  createCet(
    localOutput: TxOutput,
    localPayoutSerialId: bigint,
    remoteOutput: TxOutput,
    remotePayoutSerialId: bigint,
    fundTxId: string,
    fundVout: number,
    lockTime: number,
  ): DdkTransaction;

  createCetAdaptorSigsFromOracleInfo(
    cets: Array<DdkTransaction>,
    oracleInfo: Array<DdkOracleInfo>,
    fundingSecretKey: Uint8Array,
    fundingScriptPubkey: Uint8Array,
    fundOutputValue: bigint,
    msgs: Array<Array<Array<Uint8Array>>>,
  ): Array<AdaptorSignature>;

  verifyCetAdaptorSigsFromOracleInfo(
    adaptorSigs: Array<AdaptorSignature>,
    cets: Array<DdkTransaction>,
    oracleInfos: Array<DdkOracleInfo>,
    pubkey: Uint8Array,
    fundingScriptPubkey: Uint8Array,
    totalCollateral: bigint,
    msgs: Array<Array<Array<Uint8Array>>>,
  ): boolean;

  createCets(
    fundTxId: string,
    fundVout: number,
    localFinalScriptPubkey: Uint8Array,
    remoteFinalScriptPubkey: Uint8Array,
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
    contractFlags: number,
  ): DdkDlcTransactions;

  createFundTxLockingScript(
    localFundPubkey: Uint8Array,
    remoteFundPubkey: Uint8Array,
  ): Uint8Array;

  createRefundTransaction(
    localFinalScriptPubkey: Uint8Array,
    remoteFinalScriptPubkey: Uint8Array,
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
    contractFlags: number,
  ): DdkDlcTransactions;

  getTotalInputVsize(inputs: Array<TxInputInfo>): number;

  /** The required `max_witness_len` for a DLC (splice) funding input. */
  dlcInputMaxWitnessLen(): number;

  convertMnemonicToSeed(
    mnemonic: string,
    passphrase: string | undefined,
  ): Uint8Array;

  createExtkeyFromSeed(seed: Uint8Array, network: string): Uint8Array;
  createExtkeyFromParentPath(extkey: Uint8Array, path: string): Uint8Array;
  getPubkeyFromExtkey(extkey: Uint8Array, network: string): Uint8Array;

  createXprivFromParentPath(
    seedOrXpriv: Uint8Array,
    baseDerivationPath: string,
    network: string,
    path: string,
  ): Uint8Array;

  getXpubFromXpriv(xpriv: Uint8Array, network: string): Uint8Array;

  version(): string;
}
