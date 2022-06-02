import Provider from '@atomicfinance/provider';
import {
  AddMultisigSignRequest,
  AddMultisigSignResponse,
  AddPubkeyHashSignRequest,
  AddPubkeyHashSignResponse,
  AddRawTransactionRequest,
  AddRawTransactionResponse,
  AddScriptHashSignRequest,
  AddScriptHashSignResponse,
  AddSignRequest,
  AddSignResponse,
  AppendDescriptorChecksumRequest,
  AppendDescriptorChecksumResponse,
  BlindRawTransactionRequest,
  BlindRawTransactionResponse,
  CalculateEcSignatureRequest,
  CalculateEcSignatureResponse,
  CfdProvider,
  ConvertAesRequest,
  ConvertAesResponse,
  ConvertEntropyToMnemonicRequest,
  ConvertEntropyToMnemonicResponse,
  ConvertMnemonicToSeedRequest,
  ConvertMnemonicToSeedResponse,
  CreateAddressRequest,
  CreateAddressResponse,
  CreateDescriptorRequest,
  CreateDescriptorResponse,
  CreateDestroyAmountRequest,
  CreateDestroyAmountResponse,
  CreateElementsSignatureHashRequest,
  CreateElementsSignatureHashResponse,
  CreateExtkeyFromParentKeyRequest,
  CreateExtkeyFromParentKeyResponse,
  CreateExtkeyFromParentPathRequest,
  CreateExtkeyFromParentPathResponse,
  CreateExtkeyFromParentRequest,
  CreateExtkeyFromParentResponse,
  CreateExtkeyFromSeedRequest,
  CreateExtkeyFromSeedResponse,
  CreateExtkeyRequest,
  CreateExtkeyResponse,
  CreateExtPubkeyRequest,
  CreateExtPubkeyResponse,
  CreateKeyPairRequest,
  CreateKeyPairResponse,
  CreateMultisigRequest,
  CreateMultisigResponse,
  CreateMultisigScriptSigRequest,
  CreateMultisigScriptSigResponse,
  CreatePegInAddressRequest,
  CreatePegInAddressResponse,
  CreateRawPeginRequest,
  CreateRawPeginResponse,
  CreateRawPegoutRequest,
  CreateRawPegoutResponse,
  CreateRawTransactionRequest,
  CreateRawTransactionResponse,
  CreateScriptRequest,
  CreateScriptResponse,
  CreateSignatureHashRequest,
  CreateSignatureHashResponse,
  DecodeBase58Request,
  DecodeBase58Response,
  DecodeDerSignatureToRawRequest,
  DecodeDerSignatureToRawResponse,
  DecodeRawTransactionRequest,
  DecodeRawTransactionResponse,
  ElementsAddRawTransactionRequest,
  ElementsAddRawTransactionResponse,
  ElementsCreateRawTransactionRequest,
  ElementsCreateRawTransactionResponse,
  ElementsDecodeRawTransactionRequest,
  ElementsDecodeRawTransactionResponse,
  EncodeBase58Request,
  EncodeBase58Response,
  EncodeSignatureByDerRequest,
  EncodeSignatureByDerResponse,
  EstimateFeeRequest,
  EstimateFeeResponse,
  FundRawTransactionRequest,
  FundRawTransactionResponse,
  GetAddressesFromMultisigRequest,
  GetAddressesFromMultisigResponse,
  GetAddressInfoRequest,
  GetAddressInfoResponse,
  GetCommitmentRequest,
  GetCommitmentResponse,
  GetCompressedPubkeyRequest,
  GetCompressedPubkeyResponse,
  GetConfidentialAddressRequest,
  GetConfidentialAddressResponse,
  GetDefaultBlindingKeyRequest,
  GetDefaultBlindingKeyResponse,
  GetExtkeyInfoRequest,
  GetExtkeyInfoResponse,
  GetIssuanceBlindingKeyRequest,
  GetIssuanceBlindingKeyResponse,
  GetMnemonicWordlistRequest,
  GetMnemonicWordlistResponse,
  GetPrivkeyFromExtkeyRequest,
  GetPrivkeyFromExtkeyResponse,
  GetPrivkeyFromWifRequest,
  GetPrivkeyFromWifResponse,
  GetPrivkeyWifRequest,
  GetPrivkeyWifResponse,
  GetPubkeyFromExtkeyRequest,
  GetPubkeyFromExtkeyResponse,
  GetPubkeyFromPrivkeyRequest,
  GetPubkeyFromPrivkeyResponse,
  GetSupportedFunctionResponse,
  GetUnblindedAddressRequest,
  GetUnblindedAddressResponse,
  GetWitnessStackNumRequest,
  GetWitnessStackNumResponse,
  ParseDescriptorRequest,
  ParseDescriptorResponse,
  ParseScriptRequest,
  ParseScriptResponse,
  SelectUtxosRequest,
  SelectUtxosResponse,
  SerializeLedgerFormatRequest,
  SerializeLedgerFormatResponse,
  SetRawIssueAssetRequest,
  SetRawIssueAssetResponse,
  SetRawReissueAssetRequest,
  SetRawReissueAssetResponse,
  SignWithPrivkeyRequest,
  SignWithPrivkeyResponse,
  UnblindRawTransactionRequest,
  UnblindRawTransactionResponse,
  UpdateTxOutAmountRequest,
  UpdateTxOutAmountResponse,
  UpdateWitnessStackRequest,
  UpdateWitnessStackResponse,
  VerifySignatureRequest,
  VerifySignatureResponse,
  VerifySignRequest,
  VerifySignResponse,
} from '@atomicfinance/types';
import { sleep } from '@atomicfinance/utils';

