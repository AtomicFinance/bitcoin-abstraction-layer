import { TxInRequest, TxOutRequest } from './common';

export interface CfdProvider {
  AddMultisigSign(
    jsonObject: AddMultisigSignRequest,
  ): Promise<AddMultisigSignResponse>;

  AddPubkeyHashSign(
    jsonObject: AddPubkeyHashSignRequest,
  ): Promise<AddPubkeyHashSignResponse>;

  AddRawTransaction(
    jsonObject: AddRawTransactionRequest,
  ): Promise<AddRawTransactionResponse>;

  AddScriptHashSign(
    jsonObject: AddScriptHashSignRequest,
  ): Promise<AddScriptHashSignResponse>;

  AddSign(jsonObject: AddSignRequest): Promise<AddSignResponse>;

  AppendDescriptorChecksum(
    jsonObject: AppendDescriptorChecksumRequest,
  ): Promise<AppendDescriptorChecksumResponse>;

  BlindRawTransaction(
    jsonObject: BlindRawTransactionRequest,
  ): Promise<BlindRawTransactionResponse>;

  CalculateEcSignature(
    jsonObject: CalculateEcSignatureRequest,
  ): Promise<CalculateEcSignatureResponse>;

  ConvertAes(jsonObject: ConvertAesRequest): Promise<ConvertAesResponse>;

  ConvertEntropyToMnemonic(
    jsonObject: ConvertEntropyToMnemonicRequest,
  ): Promise<ConvertEntropyToMnemonicResponse>;

  ConvertMnemonicToSeed(
    jsonObject: ConvertMnemonicToSeedRequest,
  ): Promise<ConvertMnemonicToSeedResponse>;

  CreateAddress(
    jsonObject: CreateAddressRequest,
  ): Promise<CreateAddressResponse>;

  CreateDescriptor(
    jsonObject: CreateDescriptorRequest,
  ): Promise<CreateDescriptorResponse>;

  CreateExtkey(jsonObject: CreateExtkeyRequest): Promise<CreateExtkeyResponse>;

  CreateExtkeyFromParent(
    jsonObject: CreateExtkeyFromParentRequest,
  ): Promise<CreateExtkeyFromParentResponse>;

  CreateExtkeyFromParentKey(
    jsonObject: CreateExtkeyFromParentKeyRequest,
  ): Promise<CreateExtkeyFromParentKeyResponse>;

  CreateExtkeyFromParentPath(
    jsonObject: CreateExtkeyFromParentPathRequest,
  ): Promise<CreateExtkeyFromParentPathResponse>;

  CreateExtkeyFromSeed(
    jsonObject: CreateExtkeyFromSeedRequest,
  ): Promise<CreateExtkeyFromSeedResponse>;

  CreateExtPubkey(
    jsonObject: CreateExtPubkeyRequest,
  ): Promise<CreateExtPubkeyResponse>;

  CreateKeyPair(
    jsonObject: CreateKeyPairRequest,
  ): Promise<CreateKeyPairResponse>;

  CreateMultisigScriptSig(
    jsonObject: CreateMultisigScriptSigRequest,
  ): Promise<CreateMultisigScriptSigResponse>;

  CreateScript(jsonObject: CreateScriptRequest): Promise<CreateScriptResponse>;

  DecodeBase58(jsonObject: DecodeBase58Request): Promise<DecodeBase58Response>;

  DecodeDerSignatureToRaw(
    jsonObject: DecodeDerSignatureToRawRequest,
  ): Promise<DecodeDerSignatureToRawResponse>;

  DecodeRawTransaction(
    jsonObject: DecodeRawTransactionRequest,
  ): Promise<DecodeRawTransactionResponse>;

  ElementsAddRawTransaction(
    jsonObject: ElementsAddRawTransactionRequest,
  ): Promise<ElementsAddRawTransactionResponse>;

  CreateDestroyAmount(
    jsonObject: CreateDestroyAmountRequest,
  ): Promise<CreateDestroyAmountResponse>;

  CreatePegInAddress(
    jsonObject: CreatePegInAddressRequest,
  ): Promise<CreatePegInAddressResponse>;

  CreateRawPegin(
    jsonObject: CreateRawPeginRequest,
  ): Promise<CreateRawPeginResponse>;

  CreateRawPegout(
    jsonObject: CreateRawPegoutRequest,
  ): Promise<CreateRawPegoutResponse>;

  ElementsCreateRawTransaction(
    jsonObject: ElementsCreateRawTransactionRequest,
  ): Promise<ElementsCreateRawTransactionResponse>;

  ElementsDecodeRawTransaction(
    jsonObject: ElementsDecodeRawTransactionRequest,
  ): Promise<ElementsDecodeRawTransactionResponse>;

  GetConfidentialAddress(
    jsonObject: GetConfidentialAddressRequest,
  ): Promise<GetConfidentialAddressResponse>;

  GetUnblindedAddress(
    jsonObject: GetUnblindedAddressRequest,
  ): Promise<GetUnblindedAddressResponse>;

  SetRawIssueAsset(
    jsonObject: SetRawIssueAssetRequest,
  ): Promise<SetRawIssueAssetResponse>;

  SetRawReissueAsset(
    jsonObject: SetRawReissueAssetRequest,
  ): Promise<SetRawReissueAssetResponse>;

  UnblindRawTransaction(
    jsonObject: UnblindRawTransactionRequest,
  ): Promise<UnblindRawTransactionResponse>;

  EncodeBase58(jsonObject: EncodeBase58Request): Promise<EncodeBase58Response>;

  EncodeSignatureByDer(
    jsonObject: EncodeSignatureByDerRequest,
  ): Promise<EncodeSignatureByDerResponse>;

  EstimateFee(jsonObject: EstimateFeeRequest): Promise<EstimateFeeResponse>;

  FundRawTransaction(
    jsonObject: FundRawTransactionRequest,
  ): Promise<FundRawTransactionResponse>;

  GetAddressInfo(
    jsonObject: GetAddressInfoRequest,
  ): Promise<GetAddressInfoResponse>;

  GetAddressesFromMultisig(
    jsonObject: GetAddressesFromMultisigRequest,
  ): Promise<GetAddressesFromMultisigResponse>;

  GetCommitment(
    jsonObject: GetCommitmentRequest,
  ): Promise<GetCommitmentResponse>;

  GetCompressedPubkey(
    jsonObject: GetCompressedPubkeyRequest,
  ): Promise<GetCompressedPubkeyResponse>;

  GetDefaultBlindingKey(
    jsonObject: GetDefaultBlindingKeyRequest,
  ): Promise<GetDefaultBlindingKeyResponse>;

  GetExtkeyInfo(
    jsonObject: GetExtkeyInfoRequest,
  ): Promise<GetExtkeyInfoResponse>;

