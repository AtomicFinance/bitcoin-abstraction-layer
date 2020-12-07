// import CfddlcHelper from './cfddlcjsHelper';
import Provider from '@atomicfinance/provider';
import { sleep } from '@liquality/utils';
import {
  AddSignatureToFundTransactionRequest,
  AddSignatureToFundTransactionResponse,
  AddSignaturesToCetRequest,
  AddSignaturesToCetResponse,
  AddSignaturesToMutualClosingTxRequest,
  AddSignaturesToMutualClosingTxResponse,
  AddSignaturesToRefundTxRequest,
  AddSignaturesToRefundTxResponse,
  CreateCetRequest,
  CreateCetResponse,
  CreateClosingTransactionRequest,
  CreateClosingTransactionResponse,
  CreateDlcTransactionsRequest,
  CreateDlcTransactionsResponse,
  CreateFundTransactionRequest,
  CreateFundTransactionResponse,
  CreateMutualClosingTransactionRequest,
  CreateMutualClosingTransactionResponse,
  CreatePenaltyTransactionRequest,
  CreatePenaltyTransactionResponse,
  CreateRefundTransactionRequest,
  CreateRefundTransactionResponse,
  GetRawCetSignatureRequest,
  GetRawCetSignatureResponse,
  GetRawCetSignaturesRequest,
  GetRawCetSignaturesResponse,
  GetRawFundTxSignatureRequest,
  GetRawFundTxSignatureResponse,
  GetRawMutualClosingTxSignatureRequest,
  GetRawMutualClosingTxSignatureResponse,
  GetRawRefundTxSignatureRequest,
  GetRawRefundTxSignatureResponse,
  GetSchnorrPublicNonceRequest,
  GetSchnorrPublicNonceResponse,
  SchnorrSignRequest,
  SchnorrSignResponse,
  SignClosingTransactionRequest,
  SignClosingTransactionResponse,
  SignFundTransactionRequest,
  SignFundTransactionResponse,
  VerifyCetSignatureRequest,
  VerifyCetSignatureResponse,
  VerifyCetSignaturesRequest,
  VerifyCetSignaturesResponse,
  VerifyFundTxSignatureRequest,
  VerifyFundTxSignatureResponse,
  VerifyMutualClosingTxSignatureRequest,
  VerifyMutualClosingTxSignatureResponse,
  VerifyRefundTxSignatureRequest,
  VerifyRefundTxSignatureResponse,
} from './DlcInterfaces';
import DlcParty from './models/DlcParty';
import Contract from './models/Contract';

import Input from './models/Input';
import InputDetails from './models/InputDetails';
import OutcomeDetails from './models/OutcomeDetails';
import OracleInfo from './models/OracleInfo';
import Outcome from './models/Outcome';
import OfferMessage from './models/OfferMessage';
import AcceptMessage from './models/AcceptMessage';
import SignMessage from './models/SignMessage';
import Utxo from './models/Utxo';
import { v4 as uuidv4 } from 'uuid';

export default class BitcoinDlcProvider extends Provider {
  _network: any;
  _cfdDlcJs: any;
  _dlcs: DlcParty[];

  constructor(network: any, cfdDlcJs?: any) {
    super('BitcoinDlcProvider');

    this._network = network;
    this._dlcs = [] as DlcParty[];
    this._cfdDlcJs = cfdDlcJs;
  }

  private async CfdLoaded() {
    while (!this._cfdDlcJs) {
      await sleep(10);
    }
  }

  private setInitialInputs(contract: Contract, input: InputDetails) {
    contract.localCollateral = input.localCollateral;
    contract.remoteCollateral = input.remoteCollateral;
    contract.feeRate = input.feeRate;
    contract.maturityTime = input.maturityTime;
    contract.refundLockTime = input.refundLockTime;
    contract.cetCsvDelay = input.cetCsvDelay;
  }

  private setOutcomes(contract: Contract, outcomes: Array<OutcomeDetails>) {
    outcomes.forEach((outcome) => {
      const { message, localAmount, remoteAmount } = outcome;
      const newOutcome = new Outcome(message, localAmount, remoteAmount);
      contract.outcomes.push(newOutcome);
    });
  }

  private findDlc(contractId: string): DlcParty {
    return this._dlcs.find((dlc) => dlc.contract.id === contractId);
  }