export default class BitcoinCfdProvider
  extends Provider
  implements Partial<CfdProvider> {
  _cfdJs: any;

  constructor(cfdJs?: any) {
    super();

    this._cfdJs = cfdJs;
  }

  private async CfdLoaded() {
    while (!this._cfdJs) {
      await sleep(10);
    }
  }

  async AddMultisigSign(
    jsonObject: AddMultisigSignRequest,
  ): Promise<AddMultisigSignResponse> {
    await this.CfdLoaded();

    return this._cfdJs.AddMultisigSign(jsonObject);
  }

  async AddPubkeyHashSign(
    jsonObject: AddPubkeyHashSignRequest,
  ): Promise<AddPubkeyHashSignResponse> {
    await this.CfdLoaded();

    return this._cfdJs.AddPubkeyHashSign(jsonObject);
  }

  async AddRawTransaction(
    jsonObject: AddRawTransactionRequest,
  ): Promise<AddRawTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.AddRawTransaction(jsonObject);
  }

  async AddScriptHashSign(
    jsonObject: AddScriptHashSignRequest,
  ): Promise<AddScriptHashSignResponse> {
    await this.CfdLoaded();

    return this._cfdJs.AddScriptHashSign(jsonObject);
  }

  async AddSign(jsonObject: AddSignRequest): Promise<AddSignResponse> {
    await this.CfdLoaded();

    return this._cfdJs.AddSign(jsonObject);
  }

  async AppendDescriptorChecksum(
    jsonObject: AppendDescriptorChecksumRequest,
  ): Promise<AppendDescriptorChecksumResponse> {
    await this.CfdLoaded();

    return this._cfdJs.AppendDescriptorChecksum(jsonObject);
  }

  async BlindRawTransaction(
    jsonObject: BlindRawTransactionRequest,
  ): Promise<BlindRawTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.BlindRawTransaction(jsonObject);
  }

  async CalculateEcSignature(
    jsonObject: CalculateEcSignatureRequest,
  ): Promise<CalculateEcSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CalculateEcSignature(jsonObject);
  }

  async ConvertAes(jsonObject: ConvertAesRequest): Promise<ConvertAesResponse> {
    await this.CfdLoaded();

    return this._cfdJs.ConvertAes(jsonObject);
  }

  async ConvertEntropyToMnemonic(
    jsonObject: ConvertEntropyToMnemonicRequest,
  ): Promise<ConvertEntropyToMnemonicResponse> {
    await this.CfdLoaded();

    return this._cfdJs.ConvertEntropyToMnemonic(jsonObject);
  }

  async ConvertMnemonicToSeed(
    jsonObject: ConvertMnemonicToSeedRequest,
  ): Promise<ConvertMnemonicToSeedResponse> {
    await this.CfdLoaded();

    return this._cfdJs.ConvertMnemonicToSeed(jsonObject);
  }

  async CreateAddress(
    jsonObject: CreateAddressRequest,
  ): Promise<CreateAddressResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateAddress(jsonObject);
  }

  async CreateDescriptor(
    jsonObject: CreateDescriptorRequest,
  ): Promise<CreateDescriptorResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateDescriptor(jsonObject);
  }

  async CreateExtkey(
    jsonObject: CreateExtkeyRequest,
  ): Promise<CreateExtkeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateExtkey(jsonObject);
  }

  async CreateExtkeyFromParent(
    jsonObject: CreateExtkeyFromParentRequest,
  ): Promise<CreateExtkeyFromParentResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateExtkeyFromParent(jsonObject);
  }

  async CreateExtkeyFromParentKey(
    jsonObject: CreateExtkeyFromParentKeyRequest,
  ): Promise<CreateExtkeyFromParentKeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateExtkeyFromParentKey(jsonObject);
  }

  async CreateExtkeyFromParentPath(
    jsonObject: CreateExtkeyFromParentPathRequest,
  ): Promise<CreateExtkeyFromParentPathResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateExtkeyFromParentPath(jsonObject);
  }

  async CreateExtkeyFromSeed(
    jsonObject: CreateExtkeyFromSeedRequest,
  ): Promise<CreateExtkeyFromSeedResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateExtkeyFromSeed(jsonObject);
  }

  async CreateExtPubkey(
    jsonObject: CreateExtPubkeyRequest,
  ): Promise<CreateExtPubkeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateExtPubkey(jsonObject);
  }

  async CreateKeyPair(
    jsonObject: CreateKeyPairRequest,
  ): Promise<CreateKeyPairResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateKeyPair(jsonObject);
  }

  async CreateMultisigScriptSig(
    jsonObject: CreateMultisigScriptSigRequest,
  ): Promise<CreateMultisigScriptSigResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateMultisigScriptSig(jsonObject);
  }

  async CreateScript(
    jsonObject: CreateScriptRequest,
  ): Promise<CreateScriptResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateScript(jsonObject);
  }

  async DecodeBase58(
    jsonObject: DecodeBase58Request,
  ): Promise<DecodeBase58Response> {
    await this.CfdLoaded();

    return this._cfdJs.DecodeBase58(jsonObject);
  }

  async DecodeDerSignatureToRaw(
    jsonObject: DecodeDerSignatureToRawRequest,
  ): Promise<DecodeDerSignatureToRawResponse> {
    await this.CfdLoaded();

    return this._cfdJs.DecodeDerSignatureToRaw(jsonObject);
  }

  async DecodeRawTransaction(
    jsonObject: DecodeRawTransactionRequest,
  ): Promise<DecodeRawTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.DecodeRawTransaction(jsonObject);
  }

  async ElementsAddRawTransaction(
    jsonObject: ElementsAddRawTransactionRequest,
  ): Promise<ElementsAddRawTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.ElementsAddRawTransaction(jsonObject);
  }

  async CreateDestroyAmount(
    jsonObject: CreateDestroyAmountRequest,
  ): Promise<CreateDestroyAmountResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateDestroyAmount(jsonObject);
  }

  async CreatePegInAddress(
    jsonObject: CreatePegInAddressRequest,
  ): Promise<CreatePegInAddressResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreatePegInAddress(jsonObject);
  }

  async CreateRawPegin(
    jsonObject: CreateRawPeginRequest,
  ): Promise<CreateRawPeginResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateRawPegin(jsonObject);
  }

  async CreateRawPegout(
    jsonObject: CreateRawPegoutRequest,
  ): Promise<CreateRawPegoutResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateRawPegout(jsonObject);
  }

  async ElementsCreateRawTransaction(
    jsonObject: ElementsCreateRawTransactionRequest,
  ): Promise<ElementsCreateRawTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.ElementsCreateRawTransaction(jsonObject);
  }

  async ElementsDecodeRawTransaction(
    jsonObject: ElementsDecodeRawTransactionRequest,
  ): Promise<ElementsDecodeRawTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.ElementsDecodeRawTransaction(jsonObject);
  }

  async GetConfidentialAddress(
    jsonObject: GetConfidentialAddressRequest,
  ): Promise<GetConfidentialAddressResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetConfidentialAddress(jsonObject);
  }

  async GetUnblindedAddress(
    jsonObject: GetUnblindedAddressRequest,
  ): Promise<GetUnblindedAddressResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetUnblindedAddress(jsonObject);
  }

  async SetRawIssueAsset(
    jsonObject: SetRawIssueAssetRequest,
  ): Promise<SetRawIssueAssetResponse> {
    await this.CfdLoaded();

    return this._cfdJs.SetRawIssueAsset(jsonObject);
  }

  async SetRawReissueAsset(
    jsonObject: SetRawReissueAssetRequest,
  ): Promise<SetRawReissueAssetResponse> {
    await this.CfdLoaded();

    return this._cfdJs.SetRawReissueAsset(jsonObject);
  }

  async UnblindRawTransaction(
    jsonObject: UnblindRawTransactionRequest,
  ): Promise<UnblindRawTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.UnblindRawTransaction(jsonObject);
  }

  async EncodeBase58(
    jsonObject: EncodeBase58Request,
  ): Promise<EncodeBase58Response> {
    await this.CfdLoaded();

    return this._cfdJs.EncodeBase58(jsonObject);
  }

  async EncodeSignatureByDer(
    jsonObject: EncodeSignatureByDerRequest,
  ): Promise<EncodeSignatureByDerResponse> {
    await this.CfdLoaded();

    return this._cfdJs.EncodeSignatureByDer(jsonObject);
  }

  async EstimateFee(
    jsonObject: EstimateFeeRequest,
  ): Promise<EstimateFeeResponse> {
    await this.CfdLoaded();

    return this._cfdJs.EstimateFee(jsonObject);
  }

  async FundRawTransaction(
    jsonObject: FundRawTransactionRequest,
  ): Promise<FundRawTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.FundRawTransaction(jsonObject);
  }

  async GetAddressInfo(
    jsonObject: GetAddressInfoRequest,
  ): Promise<GetAddressInfoResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetAddressInfo(jsonObject);
  }

  async GetAddressesFromMultisig(
    jsonObject: GetAddressesFromMultisigRequest,
  ): Promise<GetAddressesFromMultisigResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetAddressesFromMultisig(jsonObject);
  }

  async GetCommitment(
    jsonObject: GetCommitmentRequest,
  ): Promise<GetCommitmentResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetCommitment(jsonObject);
  }

  async GetCompressedPubkey(
    jsonObject: GetCompressedPubkeyRequest,
  ): Promise<GetCompressedPubkeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetCompressedPubkey(jsonObject);
  }

  async GetDefaultBlindingKey(
    jsonObject: GetDefaultBlindingKeyRequest,
  ): Promise<GetDefaultBlindingKeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetDefaultBlindingKey(jsonObject);
  }

  async GetExtkeyInfo(
    jsonObject: GetExtkeyInfoRequest,
  ): Promise<GetExtkeyInfoResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetExtkeyInfo(jsonObject);
  }

  async GetIssuanceBlindingKey(
    jsonObject: GetIssuanceBlindingKeyRequest,
  ): Promise<GetIssuanceBlindingKeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetIssuanceBlindingKey(jsonObject);
  }

  async GetMnemonicWordlist(
    jsonObject: GetMnemonicWordlistRequest,
  ): Promise<GetMnemonicWordlistResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetMnemonicWordlist(jsonObject);
  }

  async GetPrivkeyFromExtkey(
    jsonObject: GetPrivkeyFromExtkeyRequest,
  ): Promise<GetPrivkeyFromExtkeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetPrivkeyFromExtkey(jsonObject);
  }

  async GetPrivkeyFromWif(
    jsonObject: GetPrivkeyFromWifRequest,
  ): Promise<GetPrivkeyFromWifResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetPrivkeyFromWif(jsonObject);
  }

  async GetPrivkeyWif(
    jsonObject: GetPrivkeyWifRequest,
  ): Promise<GetPrivkeyWifResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetPrivkeyWif(jsonObject);
  }

  async GetPubkeyFromExtkey(
    jsonObject: GetPubkeyFromExtkeyRequest,
  ): Promise<GetPubkeyFromExtkeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetPubkeyFromExtkey(jsonObject);
  }

  async GetPubkeyFromPrivkey(
    jsonObject: GetPubkeyFromPrivkeyRequest,
  ): Promise<GetPubkeyFromPrivkeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetPubkeyFromPrivkey(jsonObject);
  }

  async GetWitnessStackNum(
    jsonObject: GetWitnessStackNumRequest,
  ): Promise<GetWitnessStackNumResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetWitnessStackNum(jsonObject);
  }

  async CreateMultisig(
    jsonObject: CreateMultisigRequest,
  ): Promise<CreateMultisigResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateMultisig(jsonObject);
  }

  async ParseDescriptor(
    jsonObject: ParseDescriptorRequest,
  ): Promise<ParseDescriptorResponse> {
    await this.CfdLoaded();

    return this._cfdJs.ParseDescriptor(jsonObject);
  }

  async ParseScript(
    jsonObject: ParseScriptRequest,
  ): Promise<ParseScriptResponse> {
    await this.CfdLoaded();

    return this._cfdJs.ParseScript(jsonObject);
  }

  async SelectUtxos(
    jsonObject: SelectUtxosRequest,
  ): Promise<SelectUtxosResponse> {
    await this.CfdLoaded();

    return this._cfdJs.SelectUtxos(jsonObject);
  }

  async SerializeLedgerFormat(
    jsonObject: SerializeLedgerFormatRequest,
  ): Promise<SerializeLedgerFormatResponse> {
    await this.CfdLoaded();

    return this._cfdJs.SerializeLedgerFormat(jsonObject);
  }

  async CreateSignatureHash(
    jsonObject: CreateSignatureHashRequest,
  ): Promise<CreateSignatureHashResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateSignatureHash(jsonObject);
  }

  async CreateElementsSignatureHash(
    jsonObject: CreateElementsSignatureHashRequest,
  ): Promise<CreateElementsSignatureHashResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateElementsSignatureHash(jsonObject);
  }

  async SignWithPrivkey(
    jsonObject: SignWithPrivkeyRequest,
  ): Promise<SignWithPrivkeyResponse> {
    await this.CfdLoaded();

    return this._cfdJs.SignWithPrivkey(jsonObject);
  }

  async GetSupportedFunction(): Promise<GetSupportedFunctionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.GetSupportedFunction();
  }

  async CreateRawTransaction(
    jsonObject: CreateRawTransactionRequest,
  ): Promise<CreateRawTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdJs.CreateRawTransaction(jsonObject);
  }

  async UpdateTxOutAmount(
    jsonObject: UpdateTxOutAmountRequest,
  ): Promise<UpdateTxOutAmountResponse> {
    await this.CfdLoaded();

    return this._cfdJs.UpdateTxOutAmount(jsonObject);
  }

  async UpdateWitnessStack(
    jsonObject: UpdateWitnessStackRequest,
  ): Promise<UpdateWitnessStackResponse> {
    await this.CfdLoaded();

    return this._cfdJs.UpdateWitnessStack(jsonObject);
  }

  async VerifySign(jsonObject: VerifySignRequest): Promise<VerifySignResponse> {
    await this.CfdLoaded();

    return this._cfdJs.VerifySign(jsonObject);
  }

  async VerifySignature(
    jsonObject: VerifySignatureRequest,
  ): Promise<VerifySignatureResponse> {
    await this.CfdLoaded();

    return this._cfdJs.VerifySignature(jsonObject);
  }

  async GetAddressScript(address: string) {
    await this.CfdLoaded();

    const req = { address };

    const info = await this.GetAddressInfo(req);
    return info.lockingScript;
  }
}