  GetIssuanceBlindingKey(
    jsonObject: GetIssuanceBlindingKeyRequest,
  ): Promise<GetIssuanceBlindingKeyResponse>;

  GetMnemonicWordlist(
    jsonObject: GetMnemonicWordlistRequest,
  ): Promise<GetMnemonicWordlistResponse>;

  GetPrivkeyFromExtkey(
    jsonObject: GetPrivkeyFromExtkeyRequest,
  ): Promise<GetPrivkeyFromExtkeyResponse>;

  GetPrivkeyFromWif(
    jsonObject: GetPrivkeyFromWifRequest,
  ): Promise<GetPrivkeyFromWifResponse>;

  GetPrivkeyWif(
    jsonObject: GetPrivkeyWifRequest,
  ): Promise<GetPrivkeyWifResponse>;

  GetPubkeyFromExtkey(
    jsonObject: GetPubkeyFromExtkeyRequest,
  ): Promise<GetPubkeyFromExtkeyResponse>;

  GetPubkeyFromPrivkey(
    jsonObject: GetPubkeyFromPrivkeyRequest,
  ): Promise<GetPubkeyFromPrivkeyResponse>;

  GetWitnessStackNum(
    jsonObject: GetWitnessStackNumRequest,
  ): Promise<GetWitnessStackNumResponse>;

  CreateMultisig(
    jsonObject: CreateMultisigRequest,
  ): Promise<CreateMultisigResponse>;

  ParseDescriptor(
    jsonObject: ParseDescriptorRequest,
  ): Promise<ParseDescriptorResponse>;

  ParseScript(jsonObject: ParseScriptRequest): Promise<ParseScriptResponse>;

  SelectUtxos(jsonObject: SelectUtxosRequest): Promise<SelectUtxosResponse>;

  SerializeLedgerFormat(
    jsonObject: SerializeLedgerFormatRequest,
  ): Promise<SerializeLedgerFormatResponse>;

  CreateSignatureHash(
    jsonObject: CreateSignatureHashRequest,
  ): Promise<CreateSignatureHashResponse>;

  CreateElementsSignatureHash(
    jsonObject: CreateElementsSignatureHashRequest,
  ): Promise<CreateElementsSignatureHashResponse>;

  SignWithPrivkey(
    jsonObject: SignWithPrivkeyRequest,
  ): Promise<SignWithPrivkeyResponse>;

  GetSupportedFunction(): Promise<GetSupportedFunctionResponse>;

  CreateRawTransaction(
    jsonObject: CreateRawTransactionRequest,
  ): Promise<CreateRawTransactionResponse>;

  UpdateTxOutAmount(
    jsonObject: UpdateTxOutAmountRequest,
  ): Promise<UpdateTxOutAmountResponse>;

  UpdateWitnessStack(
    jsonObject: UpdateWitnessStackRequest,
  ): Promise<UpdateWitnessStackResponse>;

  VerifySign(jsonObject: VerifySignRequest): Promise<VerifySignResponse>;

  VerifySignature(
    jsonObject: VerifySignatureRequest,
  ): Promise<VerifySignatureResponse>;
}

/**
 * Multisig signature data.
 * @property {string} hex - signature hex.
 * @property {string} type? - parameter type. (sign only)
 * @property {boolean} derEncode? - der encode option flag
 * @property {string} sighashType? - signature hash type. (all, none or single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 * @property {string} relatedPubkey? - a pubkey related to signature.
 */
export interface MultisigSignData {
  hex: string;
  type?: string;
  derEncode?: boolean;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
  relatedPubkey?: string;
}

/**
 * Multisig signature input data.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {MultisigSignData[]} signParams - Multisig signature data.
 * @property {string} redeemScript? - (required for P2SH or P2SH-P2WSH) redeem script for unlocking script
 * @property {string} witnessScript? - (required for P2WSH or P2SH-P2WSH) witness script for witness stack
 * @property {string} hashType - hash type. (p2sh, p2wsh or p2sh-p2wsh)
 * @property {boolean} clearStack? - Clear the stack before addSign. If txinType is p2sh, clearStack is forced to be true.
 */
export interface AddMultisigSignTxInRequest {
  txid: string;
  vout: number;
  signParams: MultisigSignData[];
  redeemScript?: string;
  witnessScript?: string;
  hashType: string;
  clearStack?: boolean;
}

/**
 * Multisig input data to add to tx.
 * @property {boolean} isElements? - elements transaction flag.
 * @property {string} tx - transaction hex
 * @property {AddMultisigSignTxInRequest} txin - transaction input data
 */
export interface AddMultisigSignRequest {
  isElements?: boolean;
  tx: string;
  txin: AddMultisigSignTxInRequest;
}

/**
 * The output data with signature added.
 * @property {string} hex - signed transaction hex.
 */
export interface AddMultisigSignResponse {
  hex: string;
}

/**
 * pubkey hash signature data
 * @property {string} hex - signature hex.
 * @property {string} type? - parameter type. (sign only)
 * @property {boolean} derEncode? - der encode option flag
 * @property {string} sighashType? - signature hash type. (all, none or single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 */
export interface PubkeyHashSignData {
  hex: string;
  type?: string;
  derEncode?: boolean;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
}

/**
 * pubkey hash input data
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {PubkeyHashSignData} signParam - sign parameter.
 * @property {string} pubkey - public key.
 * @property {string} hashType - hash type. (p2pkh, p2wpkh or p2sh-p2wpkh)
 */
export interface AddPubkeyHashSignTxInRequest {
  txid: string;
  vout: number;
  signParam: PubkeyHashSignData;
  pubkey: string;
  hashType: string;
}

/**
 * pubkey hash input data to add to tx.
 * @property {boolean} isElements? - elements transaction flag.
 * @property {string} tx - transaction hex
 * @property {AddPubkeyHashSignTxInRequest} txin - transaction input data
 */
export interface AddPubkeyHashSignRequest {
  isElements?: boolean;
  tx: string;
  txin: AddPubkeyHashSignTxInRequest;
}

/**
 * The output data with signature added.
 * @property {string} hex - signed transaction hex.
 */
export interface AddPubkeyHashSignResponse {
  hex: string;
}

/**
 * The data added to the transaction input.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {number} sequence? - sequence number.
 */
export interface AddTxIn {
  txid: string;
  vout: number;
  sequence?: number;
}

/**
 * The data added to the transaction output.
 * @property {string} address - bitcoin address.
 * @property {bigint | number} amount - satoshi amount.
 * @property {string} directLockingScript? - Set to locking script. (When using a script that cannot be expressed as an address)
 */
export interface AddTxOut {
  address: string;
  amount: bigint | number;
  directLockingScript?: string;
}

