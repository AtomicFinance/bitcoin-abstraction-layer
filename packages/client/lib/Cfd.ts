import Client from './Client'
import {
  AddMultisigSignRequest, AddMultisigSignResponse,
  AddPubkeyHashSignRequest, AddPubkeyHashSignResponse,
  AddRawTransactionRequest, AddRawTransactionResponse,
  AddScriptHashSignRequest, AddScriptHashSignResponse,
  AddSignRequest, AddSignResponse,
  AppendDescriptorChecksumRequest, AppendDescriptorChecksumResponse,
  BlindRawTransactionRequest, BlindRawTransactionResponse,
  CalculateEcSignatureRequest, CalculateEcSignatureResponse,
  ConvertAesRequest, ConvertAesResponse,
  ConvertEntropyToMnemonicRequest, ConvertEntropyToMnemonicResponse,
  ConvertMnemonicToSeedRequest, ConvertMnemonicToSeedResponse,
  CreateAddressRequest, CreateAddressResponse,
  CreateDescriptorRequest, CreateDescriptorResponse,
  CreateExtkeyRequest, CreateExtkeyResponse,
  CreateExtkeyFromParentRequest, CreateExtkeyFromParentResponse,
  CreateExtkeyFromParentKeyRequest, CreateExtkeyFromParentKeyResponse,
  CreateExtkeyFromParentPathRequest, CreateExtkeyFromParentPathResponse,
  CreateExtkeyFromSeedRequest, CreateExtkeyFromSeedResponse,
  CreateExtPubkeyRequest, CreateExtPubkeyResponse,
  CreateKeyPairRequest, CreateKeyPairResponse,
  CreateMultisigScriptSigRequest, CreateMultisigScriptSigResponse,
  CreateScriptRequest, CreateScriptResponse,
  DecodeBase58Request, DecodeBase58Response,
  DecodeDerSignatureToRawRequest, DecodeDerSignatureToRawResponse,
  DecodeRawTransactionRequest, DecodeRawTransactionResponse,
  ElementsAddRawTransactionRequest, ElementsAddRawTransactionResponse,
  CreateDestroyAmountRequest, CreateDestroyAmountResponse,
  CreatePegInAddressRequest, CreatePegInAddressResponse,
  CreateRawPeginRequest, CreateRawPeginResponse,
  CreateRawPegoutRequest, CreateRawPegoutResponse,
  ElementsCreateRawTransactionRequest, ElementsCreateRawTransactionResponse,
  ElementsDecodeRawTransactionRequest, ElementsDecodeRawTransactionResponse,
  GetConfidentialAddressRequest, GetConfidentialAddressResponse,
  GetUnblindedAddressRequest, GetUnblindedAddressResponse,
  SetRawIssueAssetRequest, SetRawIssueAssetResponse,
  SetRawReissueAssetRequest, SetRawReissueAssetResponse,
  UnblindRawTransactionRequest, UnblindRawTransactionResponse,
  EncodeBase58Request, EncodeBase58Response,
  EncodeSignatureByDerRequest, EncodeSignatureByDerResponse,
  EstimateFeeRequest, EstimateFeeResponse,
  FundRawTransactionRequest, FundRawTransactionResponse,
  GetAddressInfoRequest, GetAddressInfoResponse,
  GetAddressesFromMultisigRequest, GetAddressesFromMultisigResponse,
  GetCommitmentRequest, GetCommitmentResponse,
  GetCompressedPubkeyRequest, GetCompressedPubkeyResponse,
  GetDefaultBlindingKeyRequest, GetDefaultBlindingKeyResponse,
  GetExtkeyInfoRequest, GetExtkeyInfoResponse,
  GetIssuanceBlindingKeyRequest, GetIssuanceBlindingKeyResponse,
  GetMnemonicWordlistRequest, GetMnemonicWordlistResponse,
  GetPrivkeyFromExtkeyRequest, GetPrivkeyFromExtkeyResponse,
  GetPrivkeyFromWifRequest, GetPrivkeyFromWifResponse,
  GetPrivkeyWifRequest, GetPrivkeyWifResponse,
  GetPubkeyFromExtkeyRequest, GetPubkeyFromExtkeyResponse,
  GetPubkeyFromPrivkeyRequest, GetPubkeyFromPrivkeyResponse,
  GetWitnessStackNumRequest, GetWitnessStackNumResponse,
  CreateMultisigRequest, CreateMultisigResponse,
  ParseDescriptorRequest, ParseDescriptorResponse,
  ParseScriptRequest, ParseScriptResponse,
  SelectUtxosRequest, SelectUtxosResponse,
  SerializeLedgerFormatRequest, SerializeLedgerFormatResponse,
  CreateSignatureHashRequest, CreateSignatureHashResponse,
  CreateElementsSignatureHashRequest, CreateElementsSignatureHashResponse,
  SignWithPrivkeyRequest, SignWithPrivkeyResponse,
  GetSupportedFunctionResponse,
  CreateRawTransactionRequest, CreateRawTransactionResponse,
  UpdateTxOutAmountRequest, UpdateTxOutAmountResponse,
  UpdateWitnessStackRequest, UpdateWitnessStackResponse,
  VerifySignRequest, VerifySignResponse,
  VerifySignatureRequest, VerifySignatureResponse
} from 'cfd-js-wasm'