  private updateDlcContractId(oldContractId: string, newContractId: string): boolean {
    let updated = false
    this._dlcs.forEach(dlc => {
      if (dlc.contract.id === oldContractId) {
        dlc.contract.id = newContractId
        updated = true
      }
    })
    return updated
  }

  private deleteDlc (contractId: string) {
    this._dlcs.forEach((dlc, i) => {
      if (dlc.contract.id === contractId) {
        this._dlcs.splice(i, 1)
      }
    })
  }

  hasDlc(contractId: string): boolean {
    return this._dlcs.some((dlc) => {
      dlc.contract.id === contractId;
    });
  }

  async importContract(contract: Contract, startingIndex: number) {
    const dlcParty = new DlcParty(this);
    this._dlcs.push(dlcParty);
    await dlcParty.ImportContract(contract, startingIndex);
  }

  exportContract(contractId: string): Contract {
    return this.findDlc(contractId).contract;
  }

  exportContracts(): Contract[] {
    const contracts: Contract[] = [];
    for (let i = 0; i < this._dlcs.length; i++) {
      const dlc = this._dlcs[i];
      contracts.push(dlc.contract);
    }
    return contracts;
  }

  deleteContract (contractId: string) {
    this.deleteDlc(contractId)
  }

  // Only Alice
  async importContractFromOfferMessage (offerMessage: OfferMessage, startingIndex: number = 0) {
    const { localCollateral, remoteCollateral, feeRate, maturityTime, refundLockTime, cetCsvDelay, oracleInfo } = offerMessage

    const input: InputDetails = {
      localCollateral,
      remoteCollateral,
      feeRate,
      maturityTime,
      refundLockTime,
      cetCsvDelay
    }

    const outcomes: OutcomeDetails[] = []

    offerMessage.outcomes.forEach(outcome => {
      const { message, local, remote } = outcome

      outcomes.push({
        localAmount: local,
        remoteAmount: remote,
        message
      })
    })

    const fixedInputs: Input[] = []

    offerMessage.localPartyInputs.utxos.forEach(utxo => {
      const { txid, vout, address, amount, derivationPath } = utxo

      const utxoAmount = amount.GetSatoshiAmount()

      fixedInputs.push({
        txid,
        vout,
        address,
        amount: utxoAmount,
        derivationPath,
        label: '',
        scriptPubKey: '',
        confirmations: 0,
        spendable: false,
        solvable: false,
        safe: false,
        satoshis: 0,
        value: 0
      })
    })

    const initOfferMessage = await this.initializeContractAndOffer(input, outcomes, oracleInfo, startingIndex, fixedInputs)
    const updateSuccess = this.updateDlcContractId(initOfferMessage.contractId, offerMessage.contractId)
    if (!updateSuccess) {
      throw Error('Dlc Contract ID did not update successfully')
    }
  }

  // Only Bob
  async importContractFromAcceptMessage (offerMessage: OfferMessage, acceptMessage: AcceptMessage, startingIndex: number = 0) {
    const fixedInputs: Input[] = []

    acceptMessage.remotePartyInputs.utxos.forEach(utxo => {
      const { txid, vout, address, amount, derivationPath } = utxo

      const utxoAmount = amount.GetSatoshiAmount()

      fixedInputs.push({
        txid,
        vout,
        address,
        amount: utxoAmount,
        derivationPath,
        label: '',
        scriptPubKey: '',
        confirmations: 0,
        spendable: false,
        solvable: false,
        safe: false,
        satoshis: 0,
        value: 0
      })
    })

    const initAcceptMessage = await this.confirmContractOffer(offerMessage, startingIndex, fixedInputs)
    const updateSuccess = this.updateDlcContractId(initAcceptMessage.contractId, acceptMessage.contractId)
    if (!updateSuccess) {
      throw Error('Dlc Contract ID did not update successfully')
    }
  }

  // Only Alice
  async importContractFromAcceptAndSignMessage (offerMessage: OfferMessage, acceptMessage: AcceptMessage, signMessage: SignMessage, startingIndex: number = 0) {
    await this.importContractFromOfferMessage(offerMessage, startingIndex)

    const initSignMessage = await this.signContract(acceptMessage)

    console.log('signMessage', signMessage)
    console.log('initSignMessage', initSignMessage)
  }