/**
 * The data added to the transaction.
 * @property {string} tx - transaction hex
 * @property {AddTxIn[]} txins? - The data added to the transaction input.
 * @property {AddTxOut[]} txouts? - The data added to the transaction output.
 */
export interface AddRawTransactionRequest {
  tx: string;
  txins?: AddTxIn[];
  txouts?: AddTxOut[];
}

/**
 * The output transaction data.
 * @property {string} hex - transaction hex.
 */
export interface AddRawTransactionResponse {
  hex: string;
}

/**
 * signature data
 * @property {string} hex - If the type is auto or op_code, character string input is enabled. Others are hex byte array only.
 * @property {string} type? - parameter type. (binary, sign)
 * @property {boolean} derEncode? - der encode option flag. Valid when type is auto or sign.
 * @property {string} sighashType? - signature hash type. (all, none, single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 */
export interface ScriptHashSignData {
  hex: string;
  type?: string;
  derEncode?: boolean;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
}

/**
 * script hash input data
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {ScriptHashSignData[]} signParam - signature data
 * @property {string} redeemScript - redeem script.
 * @property {string} hashType - hash type. (p2sh, p2wsh or p2sh-p2wsh)
 */
export interface AddScriptHashSignTxInRequest {
  txid: string;
  vout: number;
  signParam: ScriptHashSignData[];
  redeemScript: string;
  hashType: string;
}

/**
 * script hash input data to add to tx.
 * @property {boolean} isElements? - elements transaction flag.
 * @property {string} tx - transaction hex
 * @property {AddScriptHashSignTxInRequest} txin - transaction input data
 */
export interface AddScriptHashSignRequest {
  isElements?: boolean;
  tx: string;
  txin: AddScriptHashSignTxInRequest;
}

/**
 * The output data with signature added.
 * @property {string} hex - signed transaction hex.
 */
export interface AddScriptHashSignResponse {
  hex: string;
}

/**
 * The sign data.
 * @property {string} hex - If the type is auto or op_code, character string input is enabled. Others are hex byte array only.
 * @property {string} type? - parameter type. (auto, binary, sign, pubkey, redeem_script, op_code)
 * @property {boolean} derEncode? - der encode option flag. Valid when type is auto or sign.
 * @property {string} sighashType? - signature hash type. (all, none, single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 */
export interface SignData {
  hex: string;
  type?: string;
  derEncode?: boolean;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
}

/**
 * Sign input data.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {boolean} isWitness? - use witness stack flag.
 * @property {SignData[]} signParam - The sign data.
 * @property {boolean} clearStack? - Clear the stack before addSign. If isWitness is false, clearStack is forced to be true.
 */
export interface AddSignTxInRequest {
  txid: string;
  vout: number;
  isWitness?: boolean;
  signParam: SignData[];
  clearStack?: boolean;
}

/**
 * Sign input data to add to tx.
 * @property {boolean} isElements? - elements transaction flag.
 * @property {string} tx - transaction hex
 * @property {AddSignTxInRequest} txin - transaction input data
 */
export interface AddSignRequest {
  isElements?: boolean;
  tx: string;
  txin: AddSignTxInRequest;
}

/**
 * The output data with signature added.
 * @property {string} hex - signed transaction hex.
 */
export interface AddSignResponse {
  hex: string;
}

/**
 * The output descriptor request data.
 * @property {string} descriptor - output descriptor.
 * @property {boolean} isElements? - elements transaction flag.
 */
export interface AppendDescriptorChecksumRequest {
  descriptor: string;
  isElements?: boolean;
}

/**
 * The data containing output descriptor.
 * @property {string} descriptor - output descriptor.
 */
export interface AppendDescriptorChecksumResponse {
  descriptor: string;
}

/**
 * Tx input data for blinding.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {string} asset - asset hex.
 * @property {string} blindFactor? - amount blinder.
 * @property {string} assetBlindFactor? - asset blinder.
 * @property {bigint | number} amount - satoshi amount.
 */
export interface BlindTxInRequest {
  txid: string;
  vout: number;
  asset: string;
  blindFactor?: string;
  assetBlindFactor?: string;
  amount: bigint | number;
}

/**
 * Tx output data for blinding.
 * @property {number} index - target txout index.
 * @property {string} confidentialKey - confidential key.
 * @property {string} blindPubkey? - (deprecated field)
 */
export interface BlindTxOutRequest {
  index: number;
  confidentialKey: string;
  blindPubkey?: string;
}

/**
 * Tx input issuance data for blinding.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {string} assetBlindingKey - asset blinding key.
 * @property {string} tokenBlindingKey? - token blinding key. Used when issue transaction.
 */
export interface BlindIssuanceRequest {
  txid: string;
  vout: number;
  assetBlindingKey: string;
  tokenBlindingKey?: string;
}

/**
 * Request blind the transaction.
 * @property {string} tx - transaction hex
 * @property {BlindTxInRequest[]} txins - Tx input data for blinding.
 * @property {BlindTxOutRequest[]} txouts? - Tx output data for blinding.
 * @property {BlindIssuanceRequest[]} issuances? - Tx input issuance data for blinding.
 * @property {bigint | number} minimumRangeValue? - rangeproof minimum value.
 * @property {number} exponent? - An exponential value that guarantees a range of rangeproof.
 * @property {number} minimumBits? - minimum bits of rangeproof.
 */
export interface BlindRawTransactionRequest {
  tx: string;
  txins: BlindTxInRequest[];
  txouts?: BlindTxOutRequest[];
  txoutConfidentialAddresses?: string[];
  issuances?: BlindIssuanceRequest[];
  minimumRangeValue?: bigint | number;
  exponent?: number;
  minimumBits?: number;
}

/**
 * The data containing blinded transaction.
 * @property {string} hex - blinded transaction hex.
 */
export interface BlindRawTransactionResponse {
  hex: string;
}

/**
 * private key data.
 * @property {string} privkey - private key. set is wif or hex.
 * @property {boolean} wif - use wif flag. true is wif, false is hex.
 * @property {string} network? - wif network type. (mainnet, testnet or regtest)
 * @property {boolean} isCompressed? - wif compressed flag
 */
export interface PrivkeyData {
  privkey: string;
  wif: boolean;
  network?: string;
  isCompressed?: boolean;
}

/**
 * request ec signature data.
 * @property {string} sighash - signature hash.
 * @property {PrivkeyData} privkeyData? - private key data.
 * @property {boolean} isGrindR? - Grind-R flag
 */
export interface CalculateEcSignatureRequest {
  sighash: string;
  privkeyData?: PrivkeyData;
  isGrindR?: boolean;
}

/**
 * response ec signature data.
 * @property {string} signature - ec signature
 */
export interface CalculateEcSignatureResponse {
  signature: string;
}