export default class Cfd {
  client: Client;

  constructor (client?: Client) {
    this.client = client
  }

  async AddMultisigSign(jsonObject: AddMultisigSignRequest): Promise<AddMultisigSignResponse> {
    return this.client.getMethod('AddMultisigSign')(jsonObject)
  }

  async AddPubkeyHashSign(jsonObject: AddPubkeyHashSignRequest): Promise<AddPubkeyHashSignResponse> {
    return this.client.getMethod('AddPubkeyHashSign')(jsonObject)
  }

  async AddRawTransaction(jsonObject: AddRawTransactionRequest): Promise<AddRawTransactionResponse> {
    return this.client.getMethod('AddRawTransaction')(jsonObject)
  }

  async AddScriptHashSign(jsonObject: AddScriptHashSignRequest): Promise<AddScriptHashSignResponse> {
    return this.client.getMethod('AddScriptHashSign')(jsonObject)
  }

  async AddSign(jsonObject: AddSignRequest): Promise<AddSignResponse> {
    return this.client.getMethod('AddSign')(jsonObject)
  }

  async AppendDescriptorChecksum(jsonObject: AppendDescriptorChecksumRequest): Promise<AppendDescriptorChecksumResponse> {
    return this.client.getMethod('AppendDescriptorChecksum')(jsonObject)
  }

  async BlindRawTransaction(jsonObject: BlindRawTransactionRequest): Promise<BlindRawTransactionResponse> {
    return this.client.getMethod('BlindRawTransaction')(jsonObject)
  }

  async CalculateEcSignature(jsonObject: CalculateEcSignatureRequest): Promise<CalculateEcSignatureResponse> {
    return this.client.getMethod('CalculateEcSignature')(jsonObject)
  }

  async ConvertAes(jsonObject: ConvertAesRequest): Promise<ConvertAesResponse> {
    return this.client.getMethod('ConvertAes')(jsonObject)
  }

  async ConvertEntropyToMnemonic(jsonObject: ConvertEntropyToMnemonicRequest): Promise<ConvertEntropyToMnemonicResponse> {
    return this.client.getMethod('ConvertEntropyToMnemonic')(jsonObject)
  }

  async ConvertMnemonicToSeed(jsonObject: ConvertMnemonicToSeedRequest): Promise<ConvertMnemonicToSeedResponse> {
    return this.client.getMethod('ConvertMnemonicToSeed')(jsonObject)
  }

  async CreateAddress(jsonObject: CreateAddressRequest): Promise<CreateAddressResponse> {
    return this.client.getMethod('CreateAddress')(jsonObject)
  }

  async CreateDescriptor(jsonObject: CreateDescriptorRequest): Promise<CreateDescriptorResponse> {
    return this.client.getMethod('CreateDescriptor')(jsonObject)
  }