  // Only Bob
  async importContractFromSignMessageAndCreateFinal (offerMessage: OfferMessage, acceptMessage: AcceptMessage, signMessage: SignMessage, startingIndex: number = 0) {
    await this.importContractFromAcceptMessage(offerMessage, acceptMessage, startingIndex)
    try {
      await this.finalizeContract(signMessage)
    } catch(e) {
      console.log('error', e)
    }
  }

  async initializeContractAndOffer(
    input: InputDetails,
    outcomes: OutcomeDetails[],
    oracleInfo: OracleInfo,
    startingIndex: number = 0,
    fixedInputs: Input[] = []
  ): Promise<OfferMessage> {
    console.log('test initializeContractAndOffer')
    const contract = new Contract();

    contract.id = uuidv4();
    contract.oracleInfo = oracleInfo;
    contract.startingIndex = startingIndex;

    this.setInitialInputs(contract, input);

    this.setOutcomes(contract, outcomes);

    const dlcParty = new DlcParty(this);
    this._dlcs.push(dlcParty);

    return dlcParty.InitiateContract(contract, startingIndex, fixedInputs);
  }

  async confirmContractOffer(
    offerMessage: OfferMessage,
    startingIndex: number = 0,
    fixedInputs: Input[] = []
  ): Promise<AcceptMessage> {
    const dlcParty = new DlcParty(this);
    this._dlcs.push(dlcParty);

    return dlcParty.OnOfferMessage(offerMessage, startingIndex, fixedInputs);
  }

  async signContract(acceptMessage: AcceptMessage): Promise<SignMessage> {
    return this.findDlc(acceptMessage.contractId).OnAcceptMessage(
      acceptMessage
    );
  }

  async finalizeContract(signMessage: SignMessage): Promise<string> {
    return this.findDlc(signMessage.contractId).OnSignMessage(signMessage);
  }

  async refund(contractId: string) {
    return this.findDlc(contractId).Refund();
  }

  async unilateralClose(
    oracleSignature: string,
    outcomeIndex: number,
    contractId: string
  ): Promise<string[]> {
    return this.findDlc(contractId).ExecuteUnilateralClose(
      oracleSignature,
      outcomeIndex
    );
  }

  async buildUnilateralClose(
    oracleSignature: string,
    outcomeIndex: number,
    contractId: string
  ): Promise<string[]> {
    return this.findDlc(contractId).BuildUnilateralClose(
      oracleSignature,
      outcomeIndex
    );
  }

  async getFundingUtxoAddressesForOfferMessages (offerMessages: OfferMessage[]) {
    const fundingAddresses: string[] = []
    const fundingUtxos: Utxo[] = []
    offerMessages.forEach(offerMessage => {
      offerMessage.localPartyInputs.utxos.forEach(utxo => {
        if (fundingAddresses.indexOf(utxo.address) === -1) fundingAddresses.push(utxo.address)
        fundingUtxos.push(utxo)
      })
    })

    return { addresses: fundingAddresses, utxos: fundingUtxos }
  }

  async getFundingUtxoAddressesForAcceptMessages (acceptMessages: AcceptMessage[]) {
    const fundingAddresses: string[] = []
    const fundingUtxos: Utxo[] = []
    acceptMessages.forEach(acceptMessage => {
      acceptMessage.remotePartyInputs.utxos.forEach(utxo => {
        if (fundingAddresses.indexOf(utxo.address) === -1) fundingAddresses.push(utxo.address)
        fundingUtxos.push(utxo)
      })
    })

    return { addresses: fundingAddresses, utxos: fundingUtxos }
  }