/**
 * Request AES data.
 * @property {boolean} isEncrypt - aes encrypto flag. true is encrypto, false is decrypto
 * @property {string} mode? - AES mode. (for feature) (cbc only)
 * @property {string} key - key data (32 byte: 64 char hex)
 * @property {string} iv? - initial vector (16 byte: 32 char hex) (using by cbc mode only.)
 * @property {string} data - crypto target data
 */
export interface ConvertAesRequest {
  isEncrypt: boolean;
  mode?: string;
  key: string;
  iv?: string;
  data: string;
}

/**
 * The data converted by AES.
 * @property {string} hex - encrypted or decrypted data
 */
export interface ConvertAesResponse {
  hex: string;
}

/** */
export interface ConvertEntropyToMnemonicRequest {
  entropy: string;
  language?: string;
}

/** */
export interface ConvertEntropyToMnemonicResponse {
  mnemonic: string[];
}

/**
 * @property {boolean} strictCheck? - Check mnemonic words strictly
 * @property {boolean} useIdeographicSpace? - Currently, this flag is valid only the language is set "jp".
 */
export interface ConvertMnemonicToSeedRequest {
  mnemonic: string[];
  passphrase: string;
  strictCheck?: boolean;
  language?: string;
  useIdeographicSpace?: boolean;
}

/** @property {string} entropy? - This field is only set if "language" is set in the request */
export interface ConvertMnemonicToSeedResponse {
  seed: string;
  entropy?: string;
}

/** */
export interface CreateAddressKeyData {
  hex: string;
  type: string;
}

/** */
export interface CreateAddressRequest {
  isElements?: boolean;
  keyData?: CreateAddressKeyData;
  network: string;
  hashType: string;
}

/**
 * @property {string} lockingScript - (redeem script or pubkey) locking script
 * @property {string} redeemScript? - (required for P2SH-P2WPKH or P2SH-P2WSH) redeem script for unlocking script
 */
export interface CreateAddressResponse {
  address: string;
  lockingScript: string;
  redeemScript?: string;
}

/** */
export interface CreateDescriptorKeyRequest {
  key: string;
  parentExtkey?: string;
  keyPathFromParent?: string;
}

/**
 * @property {string} scriptType - Script types are joined by '-'. (ex. p2sh-p2wsh-multi)
 * @property {number} requireNum? - multisig require num.
 */
export interface CreateDescriptorRequest {
  scriptType: string;
  keyInfoList?: CreateDescriptorKeyRequest[];
  requireNum?: number;
}

/** */
export interface CreateDescriptorResponse {
  descriptor: string;
}

/** */
export interface CreateExtkeyRequest {
  network: string;
  extkeyType?: string;
  parentKey?: string;
  parentFingerprint?: string;
  key: string;
  depth: number;
  chainCode: string;
  childNumber: number;
  hardened?: boolean;
}

/** */
export interface CreateExtkeyResponse {
  extkey: string;
}

/** */
export interface CreateExtkeyFromParentRequest {
  extkey: string;
  network: string;
  extkeyType: string;
  childNumber: number;
  hardened?: boolean;
}

/** */
export interface CreateExtkeyFromParentResponse {
  extkey: string;
}

/** */
export interface CreateExtkeyFromParentKeyRequest {
  network: string;
  extkeyType?: string;
  parentKey: string;
  parentDepth: number;
  parentChainCode: string;
  childNumber: number;
  hardened?: boolean;
}

/** */
export interface CreateExtkeyFromParentKeyResponse {
  extkey: string;
}

/** */
export interface CreateExtkeyFromParentPathRequest {
  extkey: string;
  network: string;
  extkeyType: string;
  childNumberArray?: number[];
  path?: string;
}

/** */
export interface CreateExtkeyFromParentPathResponse {
  extkey: string;
}

/** */
export interface CreateExtkeyFromSeedRequest {
  seed: string;
  network: string;
  extkeyType?: string;
}

/** */
export interface CreateExtkeyFromSeedResponse {
  extkey: string;
}

/** */
export interface CreateExtPubkeyRequest {
  extkey: string;
  network: string;
}

/** */
export interface CreateExtPubkeyResponse {
  extkey: string;
}

/** */
export interface CreateKeyPairRequest {
  wif: boolean;
  network?: string;
  isCompressed?: boolean;
}

/** */
export interface CreateKeyPairResponse {
  privkey: string;
  pubkey: string;
}

/** */
export interface MultisigScriptSigData {
  hex: string;
  type?: string;
  derEncode?: boolean;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
  relatedPubkey?: string;
}

/** @property {string} redeemScript - multisig script */
export interface CreateMultisigScriptSigRequest {
  signParams?: MultisigScriptSigData[];
  redeemScript: string;
}

/** */
export interface CreateMultisigScriptSigResponse {
  hex: string;
}

/** */
export interface CreateScriptRequest {
  items: string[];
}

/** */
export interface CreateScriptResponse {
  hex: string;
}

/**
 * @property {string} data - base58 data
 * @property {boolean} hasChecksum? - use checksum mode.
 */
export interface DecodeBase58Request {
  data: string;
  hasChecksum?: boolean;
}

/** @property {string} hex - decoded data byte hex */
export interface DecodeBase58Response {
  hex: string;
}

/** @property {string} signature - der signature */
export interface DecodeDerSignatureToRawRequest {
  signature: string;
}

/** */
export interface DecodeDerSignatureToRawResponse {
  signature: string;
}

/** */
export interface DecodeRawTransactionRequest {
  hex: string;
  network?: string;
  iswitness?: boolean;
}

/** */
export interface DecodeUnlockingScript {
  asm?: string;
  hex?: string;
}

/** */
export interface DecodeRawTransactionTxIn {
  coinbase?: string;
  txid?: string;
  vout?: number;
  scriptSig?: DecodeUnlockingScript;
  txinwitness?: string[];
  sequence?: number;
}

/** */
export interface DecodeLockingScript {
  asm?: string;
  hex?: string;
  reqSigs?: number;
  type?: string;
  addresses?: string[];
}

/** */
export interface DecodeRawTransactionTxOut {
  value: bigint;
  n: number;
  scriptPubKey?: DecodeLockingScript;
}

/** */
export interface DecodeRawTransactionResponse {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin?: DecodeRawTransactionTxIn[];
  vout?: DecodeRawTransactionTxOut[];
}

/** */
export interface ElementsAddTxInRequest {
  txid: string;
  vout: number;
  sequence?: number;
}

/** */
export interface ElementsAddPeginWitness {
  amount: bigint | number;
  asset: string;
  mainchainGenesisBlockHash: string;
  claimScript: string;
  mainchainRawTransaction: string;
  mainchainTxoutproof: string;
}