  async CreateExtkey(jsonObject: CreateExtkeyRequest): Promise<CreateExtkeyResponse> {
    return this.client.getMethod('CreateExtkey')(jsonObject)
  }

  async CreateExtkeyFromParent(jsonObject: CreateExtkeyFromParentRequest): Promise<CreateExtkeyFromParentResponse> {
    return this.client.getMethod('CreateExtkeyFromParent')(jsonObject)
  }

  async CreateExtkeyFromParentKey(jsonObject: CreateExtkeyFromParentKeyRequest): Promise<CreateExtkeyFromParentKeyResponse> {
    return this.client.getMethod('CreateExtkeyFromParentKey')(jsonObject)
  }

  async CreateExtkeyFromParentPath(jsonObject: CreateExtkeyFromParentPathRequest): Promise<CreateExtkeyFromParentPathResponse> {
    return this.client.getMethod('CreateExtkeyFromParentPath')(jsonObject)
  }

  async CreateExtkeyFromSeed(jsonObject: CreateExtkeyFromSeedRequest): Promise<CreateExtkeyFromSeedResponse> {
    return this.client.getMethod('CreateExtkeyFromSeed')(jsonObject)
  }

  async CreateExtPubkey(jsonObject: CreateExtPubkeyRequest): Promise<CreateExtPubkeyResponse> {
    return this.client.getMethod('CreateExtPubkey')(jsonObject)
  }

  async CreateKeyPair(jsonObject: CreateKeyPairRequest): Promise<CreateKeyPairResponse> {
    console.log('test6')

    return this.client.getMethod('CreateKeyPair')(jsonObject)
  }

  async CreateMultisigScriptSig(jsonObject: CreateMultisigScriptSigRequest): Promise<CreateMultisigScriptSigResponse> {
    return this.client.getMethod('CreateMultisigScriptSig')(jsonObject)
  }

  async CreateScript(jsonObject: CreateScriptRequest): Promise<CreateScriptResponse> {
    return this.client.getMethod('CreateScript')(jsonObject)
  }

  async DecodeBase58(jsonObject: DecodeBase58Request): Promise<DecodeBase58Response> {
    return this.client.getMethod('DecodeBase58')(jsonObject)
  }

  async DecodeDerSignatureToRaw(jsonObject: DecodeDerSignatureToRawRequest): Promise<DecodeDerSignatureToRawResponse> {
    return this.client.getMethod('DecodeDerSignatureToRaw')(jsonObject)
  }

  async DecodeRawTransaction(jsonObject: DecodeRawTransactionRequest): Promise<DecodeRawTransactionResponse> {
    return this.client.getMethod('DecodeRawTransaction')(jsonObject)
  }

  async ElementsAddRawTransaction(jsonObject: ElementsAddRawTransactionRequest): Promise<ElementsAddRawTransactionResponse> {
    return this.client.getMethod('ElementsAddRawTransaction')(jsonObject)
  }

  async CreateDestroyAmount(jsonObject: CreateDestroyAmountRequest): Promise<CreateDestroyAmountResponse> {
    return this.client.getMethod('CreateDestroyAmount')(jsonObject)
  }

  async CreatePegInAddress(jsonObject: CreatePegInAddressRequest): Promise<CreatePegInAddressResponse> {
    return this.client.getMethod('CreatePegInAddress')(jsonObject)
  }

  async CreateRawPegin(jsonObject: CreateRawPeginRequest): Promise<CreateRawPeginResponse> {
    return this.client.getMethod('CreateRawPegin')(jsonObject)
  }

  async CreateRawPegout(jsonObject: CreateRawPegoutRequest): Promise<CreateRawPegoutResponse> {
    return this.client.getMethod('CreateRawPegout')(jsonObject)
  }

  async ElementsCreateRawTransaction(jsonObject: ElementsCreateRawTransactionRequest): Promise<ElementsCreateRawTransactionResponse> {
    return this.client.getMethod('ElementsCreateRawTransaction')(jsonObject)
  }