  async AddSignatureToFundTransaction(
    jsonObject: AddSignatureToFundTransactionRequest
  ): Promise<AddSignatureToFundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.AddSignatureToFundTransaction(jsonObject);
  }

  async AddSignaturesToCet(
    jsonObject: AddSignaturesToCetRequest
  ): Promise<AddSignaturesToCetResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.AddSignaturesToCet(jsonObject);
  }

  async AddSignaturesToMutualClosingTx(
    jsonObject: AddSignaturesToMutualClosingTxRequest
  ): Promise<AddSignaturesToMutualClosingTxResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.AddSignaturesToMutualClosingTx(jsonObject);
  }

  async AddSignaturesToRefundTx(
    jsonObject: AddSignaturesToRefundTxRequest
  ): Promise<AddSignaturesToRefundTxResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.AddSignaturesToRefundTx(jsonObject);
  }

  async CreateCet(jsonObject: CreateCetRequest): Promise<CreateCetResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateCet(jsonObject);
  }

  async CreateClosingTransaction(
    jsonObject: CreateClosingTransactionRequest
  ): Promise<CreateClosingTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateClosingTransaction(jsonObject);
  }

  async CreateDlcTransactions(
    jsonObject: CreateDlcTransactionsRequest
  ): Promise<CreateDlcTransactionsResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateDlcTransactions(jsonObject);
  }

  async CreateFundTransaction(
    jsonObject: CreateFundTransactionRequest
  ): Promise<CreateFundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateFundTransaction(jsonObject);
  }

  async CreateMutualClosingTransaction(
    jsonObject: CreateMutualClosingTransactionRequest
  ): Promise<CreateMutualClosingTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateMutualClosingTransaction(jsonObject);
  }

  async CreatePenaltyTransaction(
    jsonObject: CreatePenaltyTransactionRequest
  ): Promise<CreatePenaltyTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreatePenaltyTransaction(jsonObject);
  }

  async CreateRefundTransaction(
    jsonObject: CreateRefundTransactionRequest
  ): Promise<CreateRefundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateRefundTransaction(jsonObject);
  }

  async GetRawCetSignature(
    jsonObject: GetRawCetSignatureRequest
  ): Promise<GetRawCetSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.GetRawCetSignature(jsonObject);
  }

  async GetRawCetSignatures(
    jsonObject: GetRawCetSignaturesRequest
  ): Promise<GetRawCetSignaturesResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.GetRawCetSignatures(jsonObject);
  }

  async GetRawFundTxSignature(
    jsonObject: GetRawFundTxSignatureRequest
  ): Promise<GetRawFundTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.GetRawFundTxSignature(jsonObject);
  }

  async GetRawMutualClosingTxSignature(
    jsonObject: GetRawMutualClosingTxSignatureRequest
  ): Promise<GetRawMutualClosingTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.GetRawMutualClosingTxSignature(jsonObject);
  }

  async GetRawRefundTxSignature(
    jsonObject: GetRawRefundTxSignatureRequest
  ): Promise<GetRawRefundTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.GetRawRefundTxSignature(jsonObject);
  }

  async GetSchnorrPublicNonce(
    jsonObject: GetSchnorrPublicNonceRequest
  ): Promise<GetSchnorrPublicNonceResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.GetSchnorrPublicNonce(jsonObject);
  }

  async SchnorrSign(
    jsonObject: SchnorrSignRequest
  ): Promise<SchnorrSignResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.SchnorrSign(jsonObject);
  }

  async SignClosingTransaction(
    jsonObject: SignClosingTransactionRequest
  ): Promise<SignClosingTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.SignClosingTransaction(jsonObject);
  }

  async SignFundTransaction(
    jsonObject: SignFundTransactionRequest
  ): Promise<SignFundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.SignFundTransaction(jsonObject);
  }

  async VerifyCetSignature(
    jsonObject: VerifyCetSignatureRequest
  ): Promise<VerifyCetSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.VerifyCetSignature(jsonObject);
  }

  async VerifyCetSignatures(
    jsonObject: VerifyCetSignaturesRequest
  ): Promise<VerifyCetSignaturesResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.VerifyCetSignatures(jsonObject);
  }

  async VerifyFundTxSignature(
    jsonObject: VerifyFundTxSignatureRequest
  ): Promise<VerifyFundTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.VerifyFundTxSignature(jsonObject);
  }

  async VerifyMutualClosingTxSignature(
    jsonObject: VerifyMutualClosingTxSignatureRequest
  ): Promise<VerifyMutualClosingTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.VerifyMutualClosingTxSignature(jsonObject);
  }

  async VerifyRefundTxSignature(
    jsonObject: VerifyRefundTxSignatureRequest
  ): Promise<VerifyRefundTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.VerifyRefundTxSignature(jsonObject);
  }
}