/** */
export interface ElementsAddPeginTxIn {
  txid: string;
  vout: number;
  sequence?: number;
  peginwitness: ElementsAddPeginWitness;
  isRemoveMainchainTxWitness?: boolean;
}

/** */
export interface ElementsAddTxOut {
  address: string;
  amount: bigint | number;
  asset: string;
  directLockingScript?: string;
  directNonce?: string;
  isRemoveNonce?: boolean;
}

/** */
export interface ElementsAddDestroyAmount {
  amount: bigint | number;
  asset: string;
  directNonce?: string;
}

/** */
export interface ElementsAddPegout {
  amount: bigint | number;
  asset: string;
  network: string;
  elementsNetwork: string;
  mainchainGenesisBlockHash: string;
  btcAddress?: string;
  onlinePubkey: string;
  masterOnlineKey: string;
  bitcoinDescriptor: string;
  bip32Counter: number;
  whitelist: string;
}

/** */
export interface ElementsAddTxOutFee {
  amount: bigint | number;
  asset: string;
}

/** @property {string} tx - transaction hex */
export interface ElementsAddRawTransactionRequest {
  tx: string;
  txins?: ElementsAddTxInRequest[];
  peginTxins?: ElementsAddPeginTxIn[];
  txouts?: ElementsAddTxOut[];
  destroyAmountTxouts?: ElementsAddDestroyAmount[];
  pegoutTxouts?: ElementsAddPegout[];
  fee?: ElementsAddTxOutFee;
  isRandomSortTxOut?: boolean;
}

/** @property {string} hex - transaction hex */
export interface ElementsAddRawTransactionResponse {
  hex: string;
  btcAddresses?: string[];
}

/** */
export interface ElementsDestroyAmountTxIn {
  txid: string;
  vout: number;
  sequence?: number;
}

/** */
export interface ElementsDestroyAmountTxOut {
  address: string;
  amount: bigint | number;
  asset: string;
  directLockingScript?: string;
  directNonce?: string;
  isRemoveNonce?: boolean;
}

/** */
export interface ElementsDestroyAmount {
  amount: bigint | number;
  asset: string;
  directNonce?: string;
}

/** */
export interface ElementsDestroyAmountFee {
  amount: bigint | number;
  asset: string;
}

/** */
export interface CreateDestroyAmountRequest {
  version?: number;
  locktime?: number;
  txins?: ElementsDestroyAmountTxIn[];
  txouts?: ElementsDestroyAmountTxOut[];
  destroy: ElementsDestroyAmount;
  fee?: ElementsDestroyAmountFee;
}

/** */
export interface CreateDestroyAmountResponse {
  hex: string;
}

/**
 * @property {string} pubkey - pubkey related to unlocking peg-in utxo. (This field is only avalable when lockingScript is empty.)
 * @property {string} redeemScript? - default is empty. set claim script to direct.
 */
export interface CreatePegInAddressRequest {
  fedpegscript: string;
  pubkey: string;
  redeemScript?: string;
  network?: string;
  hashType?: string;
}

/** */
export interface CreatePegInAddressResponse {
  mainchainAddress: string;
  claimScript: string;
  tweakFedpegscript: string;
}

/** */
export interface ElementsPeginWitness {
  amount: bigint | number;
  asset: string;
  mainchainGenesisBlockHash: string;
  claimScript: string;
  mainchainRawTransaction: string;
  mainchainTxoutproof: string;
}

/** */
export interface ElementsPeginTxIn {
  isPegin?: boolean;
  txid: string;
  vout: number;
  sequence?: number;
  peginwitness?: ElementsPeginWitness;
  isRemoveMainchainTxWitness?: boolean;
}

/** */
export interface ElementsPeginTxOut {
  address: string;
  amount: bigint | number;
  asset: string;
  directLockingScript?: string;
  directNonce?: string;
  isRemoveNonce?: boolean;
}

/** */
export interface ElementsPeginTxOutFee {
  amount: bigint | number;
  asset: string;
}

/** */
export interface CreateRawPeginRequest {
  version?: number;
  locktime?: number;
  txins: ElementsPeginTxIn[];
  txouts?: ElementsPeginTxOut[];
  fee?: ElementsPeginTxOutFee;
  isRandomSortTxOut?: boolean;
}

/** */
export interface CreateRawPeginResponse {
  hex: string;
}

/** */
export interface ElementsPegoutTxIn {
  txid: string;
  vout: number;
  sequence?: number;
}

/** */
export interface ElementsPegoutTxOut {
  address: string;
  amount: bigint | number;
  asset: string;
  directLockingScript?: string;
  directNonce?: string;
  isRemoveNonce?: boolean;
}

/** */
export interface ElementsPegout {
  amount: bigint | number;
  asset: string;
  network: string;
  elementsNetwork: string;
  mainchainGenesisBlockHash: string;
  btcAddress?: string;
  onlinePubkey: string;
  masterOnlineKey: string;
  bitcoinDescriptor: string;
  bip32Counter: number;
  whitelist: string;
}

/** */
export interface ElementsPegoutTxOutFee {
  amount: bigint | number;
  asset: string;
}

/** */
export interface CreateRawPegoutRequest {
  version?: number;
  locktime?: number;
  txins?: ElementsPegoutTxIn[];
  txouts?: ElementsPegoutTxOut[];
  pegout: ElementsPegout;
  fee?: ElementsPegoutTxOutFee;
}

/** */
export interface CreateRawPegoutResponse {
  hex: string;
  btcAddress?: string;
}

/** */
export interface ElementsTxInRequest {
  txid: string;
  vout: number;
  sequence?: number;
}

/** */
export interface ElementsTxOutRequest {
  address: string;
  amount: bigint | number;
  asset: string;
  directLockingScript?: string;
  directNonce?: string;
  isRemoveNonce?: boolean;
}

/** */
export interface ElementsTxOutFeeRequest {
  amount: bigint | number;
  asset: string;
}

/** */
export interface ElementsCreateRawTransactionRequest {
  version?: number;
  locktime?: number;
  txins: ElementsTxInRequest[];
  txouts?: ElementsTxOutRequest[];
  fee?: ElementsTxOutFeeRequest;
}

/** */
export interface ElementsCreateRawTransactionResponse {
  hex: string;
}

/** @property {boolean} fullDump? - tx data all dump option. */
export interface ElementsDecodeRawTransactionRequest {
  hex: string;
  network?: string;
  mainchainNetwork?: string;
  iswitness?: boolean;
  fullDump?: boolean;
}

/** */
export interface ElementsDecodeUnlockingScript {
  asm: string;
  hex: string;
}

