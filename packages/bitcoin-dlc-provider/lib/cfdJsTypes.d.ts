/* eslint-disable max-len */
/* eslint-disable indent */
/**
 * Request for adapt signature on ecdsa adaptor.
 * @property {string} adaptorSignature - adaptor signature hex.
 * @property {string} secret - secret data
 */
export interface AdaptEcdsaAdaptorRequest {
    adaptorSignature: string;
    secret: string;
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
 * Multisig signature input data.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {PubkeySignData[]} signParams - pubkey signature data.
 * @property {string} redeemScript? - (required for P2SH or P2SH-P2WSH) redeem script for unlocking script
 * @property {string} witnessScript? - (required for P2WSH or P2SH-P2WSH) witness script for witness stack
 * @property {string} hashType - hash type. (p2sh, p2wsh or p2sh-p2wsh)
 * @property {boolean} clearStack? - Clear the stack before addSign. If txinType is p2sh, clearStack is forced to be true.
 */
export interface AddMultisigSignTxInRequest {
    txid: string;
    vout: number;
    signParams: PubkeySignData[];
    redeemScript?: string;
    witnessScript?: string;
    hashType: string;
    clearStack?: boolean;
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
 * pubkey hash input data
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {PubkeySignData} signParam - sign parameter.
 * @property {string} pubkey - public key.
 * @property {string} hashType - hash type. (p2pkh, p2wpkh or p2sh-p2wpkh)
 */
export interface AddPubkeyHashSignTxInRequest {
    txid: string;
    vout: number;
    signParam: PubkeySignData;
    pubkey: string;
    hashType: string;
}

/**
 * The data added to the transaction.
 * @property {string} tx - transaction hex
 * @property {TxInRequest[]} txins? - The data added to the transaction input.
 * @property {TxOutRequest[]} txouts? - The data added to the transaction output.
 */
export interface AddRawTransactionRequest {
    tx: string;
    txins?: TxInRequest[];
    txouts?: TxOutRequest[];
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
 * script hash input data
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {SignData[]} signParam - The sign data.
 * @property {string} redeemScript - redeem script.
 * @property {string} hashType - hash type. (p2sh, p2wsh or p2sh-p2wsh)
 */
export interface AddScriptHashSignTxInRequest {
    txid: string;
    vout: number;
    signParam: SignData[];
    redeemScript: string;
    hashType: string;
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
 * The output descriptor request data.
 * @property {string} descriptor - output descriptor.
 * @property {boolean} isElements? - elements transaction flag.
 */
export interface AppendDescriptorChecksumRequest {
    descriptor: string;
    isElements?: boolean;
}

/**
 * Response of blinding key.
 * @property {string} blindingKey - blinding key
 */
export interface BlindingKeyResponse {
    blindingKey: string;
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
 * @property {string[]} txoutConfidentialAddresses? - Confidential address list. Use instead of txouts.
 * @property {BlindIssuanceRequest[]} issuances? - Tx input issuance data for blinding.
 * @property {bigint | number} minimumRangeValue? - rangeproof minimum value.
 * @property {number} exponent? - An exponential value that guarantees a range of rangeproof.
 * @property {number} minimumBits? - minimum bits of rangeproof.
 * @property {boolean} collectBlinder? - collect blinder data. (blinders and issuanceBlinders)
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
    collectBlinder?: boolean;
}

/**
 * The output blind transaction data.
 * @property {string} hex - transaction hex.
 * @property {UnblindOutput[]} blinders? - unblind txout
 * @property {UnblindIssuanceOutput[]} issuanceBlinders? - unblind issuance data
 */
export interface BlindTransactionResponse {
    hex: string;
    blinders?: UnblindOutput[];
    issuanceBlinders?: UnblindIssuanceOutput[];
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
 * tweak pubkey data
 * @property {string} pubkey - tweaked schnorr public key
 * @property {boolean} parity - y-parity flag
 * @property {string} basePubkey - tweak based schnorr public key
 * @property {string} tweak - 32-byte tweak data
 */
export interface CheckTweakedSchnorrPubkeyRequest {
    pubkey: string;
    parity: boolean;
    basePubkey: string;
    tweak: string;
}

/**
 * fee information.
 * @property {bigint | number} txFeeAmount? - Tx fee amount excluding txin.
 * @property {number} feeRate? - network fee rate
 * @property {number} longTermFeeRate? - network long-term fee rate
 * @property {number} knapsackMinChange? - knapsack minimum change amount. (knapsack logic's threshold. Recommended value is 1.)
 * @property {string} feeAsset? - fee asset (This field is available only elements.)
 * @property {number} exponent? - blind exponent (This field is available only elements.)
 * @property {number} minimumBits? - blind minimum bits (This field is available only elements.)
 */
export interface CoinSelectionFeeInformationField {
    txFeeAmount?: bigint | number;
    feeRate?: number;
    longTermFeeRate?: number;
    knapsackMinChange?: number;
    feeAsset?: string;
    exponent?: number;
    minimumBits?: number;
}

/**
 * Request for compute sigpoint on schnorr
 * @property {string} message - message data. (32-byte hash, or text message.)
 * @property {boolean} isHashed? - is 32-byte hashed message.
 * @property {string} nonce - 32-byte nonce data.
 * @property {string} schnorrPubkey - xonly public key.
 */
export interface ComputeSigPointRequest {
    message: string;
    isHashed?: boolean;
    nonce: string;
    schnorrPubkey: string;
}

/**
 * Request AES data.
 * @property {boolean} isEncrypt - aes encrypt flag. true is encrypt, false is decrypt
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

/**
 * Request's data for converting entropy to mnemonic.
 * @property {string} entropy - entropy hex
 * @property {string} language? - mnemonic's language. (support [en es fr it jp zhs zht])
 */
export interface ConvertEntropyToMnemonicRequest {
    entropy: string;
    language?: string;
}

/**
 * Response data of converting entropy to mnemonic.
 * @property {string[]} mnemonic - mnemonic word list.
 */
export interface ConvertEntropyToMnemonicResponse {
    mnemonic: string[];
}

/**
 * Request's data for converting mnemonic to seed.
 * @property {string[]} mnemonic - mnemonic words
 * @property {string} passphrase - passphrase
 * @property {boolean} strictCheck? - Check mnemonic words strictly
 * @property {string} language? - mnemonic language (support [en es fr it jp zhs zht])
 * @property {boolean} useIdeographicSpace? - Currently, this flag is valid only the language is set "jp".
 */
export interface ConvertMnemonicToSeedRequest {
    mnemonic: string[];
    passphrase: string;
    strictCheck?: boolean;
    language?: string;
    useIdeographicSpace?: boolean;
}

/**
 * Response data of converting mnemonic to seed.
 * @property {string} seed - mnemonic word list
 * @property {string} entropy? - mnemonic's entropy. This field is only set if "language" is set in the request
 */
export interface ConvertMnemonicToSeedResponse {
    seed: string;
    entropy?: string;
}

/**
 * Request data for creating address.
 * @property {boolean} isElements? - elements transaction flag.
 * @property {HashKeyData} keyData? - address's base data.
 * @property {string} network - network type. (bitcoin:'mainnet, testnet, regtest'. elements:'liquidv1, regtest')
 * @property {string} hashType - hash type. (p2wpkh, p2wsh, p2pkh, p2sh, p2sh-p2wpkh, p2sh-p2wsh)
 */
export interface CreateAddressRequest {
    isElements?: boolean;
    keyData?: HashKeyData;
    network: string;
    hashType: string;
}

/**
 * Response data of creating address.
 * @property {string} address - address string.
 * @property {string} lockingScript - (redeem script or pubkey) locking script
 * @property {string} redeemScript? - (required for P2SH-P2WPKH or P2SH-P2WSH) redeem script for unlocking script
 */
export interface CreateAddressResponse {
    address: string;
    lockingScript: string;
    redeemScript?: string;
}

/**
 * descriptor's key data.
 * @property {string} key - pubkey or extpubkey.
 * @property {string} parentExtkey? - parent extpubkey.
 * @property {string} keyPathFromParent? - bip32 path from parent key.
 */
export interface CreateDescriptorKeyRequest {
    key: string;
    parentExtkey?: string;
    keyPathFromParent?: string;
}

/**
 * Request data for creating descriptor.
 * @property {string} scriptType - Script types are joined by '-'. (ex. p2sh-p2wsh-multi)
 * @property {CreateDescriptorKeyRequest[]} keyInfoList? - descriptor's key data.
 * @property {number} requireNum? - multisig require num.
 */
export interface CreateDescriptorRequest {
    scriptType: string;
    keyInfoList?: CreateDescriptorKeyRequest[];
    requireNum?: number;
}

/**
 * Request for create destroy amount transaction
 * @property {number} version? - transaction version
 * @property {number} locktime? - locktime
 * @property {TxInRequest[]} txins? - The data added to the transaction input.
 * @property {ElementsTxOut[]} txouts? - adding txout data
 * @property {ElementsDestroyAmount} destroy - destroy amount txout
 * @property {ElementsTxOutFee} fee? - Transaction fee data.
 */
export interface CreateDestroyAmountRequest {
    version?: number;
    locktime?: number;
    txins?: TxInRequest[];
    txouts?: ElementsTxOut[];
    destroy: ElementsDestroyAmount;
    fee?: ElementsTxOutFee;
}

/**
 * Request for create signature hash.
 * @property {string} tx - transaction hex
 * @property {CreateElementsSignatureHashTxIn} txin - txin data
 */
export interface CreateElementsSignatureHashRequest {
    tx: string;
    txin: CreateElementsSignatureHashTxIn;
}

/**
 * txin data
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {HashKeyData} keyData - key data
 * @property {bigint | number} amount? - satoshi amount (need either amount or confidentialValueCommitment)
 * @property {string} confidentialValueCommitment? - value commitment (need either amount or confidentialValueCommitment)
 * @property {string} hashType - hash type (p2wpkh, p2wsh, p2pkh, p2sh, p2sh-p2wpkh, p2sh-p2wsh)
 * @property {string} sighashType? - signature hash type. (all, none, single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 */
export interface CreateElementsSignatureHashTxIn {
    txid: string;
    vout: number;
    keyData: HashKeyData;
    amount?: bigint | number;
    confidentialValueCommitment?: string;
    hashType: string;
    sighashType?: string;
    sighashAnyoneCanPay?: boolean;
}

/**
 * Request data for creating extkey from parent's key.
 * @property {string} network - network type (mainnet, testnet or regtest)
 * @property {string} extkeyType? - extkey type (extPrivkey or extPubkey)
 * @property {string} parentKey - parent key (pubkey or privkey)
 * @property {number} parentDepth - parent depth
 * @property {string} parentChainCode - parent chain code
 * @property {number} childNumber - bip32 child number.
 * @property {boolean} hardened? - hardened flag. (true is extPrivkey only.)
 */
export interface CreateExtkeyFromParentKeyRequest {
    network: string;
    extkeyType?: string;
    parentKey: string;
    parentDepth: number;
    parentChainCode: string;
    childNumber: number;
    hardened?: boolean;
}

/**
 * Request data for creating extkey from parent.
 * @property {string} extkey - parent extkey
 * @property {string} network - network type (mainnet, testnet or regtest)
 * @property {string} extkeyType - extkey type (extPrivkey or extPubkey)
 * @property {number[]} childNumberArray? - bip32 child number array. (hardened is logical sum 0x80000000)
 * @property {string} path? - bip32 path. (child number string. if exist path, disable childNumberArray. ex) 44'/0h/2.)
 */
export interface CreateExtkeyFromParentPathRequest {
    extkey: string;
    network: string;
    extkeyType: string;
    childNumberArray?: number[];
    path?: string;
}

/**
 * Request data for creating extkey from parent.
 * @property {string} extkey - parent extkey
 * @property {string} network - network type (mainnet, testnet or regtest)
 * @property {string} extkeyType - extkey type (extPrivkey or extPubkey)
 * @property {number} childNumber - bip32 child number.
 * @property {boolean} hardened? - hardened flag. (true is extPrivkey only.)
 */
export interface CreateExtkeyFromParentRequest {
    extkey: string;
    network: string;
    extkeyType: string;
    childNumber: number;
    hardened?: boolean;
}

/**
 * Request data for creating extkey from seed.
 * @property {string} seed - seed hex data
 * @property {string} network - network type (mainnet, testnet or regtest)
 * @property {string} extkeyType? - extkey type (extPrivkey or extPubkey)
 */
export interface CreateExtkeyFromSeedRequest {
    seed: string;
    network: string;
    extkeyType?: string;
}

/**
 * Request data for creating extkey.
 * @property {string} network - network type (mainnet, testnet or regtest)
 * @property {string} extkeyType? - extkey type (extPrivkey or extPubkey)
 * @property {string} parentKey? - parent key
 * @property {string} parentFingerprint? - parent key's fingerprint.
 * @property {string} key - key hex. (pubkey or privkey)
 * @property {number} depth - depth
 * @property {string} chainCode - chain code
 * @property {number} childNumber - bip32 child number.
 * @property {boolean} hardened? - hardened flag. (true is extPrivkey only.)
 */
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

/**
 * Response of creating extkey.
 * @property {string} extkey - extkey
 */
export interface CreateExtkeyResponse {
    extkey: string;
}

/**
 * Request data for creating extpubkey from extprivkey.
 * @property {string} extkey - extkey
 * @property {string} network - network type (mainnet, testnet or regtest)
 */
export interface CreateExtPubkeyRequest {
    extkey: string;
    network: string;
}

/**
 * Request data for creating keypair.
 * @property {boolean} wif - Set the privkey format to wif.
 * @property {string} network? - network type (mainnet, testnet or regtest)
 * @property {boolean} isCompressed? - pubkey compressed flag
 */
export interface CreateKeyPairRequest {
    wif: boolean;
    network?: string;
    isCompressed?: boolean;
}

/**
 * Response data of creating keypair.
 * @property {string} privkey - privkey
 * @property {string} pubkey - pubkey
 */
export interface CreateKeyPairResponse {
    privkey: string;
    pubkey: string;
}

/**
 * Request for create multisig address and script
 * @property {number} nrequired - require signature num.
 * @property {string[]} keys - pubkey list
 * @property {boolean} isElements? - elements mode flag.
 * @property {string} network - network type (bitcoin:'mainnet, testnet, regtest'. elements:'liquidv1, regtest')
 * @property {string} hashType - hash type (p2sh, p2wsh, p2sh-p2wsh)
 */
export interface CreateMultisigRequest {
    nrequired: number;
    keys: string[];
    isElements?: boolean;
    network: string;
    hashType: string;
}

/**
 * Response of create multisig address and script
 * @property {string} address - address
 * @property {string} redeemScript? - (required for P2SH or P2SH-P2WSH) redeem script for unlocking script
 * @property {string} witnessScript? - (required for P2WSH or P2SH-P2WSH) witness script for witness stack
 */
export interface CreateMultisigResponse {
    address: string;
    redeemScript?: string;
    witnessScript?: string;
}

/**
 * Request for creating multisig's scriptsig.
 * @property {PubkeySignData[]} signParams? - pubkey signature data.
 * @property {string} redeemScript - multisig script
 */
export interface CreateMultisigScriptSigRequest {
    signParams?: PubkeySignData[];
    redeemScript: string;
}

/**
 * Request data. If unlock pegin tx, sign to p2wpkh or p2wsh format.
 * @property {string} fedpegscript - fedpeg script (fedpegscript comes from 'getsidechaininfo' rpc command.)
 * @property {string} pubkey - pubkey related to unlocking peg-in utxo. (This field is only available when lockingScript is empty.)
 * @property {string} redeemScript? - default is empty. set claim script to direct.
 * @property {string} network? - network type. (mainnet, testnet or regtest)
 * @property {string} hashType? - hash type (p2wsh, p2sh-p2wsh, p2sh)
 */
export interface CreatePegInAddressRequest {
    fedpegscript: string;
    pubkey: string;
    redeemScript?: string;
    network?: string;
    hashType?: string;
}

/**
 * Response data of creating pegin address.
 * @property {string} mainchainAddress - mainchain address
 * @property {string} claimScript - claim script.
 * @property {string} tweakFedpegscript - tweaked fedpeg script
 */
export interface CreatePegInAddressResponse {
    mainchainAddress: string;
    claimScript: string;
    tweakFedpegscript: string;
}

/**
 * Request for create pegin transaction
 * @property {number} version? - transaction version
 * @property {number} locktime? - locktime
 * @property {ElementsPeginTxIn[]} txins - Pegin's txin data
 * @property {ElementsTxOut[]} txouts? - adding txout data
 * @property {ElementsTxOutFee} fee? - Transaction fee data.
 * @property {boolean} isRandomSortTxOut? - txout random sort after adding transaction
 */
export interface CreateRawPeginRequest {
    version?: number;
    locktime?: number;
    txins: ElementsPeginTxIn[];
    txouts?: ElementsTxOut[];
    fee?: ElementsTxOutFee;
    isRandomSortTxOut?: boolean;
}

/**
 * Request for create pegout transaction
 * @property {number} version? - transaction version
 * @property {number} locktime? - locktime
 * @property {TxInRequest[]} txins? - The data added to the transaction input.
 * @property {ElementsTxOut[]} txouts? - adding txout data
 * @property {ElementsPegoutTxOut} pegout - pegout txout
 * @property {ElementsTxOutFee} fee? - fee data
 */
export interface CreateRawPegoutRequest {
    version?: number;
    locktime?: number;
    txins?: TxInRequest[];
    txouts?: ElementsTxOut[];
    pegout: ElementsPegoutTxOut;
    fee?: ElementsTxOutFee;
}

/**
 * Response of create pegout transaction.
 * @property {string} hex - transaction hex
 */
export interface CreateRawPegoutResponse {
    hex: string;
    btcAddress?: string;
}

/**
 * Request for create transaction
 * @property {number} version? - transaction version
 * @property {number} locktime? - locktime
 * @property {TxInRequest[]} txins? - The data added to the transaction input.
 * @property {TxOutRequest[]} txouts? - The data added to the transaction output.
 */
export interface CreateRawTransactionRequest {
    version?: number;
    locktime?: number;
    txins?: TxInRequest[];
    txouts?: TxOutRequest[];
}

/**
 * Request for creating script.
 * @property {string[]} items - item array accepts string of op_code, binary hex or number
 */
export interface CreateScriptRequest {
    items: string[];
}

/**
 * Request for create signature hash.
 * @property {string} tx - transaction hex
 * @property {CreateSignatureHashTxInRequest} txin - txin data
 */
export interface CreateSignatureHashRequest {
    tx: string;
    txin: CreateSignatureHashTxInRequest;
}

/**
 * Response of create signature hash.
 * @property {string} sighash - sighash
 */
export interface CreateSignatureHashResponse {
    sighash: string;
}

/**
 * txin data
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {HashKeyData} keyData - key data
 * @property {bigint | number} amount - satoshi amount
 * @property {string} hashType - hash type (p2wpkh, p2wsh, p2pkh, p2sh, p2sh-p2wpkh, p2sh-p2wsh)
 * @property {string} sighashType? - signature hash type. (all, none, single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 */
export interface CreateSignatureHashTxInRequest {
    txid: string;
    vout: number;
    keyData: HashKeyData;
    amount: bigint | number;
    hashType: string;
    sighashType?: string;
    sighashAnyoneCanPay?: boolean;
}

/**
 * Request for decode base58
 * @property {string} data - base58 data
 * @property {boolean} hasChecksum? - use checksum mode.
 */
export interface DecodeBase58Request {
    data: string;
    hasChecksum?: boolean;
}

/**
 * Response of decode base58
 * @property {string} hex - decoded data byte hex
 */
export interface DecodeBase58Response {
    hex: string;
}

/**
 * Request for decode signature.
 * @property {string} signature - der signature
 */
export interface DecodeDerSignatureToRawRequest {
    signature: string;
}

/**
 * locking script data
 * @property {string} asm? - script asm string
 * @property {string} hex? - script hex
 * @property {number} reqSigs? - require signature num
 * @property {string} type? - script type
 * @property {string[]} addresses? - address list
 */
export interface DecodeLockingScript {
    asm?: string;
    hex?: string;
    reqSigs?: number;
    type?: string;
    addresses?: string[];
}

/**
 * Request for decode transaction.
 * @property {string} hex - transaction hex
 * @property {string} network? - network type
 * @property {boolean} iswitness? - dump witness (unused)
 */
export interface DecodeRawTransactionRequest {
    hex: string;
    network?: string;
    iswitness?: boolean;
}

/**
 * @property {string} txid - txid
 * @property {string} hash - transaction hash (txid or wtxid)
 * @property {number} version - transaction version
 * @property {number} size - transaction size
 * @property {number} vsize - transaction vsize
 * @property {number} weight - weight
 * @property {number} locktime - locktime
 * @property {DecodeRawTransactionTxIn[]} vin? - decode txin data
 * @property {DecodeRawTransactionTxOut[]} vout? - txout data
 */
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

/**
 * decode txin data
 * @property {string} coinbase? - coinbase flag (coinbase is only)
 * @property {string} txid? - utxo txid
 * @property {number} vout? - utxo vout
 * @property {DecodeUnlockingScript} scriptSig? - scriptsig
 * @property {string[]} txinwitness? - txin witness stack
 * @property {number} sequence? - sequence number
 */
export interface DecodeRawTransactionTxIn {
    coinbase?: string;
    txid?: string;
    vout?: number;
    scriptSig?: DecodeUnlockingScript;
    txinwitness?: string[];
    sequence?: number;
}

/**
 * txout data
 * @property {bigint} value? - satoshi amount
 * @property {number} n - vout number
 * @property {DecodeLockingScript} scriptPubKey? - locking script
 */
export interface DecodeRawTransactionTxOut {
    value?: bigint;
    n: number;
    scriptPubKey?: DecodeLockingScript;
}

/**
 * script data
 * @property {string} asm - script asm string
 * @property {string} hex - script hex
 */
export interface DecodeUnlockingScript {
    asm: string;
    hex: string;
}

/**
 * @property {string} keyType - contain key type (pubkey, extPubkey, extPrivkey)
 * @property {string} key - key value (hex or base58)
 */
export interface DescriptorKeyJson {
    keyType: string;
    key: string;
}

/**
 * descriptor item.
 * @property {number} depth - descriptor depth
 * @property {string} lockingScript - locking script
 * @property {string} address - address
 * @property {string} hashType - hash type (p2wpkh, p2wsh, p2pkh, p2sh, p2sh-p2wpkh, p2sh-p2wsh)
 * @property {string} redeemScript? - redeem script for script hash. (This field is only available when hashType is p2wsh, p2sh, or p2sh-p2wsh.)
 * @property {string} keyType? - contain key type (pubkey, extPubkey, extPrivkey)
 * @property {string} key? - key value (hex or base58) (This field is only available when hashType is p2wpkh, p2pkh, or p2pk.)
 * @property {DescriptorKeyJson[]} keys? - keys included in multisig
 * @property {number} reqNum? - number of required signatures to solve multisig script.
 */
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

/**
 * Pegin's witness stack
 * @property {bigint | number} amount - pegin amount
 * @property {string} asset - pegin asset
 * @property {string} mainchainGenesisBlockHash - mainchain genesis block hash.
 * @property {string} claimScript - claim script
 * @property {string} mainchainRawTransaction - mainchain transaction hex
 * @property {string} mainchainTxoutproof - mainchain txoutproof
 */
export interface ElementsAddPeginWitness {
    amount: bigint | number;
    asset: string;
    mainchainGenesisBlockHash: string;
    claimScript: string;
    mainchainRawTransaction: string;
    mainchainTxoutproof: string;
}

/**
 * Request for adding transaction
 * @property {string} tx - transaction hex
 * @property {TxInRequest[]} txins? - The data added to the transaction input.
 * @property {ElementsPeginTxIn[]} peginTxins? - Pegin's txin data
 * @property {ElementsTxOut[]} txouts? - adding txout data
 * @property {ElementsDestroyAmount[]} destroyAmountTxouts? - adding destroy amount txout data
 * @property {ElementsPegoutTxOut[]} pegoutTxouts? - adding pegout txout data
 * @property {ElementsTxOutFee} fee? - Transaction fee data.
 * @property {boolean} isRandomSortTxOut? - txout random sort after adding transaction
 */
export interface ElementsAddRawTransactionRequest {
    tx: string;
    txins?: TxInRequest[];
    peginTxins?: ElementsPeginTxIn[];
    txouts?: ElementsTxOut[];
    destroyAmountTxouts?: ElementsDestroyAmount[];
    pegoutTxouts?: ElementsPegoutTxOut[];
    fee?: ElementsTxOutFee;
    isRandomSortTxOut?: boolean;
}

/**
 * Response of adding transaction.
 * @property {string} hex - transaction hex
 * @property {string[]} btcAddresses? - pegout address list.
 */
export interface ElementsAddRawTransactionResponse {
    hex: string;
    btcAddresses?: string[];
}

/**
 * Request for create transaction
 * @property {number} version? - transaction version
 * @property {number} locktime? - locktime
 * @property {TxInRequest[]} txins? - The data added to the transaction input.
 * @property {ElementsTxOut[]} txouts? - adding txout data
 * @property {ElementsTxOutFee} fee? - fee data
 */
export interface ElementsCreateRawTransactionRequest {
    version?: number;
    locktime?: number;
    txins?: TxInRequest[];
    txouts?: ElementsTxOut[];
    fee?: ElementsTxOutFee;
}

/**
 * issuance data
 * @property {string} assetBlindingNonce - utxo asset blinder
 * @property {string} assetEntropy - asset entropy
 * @property {string} contractHash? - issue original entropy data.
 * @property {boolean} isreissuance - reissuance flag
 * @property {string} token? - token asset
 * @property {string} asset? - issued asset
 * @property {bigint} assetamount? - issued satoshi amount
 * @property {string} assetamountcommitment? - issued amountcommitment
 * @property {bigint} tokenamount? - token amount
 * @property {string} tokenamountcommitment? - token amountcommitment
 * @property {string} assetRangeproof? - asset rangeproof (Displayed only when the full dump option is used.)
 * @property {string} tokenRangeproof? - token rangeproof (Displayed only when the full dump option is used.)
 */
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

/**
 * locking script data
 * @property {string} asm? - script asm string
 * @property {string} hex? - script hex
 * @property {number} reqSigs? - require signature num
 * @property {string} type - script type
 * @property {string[]} addresses? - address list
 * @property {string} pegout_chain? - pegout chain hex
 * @property {string} pegout_asm? - pegout script asm string
 * @property {string} pegout_hex? - pegout script hex
 * @property {number} pegout_reqSigs? - pegout require signature num
 * @property {string} pegout_type? - pegout script type
 * @property {string[]} pegout_addresses? - pegout address list
 */
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

/**
 * Request for decode transaction.
 * @property {string} hex - transaction hex
 * @property {string} network? - elements network type (liquidv1, regtest)
 * @property {string} mainchainNetwork? - mainchain network type (mainnet, testnet, regtest or blank. Must be set for pegout transactions.)
 * @property {boolean} iswitness? - dump witness (unused)
 * @property {boolean} fullDump? - tx data all dump option.
 */
export interface ElementsDecodeRawTransactionRequest {
    hex: string;
    network?: string;
    mainchainNetwork?: string;
    iswitness?: boolean;
    fullDump?: boolean;
}

/**
 * Response of decode transaction.
 * @property {string} txid - txid
 * @property {string} hash - transaction hash
 * @property {string} wtxid - witness txid
 * @property {string} withash - withash
 * @property {number} version - transaction version
 * @property {number} size - transaction size
 * @property {number} vsize - transaction vsize
 * @property {number} weight - weight
 * @property {number} locktime - locktime
 * @property {ElementsDecodeRawTransactionTxIn[]} vin? - decode txin data
 * @property {ElementsDecodeRawTransactionTxOut[]} vout? - txout data
 */
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

/**
 * decode txin data
 * @property {string} coinbase? - coinbase flag (coinbase is only)
 * @property {string} txid? - utxo txid
 * @property {number} vout? - utxo vout
 * @property {DecodeUnlockingScript} scriptSig? - scriptsig
 * @property {boolean} is_pegin? - pegin flag
 * @property {bigint} sequence? - sequence number
 * @property {string[]} txinwitness? - txin witness stack
 * @property {string[]} pegin_witness? - pegin witness stack
 * @property {ElementsDecodeIssuance} issuance? - issuance data
 */
export interface ElementsDecodeRawTransactionTxIn {
    coinbase?: string;
    txid?: string;
    vout?: number;
    scriptSig?: DecodeUnlockingScript;
    is_pegin?: boolean;
    sequence?: bigint;
    txinwitness?: string[];
    pegin_witness?: string[];
    issuance?: ElementsDecodeIssuance;
}

/**
 * txout data
 * @property {bigint} value? - satoshi amount
 * @property {bigint} 'value-minimum?' - blind minimum value
 * @property {bigint} 'value-maximum?' - blind maximum value
 * @property {number} 'ct-exponent?' - blinding exponent
 * @property {number} 'ct-bits?' - blinding bits
 * @property {string} surjectionproof? - surjectionproof
 * @property {string} valuecommitment? - valuecommitment
 * @property {string} asset? - asset
 * @property {string} assetcommitment? - assetcommitment
 * @property {string} commitmentnonce? - confidentialKey or commitmentnonce
 * @property {boolean} commitmentnonce_fully_valid? - valid nonce
 * @property {number} n - vout number
 * @property {ElementsDecodeLockingScript} scriptPubKey? - locking script
 * @property {string} rangeproof? - value rangeproof (Displayed only when the full dump option is used.)
 */
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

/**
 * adding destroy amount txout data
 * @property {bigint | number} amount - satoshi amount
 * @property {string} asset - asset
 * @property {string} directNonce? - nonce for confidential key
 */
export interface ElementsDestroyAmount {
    amount: bigint | number;
    asset: string;
    directNonce?: string;
}

/**
 * Pegin's txin data
 * @property {boolean} isPegin? - pegin flag
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {number} sequence? - sequence number
 * @property {ElementsAddPeginWitness} peginwitness - pegin witness data
 * @property {boolean} isRemoveMainchainTxWitness? - (deprecated) remove mainchain txhex's witness data. (It is necessary to set true for Elements v0.18 or higher.)
 */
export interface ElementsPeginTxIn {
    isPegin?: boolean;
    txid: string;
    vout: number;
    sequence?: number;
    peginwitness: ElementsAddPeginWitness;
    isRemoveMainchainTxWitness?: boolean;
}

/**
 * adding pegout txout data
 * @property {bigint | number} amount - satoshi amount
 * @property {string} asset - asset
 * @property {string} network - mainchain network type (mainnet, testnet or regtest)
 * @property {string} elementsNetwork - elements network type (liquidv1, regtest)
 * @property {string} mainchainGenesisBlockHash - mainchain genesis block hash
 * @property {string} btcAddress? - bitcoin address
 * @property {string} onlinePubkey - online pubkey.
 * @property {string} masterOnlineKey - master online privkey.
 * @property {string} bitcoinDescriptor - output descriptor for pegout
 * @property {number} bip32Counter - descriptor's bip32 counter.
 * @property {string} whitelist - whitelist
 */
export interface ElementsPegoutTxOut {
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

/**
 * adding txout data
 * @property {string} address - address
 * @property {bigint | number} amount - satoshi amount
 * @property {string} asset - asset
 * @property {string} directLockingScript? - locking script
 * @property {string} directNonce? - nonce for confidential key
 * @property {boolean} isRemoveNonce? - remove nonce flag
 */
export interface ElementsTxOut {
    address: string;
    amount: bigint | number;
    asset: string;
    directLockingScript?: string;
    directNonce?: string;
    isRemoveNonce?: boolean;
}

/**
 * Transaction fee data.
 * @property {bigint | number} amount - satoshi amount
 * @property {string} asset - asset
 */
export interface ElementsTxOutFee {
    amount: bigint | number;
    asset: string;
}

/**
 * Request for encode base58
 * @property {string} hex - base58 target byte hex
 */
export interface EncodeBase58Request {
    hex: string;
    hasChecksum?: boolean;
}

/**
 * Response of encode base58
 * @property {string} data - encoded data
 */
export interface EncodeBase58Response {
    data: string;
}

/**
 * Request for encode signature.
 * @property {string} signature - signature
 * @property {string} sighashType - sighash type (all, none, single)
 * @property {boolean} sighashAnyoneCanPay? - sighash anyone can pay
 */
export interface EncodeSignatureByDerRequest {
    signature: string;
    sighashType: string;
    sighashAnyoneCanPay?: boolean;
}

/**
 * Response of encode signature.
 * @property {string} signature - encoded signature
 */
export interface EncodeSignatureByDerResponse {
    signature: string;
}

/**
 * Error response base interface
 * @property {InnerErrorResponse} error - Inner error information
 */
export interface ErrorResponse {
    error: InnerErrorResponse;
}

/**
 * Request for estimate fee
 * @property {SelectUtxoData[]} selectUtxos? - Select utxo
 * @property {number} feeRate - network fee rate
 * @property {string} tx - transaction hex
 * @property {boolean} isElements? - elements transaction flag. (require when you set the transaction field)
 * @property {boolean} isBlind? - blind flag (This field is available only elements.)
 * @property {string} feeAsset? - fee asset (This field is available only elements.)
 * @property {number} exponent? - blind exponent. (This field is available only elements.)
 * @property {number} minimumBits? - blind minimum bits. (This field is available only elements.)
 */
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
 * Response of estimate fee
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

/**
 * Request for extract secret data on ecdsa adaptor.
 * @property {string} adaptorSignature - adaptor signature hex.
 * @property {string} signature - signature hex.
 * @property {string} adaptor - adaptor pubkey
 */
export interface ExtractSecretEcdsaAdaptorRequest {
    adaptorSignature: string;
    signature: string;
    adaptor: string;
}

/**
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {string} reason - error reason.
 */
export interface FailSignTxIn {
    txid: string;
    vout: number;
    reason: string;
}

/**
 * target amount data
 * @property {string} asset - target asset
 * @property {bigint | number} amount - Amount more than the specified amount is set in txout. default is 0 (disable).
 * @property {string} reserveAddress - This address use when append TxOut. Also serves as a change address. (This field is available only bitcoin.)
 */
export interface FundAmountMapData {
    asset: string;
    amount: bigint | number;
    reserveAddress: string;
}

/**
 * fee information
 * @property {number} feeRate - network fee rate
 * @property {number} longTermFeeRate? - network long-term fee rate
 * @property {bigint | number} knapsackMinChange? - knapsack minimum change amount. (knapsack logic's threshold. Recommended value is 1.)
 * @property {number} dustFeeRate? - excess amount to include in the fee
 * @property {string} feeAsset? - fee asset (This field is available only elements.)
 * @property {boolean} isBlindEstimateFee? - calculate fee on blinding tx (This field is available only elements.)
 * @property {number} exponent? - blind exponent (This field is available only elements.)
 * @property {number} minimumBits? - blind minimum bits (This field is available only elements.)
 */
export interface FundFeeInformation {
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
 * Request data for fund transaction.
 * @property {FundUtxoJsonData[]} utxos - utxo data.
 * @property {FundSelectUtxoData[]} selectUtxos? - Txin's utxo data.
 * @property {string} tx - transaction hex
 * @property {boolean} isElements? - elements transaction flag. (require when you set the transaction field)
 * @property {string} network? - network type. (bitcoin:'mainnet, testnet, regtest'. elements:'liquidv1, regtest')
 * @property {bigint | number} targetAmount? - Amount more than the specified amount is set in txout. default is 0 (disable). (This field is available only bitcoin.)
 * @property {string} reserveAddress? - This address use when append TxOut. Also serves as a change address. (This field is available only bitcoin.)
 * @property {FundAmountMapData[]} targets? - target amount data
 * @property {FundFeeInformation} feeInfo? - fee information
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
    feeInfo?: FundFeeInformation;
}

/**
 * Response data of fund transaction.
 * @property {string} hex - transaction hex
 * @property {string[]} usedAddresses? - This address list was used to add TxOut.
 * @property {bigint} feeAmount? - fee amount.
 */
export interface FundRawTransactionResponse {
    hex: string;
    usedAddresses?: string[];
    feeAmount?: bigint;
}

/**
 * Txin's utxo data.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {string} address - address
 * @property {bigint | number} amount - satoshi amount.
 * @property {string} asset? - asset id. (This field is available only elements utxo.)
 * @property {string} redeemScript? - redeem script (This field is available only p2sh or p2wsh.)
 * @property {string} descriptor? - output descriptor. (descriptor is required, you needs to consider fee amount)
 * @property {boolean} isIssuance? - use issuance (This field is available only elements.)
 * @property {boolean} isBlindIssuance? - use issuance's blind (This field is available only elements.)
 * @property {boolean} isPegin? - use pegin (This field is available only elements.)
 * @property {number} peginBtcTxSize? - pegin's btc transaction size (This field is available only elements.)
 * @property {string} fedpegScript? - fedpeg script (This field is available only elements.)
 * @property {string} scriptSigTemplate? - ScriptSig template is for scriptHash calculation fee.
 */
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
 * utxo data.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {string} address - address
 * @property {bigint | number} amount - satoshi amount.
 * @property {string} asset? - asset id. (This field is available only elements utxo.)
 * @property {string} descriptor? - output descriptor. (descriptor is required, you needs to consider fee amount)
 * @property {string} scriptSigTemplate? - ScriptSig template is for scriptHash calculation fee.
 */
export interface FundUtxoJsonData {
    txid: string;
    vout: number;
    address: string;
    amount: bigint | number;
    asset?: string;
    descriptor?: string;
    scriptSigTemplate?: string;
}

/**
 * Request for get addresses from multisig script.
 * @property {boolean} isElements? - elements transaction flag.
 * @property {string} redeemScript - redeem script on multisig
 * @property {string} network? - network type (bitcoin:'mainnet, testnet, regtest'. elements:'liquidv1, regtest')
 * @property {string} hashType? - hash type. (p2wpkh, p2pkh, p2sh-p2wpkh)
 */
export interface GetAddressesFromMultisigRequest {
    isElements?: boolean;
    redeemScript: string;
    network?: string;
    hashType?: string;
}

/**
 * Response of get addresses from multisig script.
 * @property {string[]} addresses - address list
 * @property {string[]} pubkeys - pubkey list
 * @property {number} requireNum - multisig script's require signature num.
 */
export interface GetAddressesFromMultisigResponse {
    addresses: string[];
    pubkeys: string[];
    requireNum: number;
}

/**
 * Request for get address information.
 * @property {string} address - address text
 * @property {boolean} isElements? - elements transaction flag.
 */
export interface GetAddressInfoRequest {
    address: string;
    isElements?: boolean;
}

/**
 * Response of get address information.
 * @property {string} lockingScript - locking script
 * @property {string} network - network type (bitcoin:'mainnet, testnet, regtest'. elements:'liquidv1, regtest')
 * @property {string} hashType - hash type (p2wpkh, p2pkh, p2wsh, p2sh(contain p2sh-segwit))
 * @property {number} witnessVersion? - witness version. (none:field empty, versionX:X(0 - 16))
 * @property {string} hash? - pubkey-hash or script-hash. p2wsh:32byte, other:20byte
 */
export interface GetAddressInfoResponse {
    lockingScript: string;
    network: string;
    hashType: string;
    witnessVersion?: number;
    hash?: string;
}

/**
 * Request for get commitment.
 * @property {bigint | number} amount - satoshi amount
 * @property {string} asset - asset
 * @property {string} assetBlindFactor - asset blind factor
 * @property {string} blindFactor - amount blind factor
 */
export interface GetCommitmentRequest {
    amount: bigint | number;
    asset: string;
    assetBlindFactor: string;
    blindFactor: string;
}

/**
 * Response of get commitment.
 * @property {string} assetCommitment - asset commitment
 * @property {string} amountCommitment - amount commitment
 */
export interface GetCommitmentResponse {
    assetCommitment: string;
    amountCommitment: string;
}

/**
 * Request for get confidential address.
 * @property {string} unblindedAddress - unblinded address
 * @property {string} key - confidential key
 */
export interface GetConfidentialAddressRequest {
    unblindedAddress: string;
    key: string;
}

/**
 * Response of get confidential address.
 * @property {string} confidentialAddress - confidential address
 */
export interface GetConfidentialAddressResponse {
    confidentialAddress: string;
}

/**
 * Request for get default blinding key.
 * @property {string} masterBlindingKey - master blinding key
 * @property {string} lockingScript? - locking script
 * @property {string} address? - use if empty locking script.
 */
export interface GetDefaultBlindingKeyRequest {
    masterBlindingKey: string;
    lockingScript?: string;
    address?: string;
}

/**
 * Request extkey.
 * @property {string} extkey - extkey
 */
export interface GetExtkeyInfoRequest {
    extkey: string;
}

/**
 * Response of get extkey information.
 * @property {string} network - network type
 * @property {string} version - version information
 * @property {number} depth - depth
 * @property {string} fingerprint - fingerprint
 * @property {number} childNumber - bip32 child number
 * @property {string} chainCode - chain code
 */
export interface GetExtkeyInfoResponse {
    network: string;
    version: string;
    depth: number;
    fingerprint: string;
    childNumber: number;
    chainCode: string;
}

/**
 * Request for get issuance blinding key.
 * @property {string} masterBlindingKey - master blinding key
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 */
export interface GetIssuanceBlindingKeyRequest {
    masterBlindingKey: string;
    txid: string;
    vout: number;
}

/**
 * Request for get mnemonic word list
 * @property {string} language - mnemonic language (support [en es fr it jp zhs zht])
 */
export interface GetMnemonicWordlistRequest {
    language: string;
}

/**
 * Response of get mnemonic word list
 * @property {string[]} wordlist - mnemonic word list
 */
export interface GetMnemonicWordlistResponse {
    wordlist: string[];
}

/**
 * Request for get privkey from extkey
 * @property {string} extkey - extkey
 * @property {string} network - network type (mainnet, testnet or regtest)
 * @property {boolean} wif - use wallet import format
 * @property {boolean} isCompressed? - compressed flag
 */
export interface GetPrivkeyFromExtkeyRequest {
    extkey: string;
    network: string;
    wif: boolean;
    isCompressed?: boolean;
}

/**
 * Response of get privkey from extkey
 * @property {string} privkey - privkey (wif or hex)
 */
export interface GetPrivkeyFromExtkeyResponse {
    privkey: string;
}

/**
 * Request for get pubkey from extkey.
 * @property {string} extkey - extkey
 * @property {string} network - network type (mainnet, testnet or regtest)
 */
export interface GetPubkeyFromExtkeyRequest {
    extkey: string;
    network: string;
}

/**
 * Request for get pubkey from privkey.
 * @property {string} privkey - privkey (wif or hex)
 * @property {boolean} isCompressed? - compressed pubkey flag
 */
export interface GetPubkeyFromPrivkeyRequest {
    privkey: string;
    isCompressed?: boolean;
}

/**
 * Request to get a Schnorr pubkey from privkey.
 * @property {string} privkey - privkey (wif or hex)
 */
export interface GetSchnorrPubkeyFromPrivkeyRequest {
    privkey: string;
}

/**
 * Request for get supported function.
 * @property {boolean} bitcoin - bitcoin support flag
 * @property {boolean} elements - elements support flag
 */
export interface GetSupportedFunctionResponse {
    bitcoin: boolean;
    elements: boolean;
}

/**
 * Request for get unblinded address.
 * @property {string} confidentialAddress - confidential address
 */
export interface GetUnblindedAddressRequest {
    confidentialAddress: string;
}

/**
 * Response of get unblinded address.
 * @property {string} unblindedAddress - unblinded address
 * @property {string} confidentialKey - confidential key
 */
export interface GetUnblindedAddressResponse {
    unblindedAddress: string;
    confidentialKey: string;
}

/**
 * Request for get witness stack count.
 * @property {string} tx - transaction hex
 * @property {boolean} isElements? - elements transaction flag.
 * @property {TxInRequest} txin - target txin
 */
export interface GetWitnessStackNumRequest {
    tx: string;
    isElements?: boolean;
    txin: TxInRequest;
}

/** @property {number} count - witness stack count */
export interface GetWitnessStackNumResponse {
    count: number;
}

/**
 * Hash data based key
 * @property {string} hex - hex data
 * @property {string} type - data type. (pubkey or redeem_script)
 */
export interface HashKeyData {
    hex: string;
    type: string;
}

/**
 * Inner error information
 * @property {number} code - require
 * @property {string} type - require
 * @property {string} message - error message
 */
export interface InnerErrorResponse {
    code: number;
    type: string;
    message: string;
}

/**
 * issuance data
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {bigint | number} assetAmount - asset amount
 * @property {string} assetAddress - send asset address
 * @property {bigint | number} tokenAmount - token amount
 * @property {string} tokenAddress - send token address
 * @property {boolean} isBlind? - blind issue/reissue
 * @property {string} contractHash? - contract hash
 * @property {boolean} isRemoveNonce? - remove nonce flag.
 */
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

/**
 * issuance data
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {string} asset - issued asset
 * @property {string} entropy - issuance entropy
 * @property {string} token? - token asset
 */
export interface IssuanceDataResponse {
    txid: string;
    vout: number;
    asset: string;
    entropy: string;
    token?: string;
}

/**
 * The data containing output descriptor.
 * @property {string} descriptor - output descriptor.
 */
export interface OutputDescriptorResponse {
    descriptor: string;
}

/**
 * privkey data.
 * @property {string} privkey - privkey hex
 */
export interface OutputPrivkeyData {
    privkey: string;
}

/**
 * Request for parse output descriptor.
 * @property {boolean} isElements? - elements flag.
 * @property {string} descriptor - output descriptor
 * @property {string} network? - network type (bitcoin:'mainnet, testnet, regtest'. elements:'liquidv1, regtest')
 * @property {string} bip32DerivationPath? - bip32 derive path
 */
export interface ParseDescriptorRequest {
    isElements?: boolean;
    descriptor: string;
    network?: string;
    bip32DerivationPath?: string;
}

/**
 * Response of parse output descriptor.
 * @property {string} type - descriptor type.
 * @property {string} address? - address (This field is only available for types other than `raw`.)
 * @property {string} lockingScript - locking script
 * @property {string} hashType? - hash type (p2wpkh, p2wsh, p2pkh, p2sh, p2sh-p2wpkh, p2sh-p2wsh)
 * @property {string} redeemScript? - redeem script on script hash. (This field is only available when hashType is p2wsh, p2sh, or p2sh-p2wsh.)
 * @property {boolean} includeMultisig - multisig flag (whether multisig descriptor is included in scripts stack)
 * @property {DescriptorScriptJson[]} scripts? - descriptor item.
 */
export interface ParseDescriptorResponse {
    type: string;
    address?: string;
    lockingScript: string;
    hashType?: string;
    redeemScript?: string;
    includeMultisig: boolean;
    scripts?: DescriptorScriptJson[];
}

/**
 * Request for parse script
 * @property {string} script - script hex.
 */
export interface ParseScriptRequest {
    script: string;
}

/**
 * Response of parse script
 * @property {string[]} scriptItems - parse script item. (First level's item only)
 */
export interface ParseScriptResponse {
    scriptItems: string[];
}

/**
 * private key data.
 * @property {string} privkey - private key. set is wif or hex.
 * @property {boolean} wif? - use wif flag. true is wif, false is hex.
 * @property {string} network? - wif network type. (mainnet, testnet or regtest)
 * @property {boolean} isCompressed? - wif compressed flag
 */
export interface PrivkeyData {
    privkey: string;
    wif?: boolean;
    network?: string;
    isCompressed?: boolean;
}

/**
 * Response of get privkey from wif.
 * @property {string} hex - privkey hex.
 * @property {string} network - network type (mainnet, testnet or regtest)
 * @property {boolean} isCompressed - compressed pubkey flag
 */
export interface PrivkeyHexData {
    hex: string;
    network: string;
    isCompressed: boolean;
}

/**
 * Request for get privkey from wif.
 * @property {string} wif - Wallet Import Format
 */
export interface PrivkeyWifData {
    wif: string;
}

/**
 * Response pubkey data.
 * @property {string} pubkey - pubkey
 */
export interface PubkeyData {
    pubkey: string;
}

/**
 * pubkey list data
 * @property {string[]} pubkeys - public key list
 */
export interface PubkeyListData {
    pubkeys: string[];
}

/**
 * pubkey signature data.
 * @property {string} hex - signature hex.
 * @property {string} type? - parameter type. (sign only)
 * @property {boolean} derEncode? - der encode option flag
 * @property {string} sighashType? - signature hash type. (all, none or single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 * @property {string} relatedPubkey? - a pubkey related to signature.
 */
export interface PubkeySignData {
    hex: string;
    type?: string;
    derEncode?: boolean;
    sighashType?: string;
    sighashAnyoneCanPay?: boolean;
    relatedPubkey?: string;
}

/**
 * The output transaction data.
 * @property {string} hex - transaction hex.
 */
export interface RawTransactionResponse {
    hex: string;
}

/**
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {bigint | number} amount - asset amount
 * @property {string} address - send asset address
 * @property {string} assetBlindingNonce - utxo asset blinder
 * @property {string} assetEntropy - issuance entropy
 * @property {boolean} isRemoveNonce? - remove nonce flag.
 */
export interface ReissuanceDataRequest {
    txid: string;
    vout: number;
    amount: bigint | number;
    address: string;
    assetBlindingNonce: string;
    assetEntropy: string;
    isRemoveNonce?: boolean;
}

/**
 * schnorr pubkey data.
 * @property {string} pubkey - schnorr public key
 * @property {boolean} parity - y-parity flag
 * @property {string} privkey - privkey hex
 */
export interface SchnorrKeyPairData {
    pubkey: string;
    parity: boolean;
    privkey: string;
}

/**
 * Schnorr pubkey data.
 * @property {string} pubkey - schnorr public key
 * @property {boolean} parity - y-parity flag
 */
export interface SchnorrPubkeyData {
    pubkey: string;
    parity: boolean;
}

/** Request for creating a Schnorr signature. */
export interface SchnorrSignRequest {
    privkey: string;
    message: string;
    isHashed?: boolean;
    nonceOrAux: string;
    isNonce?: boolean;
}

/**
 * Contains the generated Schnorr signature.
 * @property {string} hex - signature hex.
 */
export interface SchnorrSignResponse {
    hex: string;
}

/** Request for creating a Schnorr signature. */
export interface SchnorrVerifyRequest {
    pubkey: string;
    message: string;
    isHashed?: boolean;
    signature: string;
}

/**
 * Contains the validation result
 * @property {boolean} valid - whether the signature is valid.
 */
export interface SchnorrVerifyResponse {
    valid: boolean;
}

/** The data containing script. */
export interface ScriptDataResponse {
    hex: string;
}

/**
 * Response of extract secret.
 * @property {string} secret - secret data
 */
export interface SecretData {
    secret: string;
}

/**
 * Select utxo
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {string} asset? - asset (This field is available only elements utxo.)
 * @property {string} redeemScript? - redeem script (This field is available only p2sh or p2wsh.)
 * @property {string} descriptor? - output descriptor (descriptor is required, you needs to consider fee amount)
 * @property {boolean} isIssuance? - issuance flag (This field is available only elements.)
 * @property {boolean} isBlindIssuance? - blind issuance flag. (This field is available only elements.)
 * @property {boolean} isPegin? - use pegin utxo. (This field is available only elements.)
 * @property {bigint | number} peginBtcTxSize? - pegin btc transaction size (This field is available only elements.)
 * @property {string} fedpegScript? - fedpeg script (This field is available only elements.)
 * @property {string} scriptSigTemplate? - ScriptSig template is for scriptHash calculation fee.
 */
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

/**
 * Request data for selecting utxo.
 * @property {UtxoJsonData[]} utxos - utxo data.
 * @property {bigint | number} targetAmount? - Amount more than the specified amount is set in txout. default is 0 (disable). (This field is available only bitcoin.)
 * @property {boolean} isElements? - elements transaction flag.
 * @property {TargetAmountMapData[]} targets? - target amount data.
 * @property {CoinSelectionFeeInformationField} feeInfo? - fee information.
 */
export interface SelectUtxosRequest {
    utxos: UtxoJsonData[];
    targetAmount?: bigint | number;
    isElements?: boolean;
    targets?: TargetAmountMapData[];
    feeInfo?: CoinSelectionFeeInformationField;
}

/**
 * Response data of selecting utxo.
 * @property {UtxoJsonData[]} utxos - utxo list.
 * @property {bigint} selectedAmount? - selected amount.
 * @property {TargetAmountMapData[]} selectedAmounts? - target amount data.
 * @property {bigint} feeAmount? - fee amount. (This field is available only searched by BnB algorithm.)
 * @property {bigint} utxoFeeAmount - utxo's fee amount.
 */
export interface SelectUtxosResponse {
    utxos: UtxoJsonData[];
    selectedAmount?: bigint;
    selectedAmounts?: TargetAmountMapData[];
    feeAmount?: bigint;
    utxoFeeAmount: bigint;
}

/**
 * Request for serialize ledger format.
 * @property {string} tx - transaction hex
 * @property {SerializeLedgerFormatTxOut[]} txouts? - Txout data.
 * @property {boolean} skipWitness? - skip witness flag.
 * @property {boolean} isAuthorization - authorization flag.
 */
export interface SerializeLedgerFormatRequest {
    tx: string;
    txouts?: SerializeLedgerFormatTxOut[];
    skipWitness?: boolean;
    isAuthorization: boolean;
}

/**
 * Response of serialize ledger format.
 * @property {string} serialize - (unused) serialized value.
 * @property {string} sha256 - sha256 hashed value.
 */
export interface SerializeLedgerFormatResponse {
    serialize: string;
    sha256: string;
}

/**
 * Txout data.
 * @property {number} index - txout index
 * @property {string} asset - asset
 * @property {bigint | number} amount - satoshi amount
 */
export interface SerializeLedgerFormatTxOut {
    index: number;
    asset: string;
    amount: bigint | number;
}

/**
 * Request for set issue asset.
 * @property {string} tx - transaction hex
 * @property {boolean} isRandomSortTxOut? - txout random sort after adding transaction
 * @property {IssuanceDataRequest[]} issuances - issuance data
 */
export interface SetRawIssueAssetRequest {
    tx: string;
    isRandomSortTxOut?: boolean;
    issuances: IssuanceDataRequest[];
}

/**
 * Response of set issue asset.
 * @property {string} hex - transaction hex
 * @property {IssuanceDataResponse[]} issuances - issuance data
 */
export interface SetRawIssueAssetResponse {
    hex: string;
    issuances: IssuanceDataResponse[];
}

/**
 * Request for set reissue asset.
 * @property {string} tx - transaction hex
 * @property {boolean} isRandomSortTxOut? - txout random sort after adding transaction
 * @property {ReissuanceDataRequest[]} issuances - reissuance txin data
 */
export interface SetRawReissueAssetRequest {
    tx: string;
    isRandomSortTxOut?: boolean;
    issuances: ReissuanceDataRequest[];
}

/**
 * Response of set reissue asset.
 * @property {string} hex - transaction hex
 * @property {IssuanceDataResponse[]} issuances - issuance data
 */
export interface SetRawReissueAssetResponse {
    hex: string;
    issuances: IssuanceDataResponse[];
}

/**
 * The data containing signature.
 * @property {string} signature - signature
 */
export interface SignatureDataResponse {
    signature: string;
}

/**
 * The sign data.
 * @property {string} hex - If the type is auto or op_code, character string input is enabled. Others are hex byte array only.
 * @property {string} type? - parameter type. (binary, sign)
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
 * Request for sign on ecdsa adaptor
 * @property {string} message - message data. (32-byte hash, or text message.)
 * @property {boolean} isHashed? - is 32-byte hashed message.
 * @property {string} privkey - private key.
 * @property {string} adaptor - adaptor public key.
 */
export interface SignEcdsaAdaptorRequest {
    message: string;
    isHashed?: boolean;
    privkey: string;
    adaptor: string;
}

/**
 * Response of sign on ecdsa adaptor
 * @property {string} adaptorSignature - adaptor signature hex.
 * @property {string} proof - adaptor proof.
 */
export interface SignEcdsaAdaptorResponse {
    adaptorSignature: string;
    proof: string;
}

/**
 * Request for add sign with privkey
 * @property {boolean} isElements? - elements transaction flag.
 * @property {string} tx - transaction hex
 */
export interface SignWithPrivkeyRequest {
    isElements?: boolean;
    tx: string;
    txin?: SignWithPrivkeyTxInRequest;
}

/**
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {string} privkey - private key. hex or wif format.
 * @property {string} pubkey? - public key. if empty, generate from privkey.
 * @property {string} hashType - hash type (p2pkh, p2wpkh or p2sh-p2wpkh)
 * @property {string} sighashType? - signature hash type. (all, none or single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 * @property {bigint | number} amount? - satoshi amount (need either amount or confidentialValueCommitment)
 * @property {string} confidentialValueCommitment? - value commitment. (need either amount or confidentialValueCommitment)
 * @property {boolean} isGrindR? - grind-R flag
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
 * target amount data.
 * @property {string} asset? - target asset.
 * @property {bigint | number} amount - Amount more than the specified amount is set in txout. default is 0 (disable).
 */
export interface TargetAmountMapData {
    asset?: string;
    amount: bigint | number;
}

/**
 * tweak privkey data
 * @property {string} privkey - privkey (wif or hex)
 * @property {string} tweak - 32-byte tweak data
 */
export interface TweakPrivkeyData {
    privkey: string;
    tweak: string;
}

/**
 * tweak pubkey data
 * @property {string} pubkey - public key
 * @property {string} tweak - 32-byte tweak data
 */
export interface TweakPubkeyData {
    pubkey: string;
    tweak: string;
}

/**
 * The data added to the transaction input.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {number} sequence? - sequence number.
 */
export interface TxInRequest {
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
export interface TxOutRequest {
    address: string;
    amount: bigint | number;
    directLockingScript?: string;
}

/**
 * issuance blinding key data
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {string} assetBlindingKey? - asset blinding key
 * @property {string} tokenBlindingKey? - token blinding key
 */
export interface UnblindIssuance {
    txid: string;
    vout: number;
    assetBlindingKey?: string;
    tokenBlindingKey?: string;
}

/**
 * unblind issuance data
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {string} asset? - asset
 * @property {bigint} assetamount? - asset amount
 * @property {string} token? - token
 * @property {bigint} tokenamount? - token amount
 * @property {string} assetValueBlindFactor? - asset amount blind factor
 * @property {string} tokenValueBlindFactor? - token amount blind factor
 */
export interface UnblindIssuanceOutput {
    txid: string;
    vout: number;
    asset?: string;
    assetamount?: bigint;
    token?: string;
    tokenamount?: bigint;
    assetValueBlindFactor?: string;
    tokenValueBlindFactor?: string;
}

/**
 * unblind txout
 * @property {number} index - vout
 * @property {string} asset - asset
 * @property {string} blindFactor - amount blind factor
 * @property {string} assetBlindFactor - asset blind factor
 * @property {bigint} amount - satoshi amount
 */
export interface UnblindOutput {
    index: number;
    asset: string;
    blindFactor: string;
    assetBlindFactor: string;
    amount: bigint;
}

/**
 * Request for unblind transaction.
 * @property {string} tx - transaction hex
 * @property {UnblindTxOut[]} txouts? - txout list
 * @property {UnblindIssuance[]} issuances? - issuance blinding key data
 */
export interface UnblindRawTransactionRequest {
    tx: string;
    txouts?: UnblindTxOut[];
    issuances?: UnblindIssuance[];
}

/**
 * Response of unblind transaction.
 * @property {string} hex - unblinded transaction hex
 * @property {UnblindOutput[]} outputs? - unblind txout
 * @property {UnblindIssuanceOutput[]} issuanceOutputs? - unblind issuance data
 */
export interface UnblindRawTransactionResponse {
    hex: string;
    outputs?: UnblindOutput[];
    issuanceOutputs?: UnblindIssuanceOutput[];
}

/**
 * @property {number} index - vout
 * @property {string} blindingKey - blinding key
 */
export interface UnblindTxOut {
    index: number;
    blindingKey: string;
}

/**
 * target txout
 * @property {bigint | number} amount - satoshi amount
 * @property {number} index? - txout index
 * @property {string} address? - target address (top only)
 * @property {string} directLockingScript? - target locking script (top only)
 */
export interface UpdateTxOutAmountData {
    amount: bigint | number;
    index?: number;
    address?: string;
    directLockingScript?: string;
}

/**
 * Request for update txout amount.
 * @property {string} tx - transaction hex
 * @property {boolean} isElements? - elements transaction flag.
 * @property {UpdateTxOutAmountData[]} txouts - target txout
 */
export interface UpdateTxOutAmountRequest {
    tx: string;
    isElements?: boolean;
    txouts: UpdateTxOutAmountData[];
}

/**
 * Request for update witness stack
 * @property {string} tx - transaction hex
 * @property {boolean} isElements? - elements transaction flag.
 * @property {UpdateWitnessStackTxInRequest} txin - target txin
 */
export interface UpdateWitnessStackRequest {
    tx: string;
    isElements?: boolean;
    txin: UpdateWitnessStackTxInRequest;
}

/**
 * update target txin
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {WitnessStackData} witnessStack - witness stack
 */
export interface UpdateWitnessStackTxInRequest {
    txid: string;
    vout: number;
    witnessStack: WitnessStackData;
}

/**
 * utxo data.
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {bigint | number} amount - satoshi amount.
 * @property {string} asset? - asset id. (This field is available only elements utxo.)
 * @property {string} descriptor? - output descriptor. (descriptor is required, you needs to consider fee amount)
 * @property {string} scriptSigTemplate? - ScriptSig template is for scriptHash calculation fee.
 */
export interface UtxoJsonData {
    txid: string;
    vout: number;
    amount: bigint | number;
    asset?: string;
    descriptor?: string;
    scriptSigTemplate?: string;
}

/**
 * Request for verify signature
 * @property {string} adaptorSignature - adaptor signature hex.
 * @property {string} proof - adaptor proof.
 * @property {string} adaptor - adaptor public key.
 * @property {string} message - message data. (32-byte hash, or text message.)
 * @property {boolean} isHashed? - is 32-byte hashed message.
 * @property {string} pubkey - public key.
 */
export interface VerifyEcdsaAdaptorRequest {
    adaptorSignature: string;
    proof: string;
    adaptor: string;
    message: string;
    isHashed?: boolean;
    pubkey: string;
}

/**
 * Request for verify signature
 * @property {string} tx - transaction hex
 * @property {boolean} isElements? - elements transaction flag.
 * @property {VerifySignatureTxInRequest} txin - txin data
 */
export interface VerifySignatureRequest {
    tx: string;
    isElements?: boolean;
    txin: VerifySignatureTxInRequest;
}

/** @property {boolean} success - verify result (true only. If it fails, an error is thrown.) */
export interface VerifySignatureResponse {
    success: boolean;
}

/**
 * @property {string} txid - utxo txid.
 * @property {number} vout - utxo vout.
 * @property {string} signature - signature
 * @property {string} pubkey - The pubkey associated with the signature.
 * @property {string} redeemScript? - The pubkey associated with the signature. (hashType is p2sh or p2wsh)
 * @property {string} hashType - hash type. (p2pkh, p2sh, p2wpkh, p2wsh)
 * @property {string} sighashType? - signature hash type. (all, none, single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 * @property {bigint | number} amount? - satoshi amount (Only when using witness. Need either amount or confidentialValueCommitment)
 * @property {string} confidentialValueCommitment? - value commitment (Only when using witness. Need either amount or confidentialValueCommitment)
 */
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
 * Request data for verification
 * @property {string} tx - transaction hex
 * @property {boolean} isElements? - elements transaction flag.
 * @property {VerifySignTxInUtxoData[]} txins - target txin list
 */
export interface VerifySignRequest {
    tx: string;
    isElements?: boolean;
    txins: VerifySignTxInUtxoData[];
}

/**
 * Response data of verification
 * @property {boolean} success - verification result
 * @property {FailSignTxIn[]} failTxins? - failed txin list
 */
export interface VerifySignResponse {
    success: boolean;
    failTxins?: FailSignTxIn[];
}

/**
 * @property {string} txid - utxo txid
 * @property {number} vout - utxo vout
 * @property {string} address - address
 * @property {bigint | number} amount - satoshi amount
 * @property {string} descriptor? - output descriptor. (descriptor is required, you needs to consider fee amount)
 * @property {string} confidentialValueCommitment? - elements value commitment.
 */
export interface VerifySignTxInUtxoData {
    txid: string;
    vout: number;
    address: string;
    amount: bigint | number;
    descriptor?: string;
    confidentialValueCommitment?: string;
}

/**
 * @property {number} index - stack index
 * @property {string} hex - update data
 * @property {string} type? - parameter type. (binary, sign, pubkey, redeem_script)
 * @property {boolean} derEncode? - der encode option flag. Valid when type is auto or sign.
 * @property {string} sighashType? - signature hash type. (all, none, single)
 * @property {boolean} sighashAnyoneCanPay? - sighashType anyone can pay flag.
 */
export interface WitnessStackData {
    index: number;
    hex: string;
    type?: string;
    derEncode?: boolean;
    sighashType?: string;
    sighashAnyoneCanPay?: boolean;
}

/**
 * Adapt signature on ecdsa adaptor.
 * @param {AdaptEcdsaAdaptorRequest} jsonObject - request data.
 * @return {SignatureDataResponse} - response data.
 */
export function AdaptEcdsaAdaptor(jsonObject: AdaptEcdsaAdaptorRequest): SignatureDataResponse;

/**
 * Add multisig signatures to the transaction.
 * @param {AddMultisigSignRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function AddMultisigSign(jsonObject: AddMultisigSignRequest): RawTransactionResponse;

/**
 * Add a signature and pubkey to the transaction.
 * @param {AddPubkeyHashSignRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function AddPubkeyHashSign(jsonObject: AddPubkeyHashSignRequest): RawTransactionResponse;

/**
 * Add tx inputs and tx outputs to the transaction.
 * @param {AddRawTransactionRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function AddRawTransaction(jsonObject: AddRawTransactionRequest): RawTransactionResponse;

/**
 * Add a signature and redeem script to the transaction.
 * @param {AddScriptHashSignRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function AddScriptHashSign(jsonObject: AddScriptHashSignRequest): RawTransactionResponse;

/**
 * Add a sign data to the transaction.
 * @param {AddSignRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function AddSign(jsonObject: AddSignRequest): RawTransactionResponse;

/**
 * Get output descriptor added checksum.
 * @param {AppendDescriptorChecksumRequest} jsonObject - request data.
 * @return {OutputDescriptorResponse} - response data.
 */
export function AppendDescriptorChecksum(jsonObject: AppendDescriptorChecksumRequest): OutputDescriptorResponse;

/**
 * blind the transaction.
 * @param {BlindRawTransactionRequest} jsonObject - request data.
 * @return {BlindTransactionResponse} - response data.
 */
export function BlindRawTransaction(jsonObject: BlindRawTransactionRequest): BlindTransactionResponse;

/**
 * calculate ec signature.
 * @param {CalculateEcSignatureRequest} jsonObject - request data.
 * @return {SignatureDataResponse} - response data.
 */
export function CalculateEcSignature(jsonObject: CalculateEcSignatureRequest): SignatureDataResponse;

/**
 * check tweakadd schnorr pubkey.
 * @param {CheckTweakedSchnorrPubkeyRequest} jsonObject - request data.
 * @return {VerifySignatureResponse} - response data.
 */
export function CheckTweakedSchnorrPubkey(jsonObject: CheckTweakedSchnorrPubkeyRequest): VerifySignatureResponse;

/**
 * Combine pubkey.
 * @param {PubkeyListData} jsonObject - request data.
 * @return {PubkeyData} - response data.
 */
export function CombinePubkey(jsonObject: PubkeyListData): PubkeyData;

/**
 * compute sigpoint on schnorr pubkey.
 * @param {ComputeSigPointRequest} jsonObject - request data.
 * @return {PubkeyData} - response data.
 */
export function ComputeSigPointSchnorrPubkey(jsonObject: ComputeSigPointRequest): PubkeyData;

/**
 * Encode/Decode AES.
 * @param {ConvertAesRequest} jsonObject - request data.
 * @return {ConvertAesResponse} - response data.
 */
export function ConvertAes(jsonObject: ConvertAesRequest): ConvertAesResponse;

/**
 * Get mnemonic from entropy.
 * @param {ConvertEntropyToMnemonicRequest} jsonObject - request data.
 * @return {ConvertEntropyToMnemonicResponse} - response data.
 */
export function ConvertEntropyToMnemonic(jsonObject: ConvertEntropyToMnemonicRequest): ConvertEntropyToMnemonicResponse;

/**
 * Get seed from mnemonic.
 * @param {ConvertMnemonicToSeedRequest} jsonObject - request data.
 * @return {ConvertMnemonicToSeedResponse} - response data.
 */
export function ConvertMnemonicToSeed(jsonObject: ConvertMnemonicToSeedRequest): ConvertMnemonicToSeedResponse;

/**
 * Create address.
 * @param {CreateAddressRequest} jsonObject - request data.
 * @return {CreateAddressResponse} - response data.
 */
export function CreateAddress(jsonObject: CreateAddressRequest): CreateAddressResponse;

/**
 * create output descriptor.
 * @param {CreateDescriptorRequest} jsonObject - request data.
 * @return {OutputDescriptorResponse} - response data.
 */
export function CreateDescriptor(jsonObject: CreateDescriptorRequest): OutputDescriptorResponse;

/**
 * Create destroy amount transaction
 * @param {CreateDestroyAmountRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function CreateDestroyAmount(jsonObject: CreateDestroyAmountRequest): RawTransactionResponse;

/**
 * Create signature hash.
 * @param {CreateElementsSignatureHashRequest} jsonObject - request data.
 * @return {CreateSignatureHashResponse} - response data.
 */
export function CreateElementsSignatureHash(jsonObject: CreateElementsSignatureHashRequest): CreateSignatureHashResponse;

/**
 * Create extkey.
 * @param {CreateExtkeyRequest} jsonObject - request data.
 * @return {CreateExtkeyResponse} - response data.
 */
export function CreateExtkey(jsonObject: CreateExtkeyRequest): CreateExtkeyResponse;

/**
 * Create extkey from parent.
 * @param {CreateExtkeyFromParentRequest} jsonObject - request data.
 * @return {CreateExtkeyResponse} - response data.
 */
export function CreateExtkeyFromParent(jsonObject: CreateExtkeyFromParentRequest): CreateExtkeyResponse;

/**
 * Create extkey from parent's key.
 * @param {CreateExtkeyFromParentKeyRequest} jsonObject - request data.
 * @return {CreateExtkeyResponse} - response data.
 */
export function CreateExtkeyFromParentKey(jsonObject: CreateExtkeyFromParentKeyRequest): CreateExtkeyResponse;

/**
 * Create extkey from parent with path.
 * @param {CreateExtkeyFromParentPathRequest} jsonObject - request data.
 * @return {CreateExtkeyResponse} - response data.
 */
export function CreateExtkeyFromParentPath(jsonObject: CreateExtkeyFromParentPathRequest): CreateExtkeyResponse;

/**
 * Create extkey from seed.
 * @param {CreateExtkeyFromSeedRequest} jsonObject - request data.
 * @return {CreateExtkeyResponse} - response data.
 */
export function CreateExtkeyFromSeed(jsonObject: CreateExtkeyFromSeedRequest): CreateExtkeyResponse;

/**
 * Create extpubkey.
 * @param {CreateExtPubkeyRequest} jsonObject - request data.
 * @return {CreateExtkeyResponse} - response data.
 */
export function CreateExtPubkey(jsonObject: CreateExtPubkeyRequest): CreateExtkeyResponse;

/**
 * Create keypair.
 * @param {CreateKeyPairRequest} jsonObject - request data.
 * @return {CreateKeyPairResponse} - response data.
 */
export function CreateKeyPair(jsonObject: CreateKeyPairRequest): CreateKeyPairResponse;

/**
 * Create multisig address and script
 * @param {CreateMultisigRequest} jsonObject - request data.
 * @return {CreateMultisigResponse} - response data.
 */
export function CreateMultisig(jsonObject: CreateMultisigRequest): CreateMultisigResponse;

/**
 * Create multisig's scriptsig
 * @param {CreateMultisigScriptSigRequest} jsonObject - request data.
 * @return {ScriptDataResponse} - response data.
 */
export function CreateMultisigScriptSig(jsonObject: CreateMultisigScriptSigRequest): ScriptDataResponse;

/**
 * create pegin address.
 * @param {CreatePegInAddressRequest} jsonObject - request data.
 * @return {CreatePegInAddressResponse} - response data.
 */
export function CreatePegInAddress(jsonObject: CreatePegInAddressRequest): CreatePegInAddressResponse;

/**
 * Create pegin transaction
 * @param {CreateRawPeginRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function CreateRawPegin(jsonObject: CreateRawPeginRequest): RawTransactionResponse;

/**
 * Create pegout transaction
 * @param {CreateRawPegoutRequest} jsonObject - request data.
 * @return {CreateRawPegoutResponse} - response data.
 */
export function CreateRawPegout(jsonObject: CreateRawPegoutRequest): CreateRawPegoutResponse;

/**
 * Create transaction
 * @param {CreateRawTransactionRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function CreateRawTransaction(jsonObject: CreateRawTransactionRequest): RawTransactionResponse;

/**
 * Create script.
 * @param {CreateScriptRequest} jsonObject - request data.
 * @return {ScriptDataResponse} - response data.
 */
export function CreateScript(jsonObject: CreateScriptRequest): ScriptDataResponse;

/**
 * Create signature hash.
 * @param {CreateSignatureHashRequest} jsonObject - request data.
 * @return {CreateSignatureHashResponse} - response data.
 */
export function CreateSignatureHash(jsonObject: CreateSignatureHashRequest): CreateSignatureHashResponse;

/**
 * Decode base58.
 * @param {DecodeBase58Request} jsonObject - request data.
 * @return {DecodeBase58Response} - response data.
 */
export function DecodeBase58(jsonObject: DecodeBase58Request): DecodeBase58Response;

/**
 * Decode der-encoded signature.
 * @param {DecodeDerSignatureToRawRequest} jsonObject - request data.
 * @return {SignatureDataResponse} - response data.
 */
export function DecodeDerSignatureToRaw(jsonObject: DecodeDerSignatureToRawRequest): SignatureDataResponse;

/**
 * Decode transaction
 * @param {DecodeRawTransactionRequest} jsonObject - request data.
 * @return {DecodeRawTransactionResponse} - response data.
 */
export function DecodeRawTransaction(jsonObject: DecodeRawTransactionRequest): DecodeRawTransactionResponse;

/**
 * Add raw transaction.
 * @param {ElementsAddRawTransactionRequest} jsonObject - request data.
 * @return {ElementsAddRawTransactionResponse} - response data.
 */
export function ElementsAddRawTransaction(jsonObject: ElementsAddRawTransactionRequest): ElementsAddRawTransactionResponse;

/**
 * Create transaction for Elements.
 * @param {ElementsCreateRawTransactionRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function ElementsCreateRawTransaction(jsonObject: ElementsCreateRawTransactionRequest): RawTransactionResponse;

/**
 * Decode Elements transaction
 * @param {ElementsDecodeRawTransactionRequest} jsonObject - request data.
 * @return {ElementsDecodeRawTransactionResponse} - response data.
 */
export function ElementsDecodeRawTransaction(jsonObject: ElementsDecodeRawTransactionRequest): ElementsDecodeRawTransactionResponse;

/**
 * encode base58
 * @param {EncodeBase58Request} jsonObject - request data.
 * @return {EncodeBase58Response} - response data.
 */
export function EncodeBase58(jsonObject: EncodeBase58Request): EncodeBase58Response;

/**
 * Encode signature by der.
 * @param {EncodeSignatureByDerRequest} jsonObject - request data.
 * @return {EncodeSignatureByDerResponse} - response data.
 */
export function EncodeSignatureByDer(jsonObject: EncodeSignatureByDerRequest): EncodeSignatureByDerResponse;

/**
 * Estimate fee.
 * @param {EstimateFeeRequest} jsonObject - request data.
 * @return {EstimateFeeResponse} - response data.
 */
export function EstimateFee(jsonObject: EstimateFeeRequest): EstimateFeeResponse;

/**
 * Extract secret data on ecdsa adaptor.
 * @param {ExtractSecretEcdsaAdaptorRequest} jsonObject - request data.
 * @return {SecretData} - response data.
 */
export function ExtractSecretEcdsaAdaptor(jsonObject: ExtractSecretEcdsaAdaptorRequest): SecretData;

/**
 * Fund transaction.
 * @param {FundRawTransactionRequest} jsonObject - request data.
 * @return {FundRawTransactionResponse} - response data.
 */
export function FundRawTransaction(jsonObject: FundRawTransactionRequest): FundRawTransactionResponse;

/**
 * Get addresses from multisig script.
 * @param {GetAddressesFromMultisigRequest} jsonObject - request data.
 * @return {GetAddressesFromMultisigResponse} - response data.
 */
export function GetAddressesFromMultisig(jsonObject: GetAddressesFromMultisigRequest): GetAddressesFromMultisigResponse;

/**
 * Get address information.
 * @param {GetAddressInfoRequest} jsonObject - request data.
 * @return {GetAddressInfoResponse} - response data.
 */
export function GetAddressInfo(jsonObject: GetAddressInfoRequest): GetAddressInfoResponse;

/**
 * Get commitment.
 * @param {GetCommitmentRequest} jsonObject - request data.
 * @return {GetCommitmentResponse} - response data.
 */
export function GetCommitment(jsonObject: GetCommitmentRequest): GetCommitmentResponse;

/**
 * Get compressed pubkey.
 * @param {PubkeyData} jsonObject - request data.
 * @return {PubkeyData} - response data.
 */
export function GetCompressedPubkey(jsonObject: PubkeyData): PubkeyData;

/**
 * Get confidential address.
 * @param {GetConfidentialAddressRequest} jsonObject - request data.
 * @return {GetConfidentialAddressResponse} - response data.
 */
export function GetConfidentialAddress(jsonObject: GetConfidentialAddressRequest): GetConfidentialAddressResponse;

/**
 * Get default blinding key.
 * @param {GetDefaultBlindingKeyRequest} jsonObject - request data.
 * @return {BlindingKeyResponse} - response data.
 */
export function GetDefaultBlindingKey(jsonObject: GetDefaultBlindingKeyRequest): BlindingKeyResponse;

/**
 * Get extkey information.
 * @param {GetExtkeyInfoRequest} jsonObject - request data.
 * @return {GetExtkeyInfoResponse} - response data.
 */
export function GetExtkeyInfo(jsonObject: GetExtkeyInfoRequest): GetExtkeyInfoResponse;

/**
 * Get issuance blinding key.
 * @param {GetIssuanceBlindingKeyRequest} jsonObject - request data.
 * @return {BlindingKeyResponse} - response data.
 */
export function GetIssuanceBlindingKey(jsonObject: GetIssuanceBlindingKeyRequest): BlindingKeyResponse;

/**
 * Get mnemonic word list
 * @param {GetMnemonicWordlistRequest} jsonObject - request data.
 * @return {GetMnemonicWordlistResponse} - response data.
 */
export function GetMnemonicWordlist(jsonObject: GetMnemonicWordlistRequest): GetMnemonicWordlistResponse;

/**
 * Get privkey from extkey.
 * @param {GetPrivkeyFromExtkeyRequest} jsonObject - request data.
 * @return {GetPrivkeyFromExtkeyResponse} - response data.
 */
export function GetPrivkeyFromExtkey(jsonObject: GetPrivkeyFromExtkeyRequest): GetPrivkeyFromExtkeyResponse;

/**
 * Get privkey from wif.
 * @param {PrivkeyWifData} jsonObject - request data.
 * @return {PrivkeyHexData} - response data.
 */
export function GetPrivkeyFromWif(jsonObject: PrivkeyWifData): PrivkeyHexData;

/**
 * Get privkey on wif.
 * @param {PrivkeyHexData} jsonObject - request data.
 * @return {PrivkeyWifData} - response data.
 */
export function GetPrivkeyWif(jsonObject: PrivkeyHexData): PrivkeyWifData;

/**
 * Get pubkey from extkey.
 * @param {GetPubkeyFromExtkeyRequest} jsonObject - request data.
 * @return {PubkeyData} - response data.
 */
export function GetPubkeyFromExtkey(jsonObject: GetPubkeyFromExtkeyRequest): PubkeyData;

/**
 * Get pubkey from privkey.
 * @param {GetPubkeyFromPrivkeyRequest} jsonObject - request data.
 * @return {PubkeyData} - response data.
 */
export function GetPubkeyFromPrivkey(jsonObject: GetPubkeyFromPrivkeyRequest): PubkeyData;

/**
 * Get a Schnorr pubkey from a privkey.
 * @param {GetSchnorrPubkeyFromPrivkeyRequest} jsonObject - request data.
 * @return {SchnorrPubkeyData} - response data.
 */
export function GetSchnorrPubkeyFromPrivkey(jsonObject: GetSchnorrPubkeyFromPrivkeyRequest): SchnorrPubkeyData;

/**
 * get schnorr pubkey from pubkey.
 * @param {PubkeyData} jsonObject - request data.
 * @return {SchnorrPubkeyData} - response data.
 */
export function GetSchnorrPubkeyFromPubkey(jsonObject: PubkeyData): SchnorrPubkeyData;

/**
 * Get supported function.
 * @return {GetSupportedFunctionResponse} - response data.
 */
export function GetSupportedFunction(): GetSupportedFunctionResponse;

/**
 * Get unblinded address.
 * @param {GetUnblindedAddressRequest} jsonObject - request data.
 * @return {GetUnblindedAddressResponse} - response data.
 */
export function GetUnblindedAddress(jsonObject: GetUnblindedAddressRequest): GetUnblindedAddressResponse;

/**
 * Get uncompressed pubkey.
 * @param {PubkeyData} jsonObject - request data.
 * @return {PubkeyData} - response data.
 */
export function GetUncompressedPubkey(jsonObject: PubkeyData): PubkeyData;

/**
 * Get witness stack count.
 * @param {GetWitnessStackNumRequest} jsonObject - request data.
 * @return {GetWitnessStackNumResponse} - response data.
 */
export function GetWitnessStackNum(jsonObject: GetWitnessStackNumRequest): GetWitnessStackNumResponse;

/**
 * Negate privkey.
 * @param {PrivkeyData} jsonObject - request data.
 * @return {OutputPrivkeyData} - response data.
 */
export function NegatePrivkey(jsonObject: PrivkeyData): OutputPrivkeyData;

/**
 * Negate pubkey.
 * @param {PubkeyData} jsonObject - request data.
 * @return {PubkeyData} - response data.
 */
export function NegatePubkey(jsonObject: PubkeyData): PubkeyData;

/**
 * Parse output descriptor.
 * @param {ParseDescriptorRequest} jsonObject - request data.
 * @return {ParseDescriptorResponse} - response data.
 */
export function ParseDescriptor(jsonObject: ParseDescriptorRequest): ParseDescriptorResponse;

/**
 * Parse script from hex.
 * @param {ParseScriptRequest} jsonObject - request data.
 * @return {ParseScriptResponse} - response data.
 */
export function ParseScript(jsonObject: ParseScriptRequest): ParseScriptResponse;

/**
 * Create a Schnorr signature for a given message
 * @param {SchnorrSignRequest} jsonObject - request data.
 * @return {SchnorrSignResponse} - response data.
 */
export function SchnorrSign(jsonObject: SchnorrSignRequest): SchnorrSignResponse;

/**
 * Verify a Schnorr signature for a given message
 * @param {SchnorrVerifyRequest} jsonObject - request data.
 * @return {SchnorrVerifyResponse} - response data.
 */
export function SchnorrVerify(jsonObject: SchnorrVerifyRequest): SchnorrVerifyResponse;

/**
 * Select coins.
 * @param {SelectUtxosRequest} jsonObject - request data.
 * @return {SelectUtxosResponse} - response data.
 */
export function SelectUtxos(jsonObject: SelectUtxosRequest): SelectUtxosResponse;

/**
 * Serialize to ledger format.
 * @param {SerializeLedgerFormatRequest} jsonObject - request data.
 * @return {SerializeLedgerFormatResponse} - response data.
 */
export function SerializeLedgerFormat(jsonObject: SerializeLedgerFormatRequest): SerializeLedgerFormatResponse;

/**
 * Set issue asset.
 * @param {SetRawIssueAssetRequest} jsonObject - request data.
 * @return {SetRawIssueAssetResponse} - response data.
 */
export function SetRawIssueAsset(jsonObject: SetRawIssueAssetRequest): SetRawIssueAssetResponse;

/**
 * Set reissue asset.
 * @param {SetRawReissueAssetRequest} jsonObject - request data.
 * @return {SetRawReissueAssetResponse} - response data.
 */
export function SetRawReissueAsset(jsonObject: SetRawReissueAssetRequest): SetRawReissueAssetResponse;

/**
 * sign on ecdsa adaptor.
 * @param {SignEcdsaAdaptorRequest} jsonObject - request data.
 * @return {SignEcdsaAdaptorResponse} - response data.
 */
export function SignEcdsaAdaptor(jsonObject: SignEcdsaAdaptorRequest): SignEcdsaAdaptorResponse;

/**
 * Add sign and set pubkey hash input
 * @param {SignWithPrivkeyRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function SignWithPrivkey(jsonObject: SignWithPrivkeyRequest): RawTransactionResponse;

/**
 * TweakAdd privkey.
 * @param {TweakPrivkeyData} jsonObject - request data.
 * @return {OutputPrivkeyData} - response data.
 */
export function TweakAddPrivkey(jsonObject: TweakPrivkeyData): OutputPrivkeyData;

/**
 * TweakAdd pubkey.
 * @param {TweakPubkeyData} jsonObject - request data.
 * @return {PubkeyData} - response data.
 */
export function TweakAddPubkey(jsonObject: TweakPubkeyData): PubkeyData;

/**
 * TweakAdd schnorr pubkey from privkey.
 * @param {TweakPrivkeyData} jsonObject - request data.
 * @return {SchnorrKeyPairData} - response data.
 */
export function TweakAddSchnorrPubkeyFromPrivkey(jsonObject: TweakPrivkeyData): SchnorrKeyPairData;

/**
 * TweakAdd schnorr pubkey from pubkey.
 * @param {TweakPubkeyData} jsonObject - request data.
 * @return {SchnorrPubkeyData} - response data.
 */
export function TweakAddSchnorrPubkeyFromPubkey(jsonObject: TweakPubkeyData): SchnorrPubkeyData;

/**
 * TweakMul privkey.
 * @param {TweakPrivkeyData} jsonObject - request data.
 * @return {OutputPrivkeyData} - response data.
 */
export function TweakMulPrivkey(jsonObject: TweakPrivkeyData): OutputPrivkeyData;

/**
 * TweakMul pubkey.
 * @param {TweakPubkeyData} jsonObject - request data.
 * @return {PubkeyData} - response data.
 */
export function TweakMulPubkey(jsonObject: TweakPubkeyData): PubkeyData;

/**
 * Unblind transaction.
 * @param {UnblindRawTransactionRequest} jsonObject - request data.
 * @return {UnblindRawTransactionResponse} - response data.
 */
export function UnblindRawTransaction(jsonObject: UnblindRawTransactionRequest): UnblindRawTransactionResponse;

/**
 * Update txout amount.
 * @param {UpdateTxOutAmountRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function UpdateTxOutAmount(jsonObject: UpdateTxOutAmountRequest): RawTransactionResponse;

/**
 * Update witness stack
 * @param {UpdateWitnessStackRequest} jsonObject - request data.
 * @return {RawTransactionResponse} - response data.
 */
export function UpdateWitnessStack(jsonObject: UpdateWitnessStackRequest): RawTransactionResponse;

/**
 * Verify signature on ecdsa adaptor.
 * @param {VerifyEcdsaAdaptorRequest} jsonObject - request data.
 * @return {VerifySignatureResponse} - response data.
 */
export function VerifyEcdsaAdaptor(jsonObject: VerifyEcdsaAdaptorRequest): VerifySignatureResponse;

/**
 * Verify transaction sign. (only pubkey hash or multisig script.)
 * @param {VerifySignRequest} jsonObject - request data.
 * @return {VerifySignResponse} - response data.
 */
export function VerifySign(jsonObject: VerifySignRequest): VerifySignResponse;

/**
 * Verify signature
 * @param {VerifySignatureRequest} jsonObject - request data.
 * @return {VerifySignatureResponse} - response data.
 */
export function VerifySignature(jsonObject: VerifySignatureRequest): VerifySignatureResponse;

/** error class. */
export class CfdError extends Error {
    /**
     * constructor.
     * @param {string} message - Error message.
     * @param {InnerErrorResponse} errorInformation - Error information data.
     * @param {Error} cause - Cause of the error.
     */
    constructor(message: string, errorInformation: InnerErrorResponse, cause: Error);
    /**
     * get error string.
     * @return {string} - string data.
     */
    toString(): string;
    /**
     * get error information.
     * @return {InnerErrorResponse} - InnerErrorResponse data.
     */
    getErrorInformation(): InnerErrorResponse;
    /**
     * get error cause.
     * @return {Error} - Error data.
     */
    getCause(): Error;
}
