/*
 * Hand-maintained mirror of the NAPI-RS surface of `@bennyblader/ddk-ts`.
 * Kept structurally compatible so the module can be injected as a `DdkInterface`.
 *
 * Tracks @bennyblader/ddk-ts@1.0.0-rc1 — when bumping that dependency, diff
 * `node_modules/@bennyblader/ddk-ts/dist/index.d.ts` against this file.
 */

export interface AdaptorSignature {
  signature: Buffer;
  proof: Buffer;
}

export interface ChangeOutputAndFees {
  changeOutput: TxOutput;
  fundFee: bigint;
  cetFee: bigint;
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