/** @property {string} contractHash? - issue original entropy data. */
export interface ElementsDecodeIssuance {
  assetBlindingNonce: string;
  assetEntropy: string;
  contractHash?: string;
  isreissuance: boolean;
  token?: string;
  asset?: string;
  assetamount?: bigint;
  assetamountcommitment?: string;
  tokenamount?: bigint;
  tokenamountcommitment?: string;
  assetRangeproof?: string;
  tokenRangeproof?: string;
}

/** */
export interface ElementsDecodeRawTransactionTxIn {
  coinbase?: string;
  txid?: string;
  vout?: number;
  scriptSig?: ElementsDecodeUnlockingScript;
  is_pegin?: boolean;
  sequence?: bigint;
  txinwitness?: string[];
  pegin_witness?: string[];
  issuance?: ElementsDecodeIssuance;
}

/** */
export interface ElementsDecodeLockingScript {
  asm?: string;
  hex?: string;
  reqSigs?: number;
  type: string;
  addresses?: string[];
  pegout_chain?: string;
  pegout_asm?: string;
  pegout_hex?: string;
  pegout_reqSigs?: number;
  pegout_type?: string;
  pegout_addresses?: string[];
}

/** */
export interface ElementsDecodeRawTransactionTxOut {
  value?: bigint;
  'value-minimum?': bigint;
  'value-maximum?': bigint;
  'ct-exponent?': number;
  'ct-bits?': number;
  surjectionproof?: string;
  valuecommitment?: string;
  asset?: string;
  assetcommitment?: string;
  commitmentnonce?: string;
  commitmentnonce_fully_valid?: boolean;
  n: number;
  scriptPubKey?: ElementsDecodeLockingScript;
  rangeproof?: string;
}

/** */
export interface ElementsDecodeRawTransactionResponse {
  txid: string;
  hash: string;
  wtxid: string;
  withash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin?: ElementsDecodeRawTransactionTxIn[];
  vout?: ElementsDecodeRawTransactionTxOut[];
}

/** */
export interface GetConfidentialAddressRequest {
  unblindedAddress: string;
  key: string;
}

/** */
export interface GetConfidentialAddressResponse {
  confidentialAddress: string;
}

/** */
export interface GetUnblindedAddressRequest {
  confidentialAddress: string;
}

/** */
export interface GetUnblindedAddressResponse {
  unblindedAddress: string;
  confidentialKey: string;
}

/** */
export interface IssuanceDataRequest {
  txid: string;
  vout: number;
  assetAmount: bigint | number;
  assetAddress: string;
  tokenAmount: bigint | number;
  tokenAddress: string;
  isBlind?: boolean;
  contractHash?: string;
  isRemoveNonce?: boolean;
}

/** @property {string} tx - transaction hex */
export interface SetRawIssueAssetRequest {
  tx: string;
  isRandomSortTxOut?: boolean;
  issuances: IssuanceDataRequest[];
}

/** */
export interface IssuanceDataResponse {
  txid: string;
  vout: number;
  asset: string;
  entropy: string;
  token?: string;
}

/** */
export interface SetRawIssueAssetResponse {
  hex: string;
  issuances: IssuanceDataResponse[];
}

/** */
export interface ReissuanceDataRequest {
  txid: string;
  vout: number;
  amount: bigint | number;
  address: string;
  assetBlindingNonce: string;
  assetEntropy: string;
  isRemoveNonce?: boolean;
}

/** @property {string} tx - transaction hex */
export interface SetRawReissueAssetRequest {
  tx: string;
  isRandomSortTxOut?: boolean;
  issuances: ReissuanceDataRequest[];
}

/** */
export interface ReissuanceDataResponse {
  txid: string;
  vout: number;
  asset: string;
  entropy: string;
}

/** */
export interface SetRawReissueAssetResponse {
  hex: string;
  issuances: ReissuanceDataResponse[];
}

/** */
export interface UnblindTxOut {
  index: number;
  blindingKey: string;
}

/** */
export interface UnblindIssuance {
  txid: string;
  vout: number;
  assetBlindingKey?: string;
  tokenBlindingKey?: string;
}

/** @property {string} tx - transaction hex */
export interface UnblindRawTransactionRequest {
  tx: string;
  txouts?: UnblindTxOut[];
  issuances?: UnblindIssuance[];
}

/** */
export interface UnblindOutput {
  index: number;
  asset: string;
  blindFactor: string;
  assetBlindFactor: string;
  amount: bigint;
}

/** */
export interface UnblindIssuanceOutput {
  txid: string;
  vout: number;
  asset?: string;
  assetamount?: bigint;
  token?: string;
  tokenamount?: bigint;
}

/** */
export interface UnblindRawTransactionResponse {
  hex: string;
  outputs?: UnblindOutput[];
  issuanceOutputs?: UnblindIssuanceOutput[];
}

/** @property {string} hex - base58 target byte hex */
export interface EncodeBase58Request {
  hex: string;
  hasChecksum?: boolean;
}

/** @property {string} data - encoded data */
export interface EncodeBase58Response {
  data: string;
}

/** @property {string} signature - signature */
export interface EncodeSignatureByDerRequest {
  signature: string;
  sighashType: string;
  sighashAnyoneCanPay?: boolean;
}

/** */
export interface EncodeSignatureByDerResponse {
  signature: string;
}

/** @property {string} scriptSigTemplate? - ScriptSig template is for scriptHash calculation fee. */
export interface SelectUtxoData {
  txid: string;
  vout: number;
  asset?: string;
  redeemScript?: string;
  descriptor?: string;
  isIssuance?: boolean;
  isBlindIssuance?: boolean;
  isPegin?: boolean;
  peginBtcTxSize?: bigint | number;
  fedpegScript?: string;
  scriptSigTemplate?: string;
}

/** @property {string} tx - transaction hex */
export interface EstimateFeeRequest {
  selectUtxos?: SelectUtxoData[];
  feeRate: number;
  tx: string;
  isElements?: boolean;
  isBlind?: boolean;
  feeAsset?: string;
  exponent?: number;
  minimumBits?: number;
}

/**
 * @property {bigint} feeAmount - tx fee amount. (txoutFeeAmount + utxoFeeAmount)
 * @property {bigint} txFeeAmount? - (deprecated: rename to txoutFeeAmount)
 * @property {bigint} txoutFeeAmount? - fee of tx output & base area.
 * @property {bigint} utxoFeeAmount? - fee of tx inputs utxo.
 */
export interface EstimateFeeResponse {
  feeAmount: bigint;
  txFeeAmount?: bigint;
  txoutFeeAmount?: bigint;
  utxoFeeAmount?: bigint;
}

/** @property {string} scriptSigTemplate? - ScriptSig template is for scriptHash calculation fee. */
export interface FundUtxoJsonData {
  txid: string;
  vout: number;
  address: string;
  amount: bigint | number;
  asset?: string;
  descriptor?: string;
  scriptSigTemplate?: string;
}