  async ElementsDecodeRawTransaction(jsonObject: ElementsDecodeRawTransactionRequest): Promise<ElementsDecodeRawTransactionResponse> {
    return this.client.getMethod('ElementsDecodeRawTransaction')(jsonObject)
  }

  async GetConfidentialAddress(jsonObject: GetConfidentialAddressRequest): Promise<GetConfidentialAddressResponse> {
    return this.client.getMethod('GetConfidentialAddress')(jsonObject)
  }

  async GetUnblindedAddress(jsonObject: GetUnblindedAddressRequest): Promise<GetUnblindedAddressResponse> {
    return this.client.getMethod('GetUnblindedAddress')(jsonObject)
  }

  async SetRawIssueAsset(jsonObject: SetRawIssueAssetRequest): Promise<SetRawIssueAssetResponse> {
    return this.client.getMethod('SetRawIssueAsset')(jsonObject)
  }

  async SetRawReissueAsset(jsonObject: SetRawReissueAssetRequest): Promise<SetRawReissueAssetResponse> {
    return this.client.getMethod('SetRawReissueAsset')(jsonObject)
  }

  async UnblindRawTransaction(jsonObject: UnblindRawTransactionRequest): Promise<UnblindRawTransactionResponse> {
    return this.client.getMethod('UnblindRawTransaction')(jsonObject)
  }

  async EncodeBase58(jsonObject: EncodeBase58Request): Promise<EncodeBase58Response> {
    return this.client.getMethod('EncodeBase58')(jsonObject)
  }

  async EncodeSignatureByDer(jsonObject: EncodeSignatureByDerRequest): Promise<EncodeSignatureByDerResponse> {
    return this.client.getMethod('EncodeSignatureByDer')(jsonObject)
  }

  async EstimateFee(jsonObject: EstimateFeeRequest): Promise<EstimateFeeResponse> {
    return this.client.getMethod('EstimateFee')(jsonObject)
  }

  async FundRawTransaction(jsonObject: FundRawTransactionRequest): Promise<FundRawTransactionResponse> {
    return this.client.getMethod('FundRawTransaction')(jsonObject)
  }

  async GetAddressInfo(jsonObject: GetAddressInfoRequest): Promise<GetAddressInfoResponse> {
    return this.client.getMethod('GetAddressInfo')(jsonObject)
  }

  async GetAddressesFromMultisig(jsonObject: GetAddressesFromMultisigRequest): Promise<GetAddressesFromMultisigResponse> {
    return this.client.getMethod('GetAddressesFromMultisig')(jsonObject)
  }

  async GetCommitment(jsonObject: GetCommitmentRequest): Promise<GetCommitmentResponse> {
    return this.client.getMethod('GetCommitment')(jsonObject)
  }

  async GetCompressedPubkey(jsonObject: GetCompressedPubkeyRequest): Promise<GetCompressedPubkeyResponse> {
    return this.client.getMethod('GetCompressedPubkey')(jsonObject)
  }

  async GetDefaultBlindingKey(jsonObject: GetDefaultBlindingKeyRequest): Promise<GetDefaultBlindingKeyResponse> {
    return this.client.getMethod('GetDefaultBlindingKey')(jsonObject)
  }

  async GetExtkeyInfo(jsonObject: GetExtkeyInfoRequest): Promise<GetExtkeyInfoResponse> {
    return this.client.getMethod('GetExtkeyInfo')(jsonObject)
  }

  async GetIssuanceBlindingKey(jsonObject: GetIssuanceBlindingKeyRequest): Promise<GetIssuanceBlindingKeyResponse> {
    return this.client.getMethod('GetIssuanceBlindingKey')(jsonObject)
  }

  async GetMnemonicWordlist(jsonObject: GetMnemonicWordlistRequest): Promise<GetMnemonicWordlistResponse> {
    return this.client.getMethod('GetMnemonicWordlist')(jsonObject)
  }

  async GetPrivkeyFromExtkey(jsonObject: GetPrivkeyFromExtkeyRequest): Promise<GetPrivkeyFromExtkeyResponse> {
    return this.client.getMethod('GetPrivkeyFromExtkey')(jsonObject)
  }