/** @property {string} scriptSigTemplate? - ScriptSig template is for scriptHash calculation fee. */
export interface FundSelectUtxoData {
  txid: string;
  vout: number;
  address: string;
  amount: bigint | number;
  asset?: string;
  redeemScript?: string;
  descriptor?: string;
  isIssuance?: boolean;
  isBlindIssuance?: boolean;
  isPegin?: boolean;
  peginBtcTxSize?: number;
  fedpegScript?: string;
  scriptSigTemplate?: string;
}

/**
 * @property {bigint | number} amount - Amount more than the specified amount is set in txout. default is 0 (disable).
 * @property {string} reserveAddress - This address use when append TxOut. Also serves as a change address. (This field is available only bitcoin.)
 */
export interface FundAmountMapData {
  asset: string;
  amount: bigint | number;
  reserveAddress: string;
}

/** @property {bigint | number} knapsackMinChange? - knapsack logic's threshold. Recommended value is 1. (knapsack minimum change amount.) */
export interface FundFeeInfomation {
  feeRate: number;
  longTermFeeRate?: number;
  knapsackMinChange?: bigint | number;
  dustFeeRate?: number;
  feeAsset?: string;
  isBlindEstimateFee?: boolean;
  exponent?: number;
  minimumBits?: number;
}

/**
 * @property {string} tx - transaction hex
 * @property {bigint | number} targetAmount? - Amount more than the specified amount is set in txout. default is 0 (disable). (This field is available only bitcoin.)
 * @property {string} reserveAddress? - This address use when append TxOut. Also serves as a change address. (This field is available only bitcoin.)
 */
export interface FundRawTransactionRequest {
  utxos: FundUtxoJsonData[];
  selectUtxos?: FundSelectUtxoData[];
  tx: string;
  isElements?: boolean;
  network?: string;
  targetAmount?: bigint | number;
  reserveAddress?: string;
  targets?: FundAmountMapData[];
  feeInfo?: FundFeeInfomation;
}

/** */
export interface FundRawTransactionResponse {
  hex: string;
  usedAddresses?: string[];
  feeAmount?: bigint;
}

/** @property {string} address - address text */
export interface GetAddressInfoRequest {
  address: string;
  isElements?: boolean;
}

/** @property {string} hash? - pubkey-hash or script-hash. p2wsh:32byte, other:20byte */
export interface GetAddressInfoResponse {
  lockingScript: string;
  network: string;
  hashType: string;
  witnessVersion?: number;
  hash?: string;
}

/** @property {string} redeemScript - redeem script on multisig */
export interface GetAddressesFromMultisigRequest {
  isElements?: boolean;
  redeemScript: string;
  network?: string;
  hashType?: string;
}

/** */
export interface GetAddressesFromMultisigResponse {
  addresses: string[];
  pubkeys: string[];
  requireNum: number;
}

/** */
export interface GetCommitmentRequest {
  amount: bigint | number;
  asset: string;
  assetBlindFactor: string;
  blindFactor: string;
}

/** */
export interface GetCommitmentResponse {
  assetCommitment: string;
  amountCommitment: string;
}

/** */
export interface GetCompressedPubkeyRequest {
  pubkey: string;
}

/** */
export interface GetCompressedPubkeyResponse {
  pubkey: string;
}

/** @property {string} address? - use if empty locking script. */
export interface GetDefaultBlindingKeyRequest {
  masterBlindingKey: string;
  lockingScript?: string;
  address?: string;
}

/** */
export interface GetDefaultBlindingKeyResponse {
  blindingKey: string;
}

/** */
export interface GetExtkeyInfoRequest {
  extkey: string;
}

/** */
export interface GetExtkeyInfoResponse {
  network: string;
  version: string;
  depth: number;
  fingerprint: string;
  childNumber: number;
  chainCode: string;
}

/** */
export interface GetIssuanceBlindingKeyRequest {
  masterBlindingKey: string;
  txid: string;
  vout: number;
}

/** */
export interface GetIssuanceBlindingKeyResponse {
  blindingKey: string;
}

/** */
export interface GetMnemonicWordlistRequest {
  language: string;
}

/** */
export interface GetMnemonicWordlistResponse {
  wordlist: string[];
}

/** */
export interface GetPrivkeyFromExtkeyRequest {
  extkey: string;
  network: string;
  wif: boolean;
  isCompressed?: boolean;
}

/** */
export interface GetPrivkeyFromExtkeyResponse {
  privkey: string;
}

/** @property {string} wif - Wallet Import Format */
export interface GetPrivkeyFromWifRequest {
  wif: string;
}

/** @property {string} hex - privkey hex. */
export interface GetPrivkeyFromWifResponse {
  hex: string;
  network: string;
  isCompressed: boolean;
}

/** @property {string} hex - privkey hex. */
export interface GetPrivkeyWifRequest {
  hex: string;
  network: string;
  isCompressed: boolean;
}

/** @property {string} wif - Wallet Import Format */
export interface GetPrivkeyWifResponse {
  wif: string;
}

/** */
export interface GetPubkeyFromExtkeyRequest {
  extkey: string;
  network: string;
}

/** */
export interface GetPubkeyFromExtkeyResponse {
  pubkey: string;
}

/** */
export interface GetPubkeyFromPrivkeyRequest {
  privkey: string;
  isCompressed?: boolean;
}

/** */
export interface GetPubkeyFromPrivkeyResponse {
  pubkey: string;
}

/** */
export interface GetWitnessStackNumTxInRequest {
  txid: string;
  vout: number;
}

/** @property {string} tx - transaction hex */
export interface GetWitnessStackNumRequest {
  tx: string;
  isElements?: boolean;
  txin: GetWitnessStackNumTxInRequest;
}

/** */
export interface GetWitnessStackNumResponse {
  count: number;
}

/** */
export interface CreateMultisigRequest {
  nrequired: number;
  keys: string[];
  isElements?: boolean;
  network: string;
  hashType: string;
}

/**
 * @property {string} redeemScript? - (required for P2SH or P2SH-P2WSH) redeem script for unlocking script
 * @property {string} witnessScript? - (required for P2WSH or P2SH-P2WSH) witness script for witness stack
 */
export interface CreateMultisigResponse {
  address: string;
  redeemScript?: string;
  witnessScript?: string;
}

/** @property {string} descriptor - output descriptor */
export interface ParseDescriptorRequest {
  isElements?: boolean;
  descriptor: string;
  network?: string;
  bip32DerivationPath?: string;
}

/** */
export interface DescriptorKeyJson {
  keyType: string;
  key: string;
}

/** */
export interface DescriptorScriptJson {
  depth: number;
  lockingScript: string;
  address: string;
  hashType: string;
  redeemScript?: string;
  keyType?: string;
  key?: string;
  keys?: DescriptorKeyJson[];
  reqNum?: number;
}