  async GetPrivkeyFromWif(jsonObject: GetPrivkeyFromWifRequest): Promise<GetPrivkeyFromWifResponse> {
    return this.client.getMethod('GetPrivkeyFromWif')(jsonObject)
  }

  async GetPrivkeyWif(jsonObject: GetPrivkeyWifRequest): Promise<GetPrivkeyWifResponse> {
    return this.client.getMethod('GetPrivkeyWif')(jsonObject)
  }

  async GetPubkeyFromExtkey(jsonObject: GetPubkeyFromExtkeyRequest): Promise<GetPubkeyFromExtkeyResponse> {
    return this.client.getMethod('GetPubkeyFromExtkey')(jsonObject)
  }

  async GetPubkeyFromPrivkey(jsonObject: GetPubkeyFromPrivkeyRequest): Promise<GetPubkeyFromPrivkeyResponse> {
    return this.client.getMethod('GetPubkeyFromPrivkey')(jsonObject)
  }

  async GetWitnessStackNum(jsonObject: GetWitnessStackNumRequest): Promise<GetWitnessStackNumResponse> {
    return this.client.getMethod('GetWitnessStackNum')(jsonObject)
  }

  async CreateMultisig(jsonObject: CreateMultisigRequest): Promise<CreateMultisigResponse> {
    return this.client.getMethod('CreateMultisig')(jsonObject)
  }

  async ParseDescriptor(jsonObject: ParseDescriptorRequest): Promise<ParseDescriptorResponse> {
    return this.client.getMethod('ParseDescriptor')(jsonObject)
  }

  async ParseScript(jsonObject: ParseScriptRequest): Promise<ParseScriptResponse> {
    return this.client.getMethod('ParseScript')(jsonObject)
  }

  async SelectUtxos(jsonObject: SelectUtxosRequest): Promise<SelectUtxosResponse> {
    return this.client.getMethod('SelectUtxos')(jsonObject)
  }

  async SerializeLedgerFormat(jsonObject: SerializeLedgerFormatRequest): Promise<SerializeLedgerFormatResponse> {
    return this.client.getMethod('SerializeLedgerFormat')(jsonObject)
  }

  async CreateSignatureHash(jsonObject: CreateSignatureHashRequest): Promise<CreateSignatureHashResponse> {
    return this.client.getMethod('CreateSignatureHash')(jsonObject)
  }

  async CreateElementsSignatureHash(jsonObject: CreateElementsSignatureHashRequest): Promise<CreateElementsSignatureHashResponse> {
    return this.client.getMethod('CreateElementsSignatureHash')(jsonObject)
  }

  async SignWithPrivkey(jsonObject: SignWithPrivkeyRequest): Promise<SignWithPrivkeyResponse> {
    return this.client.getMethod('SignWithPrivkey')(jsonObject)
  }

  async GetSupportedFunction(): Promise<GetSupportedFunctionResponse> {
    return this.client.getMethod('GetSupportedFunction')()
  }

  async CreateRawTransaction(jsonObject: CreateRawTransactionRequest): Promise<CreateRawTransactionResponse> {
    return this.client.getMethod('CreateRawTransaction')(jsonObject)
  }

  async UpdateTxOutAmount(jsonObject: UpdateTxOutAmountRequest): Promise<UpdateTxOutAmountResponse> {
    return this.client.getMethod('UpdateTxOutAmount')(jsonObject)
  }

  async UpdateWitnessStack(jsonObject: UpdateWitnessStackRequest): Promise<UpdateWitnessStackResponse> {
    return this.client.getMethod('UpdateWitnessStack')(jsonObject)
  }

  async VerifySign(jsonObject: VerifySignRequest): Promise<VerifySignResponse> {
    return this.client.getMethod('VerifySign')(jsonObject)
  }

  async VerifySignature(jsonObject: VerifySignatureRequest): Promise<VerifySignatureResponse> {
    return this.client.getMethod('VerifySignature')(jsonObject)
  }
}