/** */
export interface ParseDescriptorResponse {
  type: string;
  address?: string;
  lockingScript: string;
  hashType?: string;
  redeemScript?: string;
  includeMultisig: boolean;
  scripts?: DescriptorScriptJson[];
}

/** @property {string} script - script hex. */
export interface ParseScriptRequest {
  script: string;
}

/** */
export interface ParseScriptResponse {
  scriptItems: string[];
}

/** */
export interface UtxoJsonData {
  txid: string;
  vout: number;
  amount: bigint;
  asset?: string;
  descriptor?: string;
}

/** */
export interface TargetAmountMapData {
  asset: string;
  amount: bigint;
}

/** @property {number} knapsackMinChange? - knapsack logic's threshold. Recommended value is 1. (knapsack minimum change amount.) */
export interface CoinSelectionFeeInfomationField {
  txFeeAmount?: bigint | number;
  feeRate?: number;
  longTermFeeRate?: number;
  knapsackMinChange?: number;
  feeAsset?: string;
  exponent?: number;
  minimumBits?: number;
}

/** @property {bigint | number} targetAmount? - Amount more than the specified amount is set in txout. default is 0 (disable). (This field is available only bitcoin.) */
export interface SelectUtxosRequest {
  utxos: UtxoJsonData[];
  targetAmount?: bigint | number;
  isElements?: boolean;
  targets?: TargetAmountMapData[];
  feeInfo?: CoinSelectionFeeInfomationField;
}

/** */
export interface SelectUtxosResponse {
  utxos: UtxoJsonData[];
  selectedAmount?: bigint;
  selectedAmounts?: TargetAmountMapData[];
  feeAmount?: bigint;
  utxoFeeAmount: bigint;
}

/** */
export interface SerializeLedgerFormatTxOut {
  index: number;
  asset: string;
  amount: bigint | number;
}

/** @property {string} tx - transaction hex */
export interface SerializeLedgerFormatRequest {
  tx: string;
  txouts?: SerializeLedgerFormatTxOut[];
  skipWitness?: boolean;
  isAuthorization: boolean;
}

/** */
export interface SerializeLedgerFormatResponse {
  serialize: string;
  sha256: string;
}

/** */
export interface SignatureHashKeyData {
  hex: string;
  type: string;
}

/** */
export interface CreateSignatureHashTxInRequest {
  txid: string;
  vout: number;
  keyData: SignatureHashKeyData;
  amount: bigint | number;
  hashType: string;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
}

/** @property {string} tx - transaction hex */
export interface CreateSignatureHashRequest {
  tx: string;
  txin: CreateSignatureHashTxInRequest;
}

/** */
export interface CreateSignatureHashResponse {
  sighash: string;
}

/** */
export interface ElementsSignatureHashKeyData {
  hex: string;
  type: string;
}

/** */
export interface CreateElementsSignatureHashTxIn {
  txid: string;
  vout: number;
  keyData: ElementsSignatureHashKeyData;
  amount?: bigint | number;
  confidentialValueCommitment?: string;
  hashType: string;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
}

/** @property {string} tx - transaction hex */
export interface CreateElementsSignatureHashRequest {
  tx: string;
  txin: CreateElementsSignatureHashTxIn;
}

/** */
export interface CreateElementsSignatureHashResponse {
  sighash: string;
}

/**
 * @property {string} privkey - private key. hex or wif format.
 * @property {string} pubkey? - public key. if empty, generate from privkey.
 */
export interface SignWithPrivkeyTxInRequest {
  txid: string;
  vout: number;
  privkey: string;
  pubkey?: string;
  hashType: string;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
  amount?: bigint | number;
  confidentialValueCommitment?: string;
  isGrindR?: boolean;
}

/**
 * Add signatures to pubkey hash input
 * @property {string} tx - transaction hex
 */
export interface SignWithPrivkeyRequest {
  isElements?: boolean;
  tx: string;
  txin?: SignWithPrivkeyTxInRequest;
}

/** */
export interface SignWithPrivkeyResponse {
  hex: string;
}

/** */
export interface GetSupportedFunctionResponse {
  bitcoin: boolean;
  elements: boolean;
}

/** */
export interface CreateRawTransactionRequest {
  version?: number;
  locktime?: number;
  txins?: TxInRequest[];
  txouts?: TxOutRequest[];
}

/** */
export interface CreateRawTransactionResponse {
  hex: string;
}

/** */
export interface UpdateTxOutAmountData {
  amount: bigint | number;
  index?: number;
  address?: string;
  directLockingScript?: string;
}

/** @property {string} tx - transaction hex */
export interface UpdateTxOutAmountRequest {
  tx: string;
  isElements?: boolean;
  txouts?: UpdateTxOutAmountData[];
}

/** */
export interface UpdateTxOutAmountResponse {
  hex: string;
}

/** */
export interface WitnessStackData {
  index: number;
  hex: string;
  type?: string;
  derEncode?: boolean;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
}

/** */
export interface UpdateWitnessStackTxInRequest {
  txid: string;
  vout: number;
  witnessStack: WitnessStackData;
}

/** @property {string} tx - transaction hex */
export interface UpdateWitnessStackRequest {
  tx: string;
  isElements?: boolean;
  txin?: UpdateWitnessStackTxInRequest;
}

/** */
export interface UpdateWitnessStackResponse {
  hex?: string;
}

/** */
export interface VerifyignTxInUtxoData {
  txid: string;
  vout: number;
  address: string;
  amount: bigint | number;
  descriptor?: string;
  confidentialValueCommitment?: string;
}

/**
 * @property {string} tx - transaction hex
 * @property {boolean} isElements? - elements transaction flag.
 */
export interface VerifySignRequest {
  tx: string;
  isElements?: boolean;
  txins: VerifyignTxInUtxoData[];
}

/** */
export interface FailSignTxIn {
  txid: string;
  vout: number;
  reason: string;
}

/** */
export interface VerifySignResponse {
  success: boolean;
  failTxins?: FailSignTxIn[];
}

/** */
export interface VerifySignatureTxInRequest {
  txid: string;
  vout: number;
  signature: string;
  pubkey: string;
  redeemScript?: string;
  hashType: string;
  sighashType?: string;
  sighashAnyoneCanPay?: boolean;
  amount?: bigint | number;
  confidentialValueCommitment?: string;
}

/**
 * @property {string} tx - transaction hex
 * @property {boolean} isElements? - elements transaction flag.
 */
export interface VerifySignatureRequest {
  tx: string;
  isElements?: boolean;
  txin: VerifySignatureTxInRequest;
}

/** */
export interface VerifySignatureResponse {
  success: boolean;
}
