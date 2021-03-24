import Provider from '@atomicfinance/provider';
import { sleep } from '@liquality/utils';
import { sha256 } from '@liquality/crypto';
import {
  AddSignatureToFundTransactionRequest,
  AddSignatureToFundTransactionResponse,
  CreateCetAdaptorSignatureRequest,
  CreateCetAdaptorSignatureResponse,
  CreateCetAdaptorSignaturesRequest,
  CreateCetAdaptorSignaturesResponse,
  AddSignaturesToRefundTxRequest,
  AddSignaturesToRefundTxResponse,
  CreateCetRequest,
  CreateCetResponse,
  CreateDlcTransactionsRequest,
  CreateDlcTransactionsResponse,
  CreateFundTransactionRequest,
  CreateFundTransactionResponse,
  CreateRefundTransactionRequest,
  CreateRefundTransactionResponse,
  GetRawFundTxSignatureRequest,
  GetRawFundTxSignatureResponse,
  GetRawRefundTxSignatureRequest,
  GetRawRefundTxSignatureResponse,
  SignCetRequest,
  SignCetResponse,
  VerifyCetAdaptorSignatureRequest,
  VerifyCetAdaptorSignatureResponse,
  VerifyCetAdaptorSignaturesRequest,
  VerifyCetAdaptorSignaturesResponse,
  SignFundTransactionRequest,
  SignFundTransactionResponse,
  VerifyFundTxSignatureRequest,
  VerifyFundTxSignatureResponse,
  VerifyRefundTxSignatureRequest,
  VerifyRefundTxSignatureResponse,
  Messages,
} from './@types/cfd-dlc-js';
import DlcParty from './models/DlcParty';
import Contract from './models/Contract';

import Amount from './models/Amount';
import Input from './models/Input';
import Output from './models/Output';
import InputDetails from './models/InputDetails';
import PayoutDetails from './models/PayoutDetails';
import OracleInfo from './models/OracleInfo';
import OfferMessage from './models/OfferMessage';
import AcceptMessage from './models/AcceptMessage';
import SignMessage from './models/SignMessage';
import Payout from './models/Payout';
import Utxo from './models/Utxo';
import { v4 as uuidv4 } from 'uuid';
import { MutualClosingMessage } from '.';
import {
  ContractInfo,
  FundingInput,
  DlcOffer,
  FundingInputV0,
  MessageType,
} from '@node-dlc/messaging';
import { Tx, TxBuilder, Sequence } from '@node-dlc/bitcoin';
import { decodeRawTransaction } from '@liquality/bitcoin-utils';
import { StreamReader } from '@node-lightning/bufio';
import * as bitcoin from 'bitcoinjs-lib';
import randomBytes from 'randombytes';

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

  // private setInitialInputs(contract: Contract, input: InputDetails) {
  //   contract.localCollateral = input.localCollateral;
  //   contract.remoteCollateral = input.remoteCollateral;
  //   contract.feeRate = input.feeRate;
  //   contract.refundLockTime = input.refundLockTime;
  // }

  private setPayouts(contract: Contract, payouts: PayoutDetails[]) {
    // payouts.forEach((payout) => {
    //   const { localAmount, remoteAmount } = payout;
    //   const newPayout = new Payout(localAmount, remoteAmount);
    //   contract.payouts.push(newPayout);
    // });
  }

  private findDlc(contractId: string): DlcParty {
    return this._dlcs.find((dlc) => dlc.contract.id === contractId);
  }

  private updateDlcContractId(
    oldContractId: string,
    newContractId: string,
  ): boolean {
    let updated = false;
    this._dlcs.forEach((dlc) => {
      if (dlc.contract.id === oldContractId) {
        dlc.contract.id = newContractId;
        updated = true;
      }
    });
    return updated;
  }

  private deleteDlc(contractId: string) {
    this._dlcs.forEach((dlc, i) => {
      if (dlc.contract.id === contractId) {
        this._dlcs.splice(i, 1);
      }
    });
  }

  hasDlc(contractId: string): boolean {
    return this._dlcs.some((dlc) => {
      dlc.contract.id === contractId;
    });
  }

  // async importContract(contract: Contract, startingIndex: number) {
  //   const dlcParty = new DlcParty(this);
  //   this._dlcs.push(dlcParty);
  //   await dlcParty.ImportContract(contract, startingIndex);
  // }

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

  deleteContract(contractId: string) {
    this.deleteDlc(contractId);
  }

  // // Only Alice
  // async importContractFromOfferMessage(
  //   offerMessage: OfferMessage,
  //   startingIndex = 0,
  // ) {
  //   const {
  //     localCollateral,
  //     remoteCollateral,
  //     feeRate,
  //     refundLockTime,
  //     oracleInfo,
  //     messagesList,
  //   } = offerMessage;

  //   const input: InputDetails = {
  //     localCollateral,
  //     remoteCollateral,
  //     feeRate,
  //     refundLockTime,
  //   };

  //   const payouts: PayoutDetails[] = [];

  //   offerMessage.payouts.forEach((payout) => {
  //     const { local, remote } = payout;

  //     payouts.push({
  //       localAmount: local,
  //       remoteAmount: remote,
  //     });
  //   });

  //   const fixedInputs: Input[] = [];

  //   offerMessage.localPartyInputs.utxos.forEach((utxo) => {
  //     const { txid, vout, address, amount, derivationPath } = utxo;

  //     const utxoAmount = amount.GetSatoshiAmount();

  //     fixedInputs.push({
  //       txid,
  //       vout,
  //       address,
  //       amount: utxoAmount,
  //       derivationPath,
  //       label: '',
  //       scriptPubKey: '',
  //       confirmations: 0,
  //       spendable: false,
  //       solvable: false,
  //       safe: false,
  //       satoshis: 0,
  //       value: 0,
  //     });
  //   });

  //   const initOfferMessage = await this.initializeContractAndOffer(
  //     input,
  //     payouts,
  //     oracleInfo,
  //     messagesList,
  //     startingIndex,
  //     fixedInputs,
  //   );
  //   const updateSuccess = this.updateDlcContractId(
  //     initOfferMessage.contractId,
  //     offerMessage.contractId,
  //   );
  //   if (!updateSuccess) {
  //     throw Error('Dlc Contract ID did not update successfully');
  //   }
  // }

  // // Only Bob
  // async importContractFromAcceptMessage(
  //   offerMessage: OfferMessage,
  //   acceptMessage: AcceptMessage,
  //   startingIndex = 0,
  // ) {
  //   const fixedInputs: Input[] = [];

  //   acceptMessage.remotePartyInputs.utxos.forEach((utxo) => {
  //     const { txid, vout, address, amount, derivationPath } = utxo;

  //     const utxoAmount = amount.GetSatoshiAmount();

  //     fixedInputs.push({
  //       txid,
  //       vout,
  //       address,
  //       amount: utxoAmount,
  //       derivationPath,
  //       label: '',
  //       scriptPubKey: '',
  //       confirmations: 0,
  //       spendable: false,
  //       solvable: false,
  //       safe: false,
  //       satoshis: 0,
  //       value: 0,
  //     });
  //   });

  //   const initAcceptMessage = await this.confirmContractOffer(
  //     offerMessage,
  //     startingIndex,
  //     fixedInputs,
  //   );
  //   const updateSuccess = this.updateDlcContractId(
  //     initAcceptMessage.contractId,
  //     acceptMessage.contractId,
  //   );
  //   if (!updateSuccess) {
  //     throw Error('Dlc Contract ID did not update successfully');
  //   }
  // }

  // // Only Alice
  // async importContractFromAcceptAndSignMessage(
  //   offerMessage: OfferMessage,
  //   acceptMessage: AcceptMessage,
  //   signMessage: SignMessage,
  //   startingIndex = 0,
  // ) {
  //   await this.importContractFromOfferMessage(offerMessage, startingIndex);

  //   const initSignMessage = await this.signContract(acceptMessage);
  // }

  // // Only Bob
  // async importContractFromSignMessageAndCreateFinal(
  //   offerMessage: OfferMessage,
  //   acceptMessage: AcceptMessage,
  //   signMessage: SignMessage,
  //   startingIndex = 0,
  // ) {
  //   await this.importContractFromAcceptMessage(
  //     offerMessage,
  //     acceptMessage,
  //     startingIndex,
  //   );
  //   try {
  //     await this.finalizeContract(signMessage);
  //   } catch (e) {
  //     console.log('error', e);
  //   }
  // }

  outputsToPayouts(
    outputs: GeneratedOutput[],
    rValuesMessagesList: Messages[],
    localCollateral: Amount,
    remoteCollateral: Amount,
    payoutLocal: boolean,
  ): { payouts: PayoutDetails[]; messagesList: Messages[] } {
    const payouts: PayoutDetails[] = [];
    const messagesList: Messages[] = [];

    outputs.forEach((output: any) => {
      const { payout, groups } = output;
      const payoutAmount: Amount = Amount.FromSatoshis(payout);

      groups.forEach((group: number[]) => {
        const messages = [];
        for (let i = 0; i < group.length; i++) {
          const digit: number = group[i];
          messages.push(rValuesMessagesList[i].messages[digit]);
        }

        const localAmount = payoutLocal
          ? payoutAmount
          : localCollateral
              .AddAmount(remoteCollateral)
              .CompareWith(payoutAmount);
        const remoteAmount = payoutLocal
          ? localCollateral
              .AddAmount(remoteCollateral)
              .CompareWith(payoutAmount)
          : payoutAmount;
        payouts.push({ localAmount, remoteAmount });
        messagesList.push({ messages });
      });
    });

    return { payouts, messagesList };
  }

  /**
   * Deserializes an contract_descriptor_v0 message
   * @param contractInfo ContractInfo TLV (V0 or V1)
   * @param offerCollateralSatoshis Amount DLC Initiator is putting into the contract
   * @param feeRatePerVb Fee rate in satoshi per virtual byte that both sides use to compute fees in funding tx
   * @param cetLocktime The nLockTime to be put on CETs
   * @param refundLocktime The nLockTime to be put on the refund transaction
   * @returns {Promise<DlcOffer>}
   */
  async initializeContractAndOffer(
    contractInfo: ContractInfo,
    offerCollateralSatoshis: bigint,
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktime: number,
    fixedInputs?: Input[],
    // input: InputDetails,
    // payouts: PayoutDetails[],
    // oracleInfo: OracleInfo,
    // messagesList: Messages[],
    // startingIndex = 0,
    // fixedInputs: Input[] = [],
  ): Promise<DlcOffer> {
    const contract = new Contract();

    contract.tempContractInfoId = sha256(contractInfo.serialize());

    // contract.id = uuidv4();
    // contract.oracleInfo = oracleInfo;
    // contract.startingIndex = startingIndex;
    // contract.messagesList = messagesList;

    // this.setInitialInputs(contract, input);

    contract.contractInfo = contractInfo;
    contract.offerCollateralSatoshis = offerCollateralSatoshis;

    contract.acceptCollateralSatoshis =
      contractInfo.totalCollateral - offerCollateralSatoshis;

    contract.feeRatePerVb = feeRatePerVb;
    contract.cetLocktime = cetLocktime;
    contract.refundLocktime = refundLocktime;

    // this.setPayouts(contract, payouts);

    const dlcParty = new DlcParty(this);
    this._dlcs.push(dlcParty);

    return dlcParty.InitiateContract(contract, fixedInputs);
  }

  // /*
  //  * Should receive OfferMessage TLV
  //  */
  // async confirmContractOffer(
  //   offerMessage: OfferMessage,
  //   startingIndex = 0,
  //   fixedInputs: Input[] = [],
  // ): Promise<AcceptMessage> {
  //   const dlcParty = new DlcParty(this);
  //   this._dlcs.push(dlcParty);

  //   return dlcParty.OnOfferMessage(offerMessage, startingIndex, fixedInputs);
  // }

  // async signContract(acceptMessage: AcceptMessage): Promise<SignMessage> {
  //   return this.findDlc(acceptMessage.contractId).OnAcceptMessage(
  //     acceptMessage,
  //   );
  // }

  // async finalizeContract(signMessage: SignMessage): Promise<string> {
  //   return this.findDlc(signMessage.contractId).OnSignMessage(signMessage);
  // }

  // async refund(contractId: string) {
  //   return this.findDlc(contractId).Refund();
  // }

  // async initiateEarlyExit(contractId: string, outputs: Output[]) {
  //   return this.findDlc(contractId).InitiateEarlyExit(outputs);
  // }

  // async finalizeEarlyExit(
  //   contractId: string,
  //   mutualClosingMessage: MutualClosingMessage,
  // ) {
  //   return this.findDlc(contractId).OnMutualClose(mutualClosingMessage);
  // }

  // async unilateralClose(
  //   outcomeIndex: number,
  //   oracleSignatures: string[],
  //   contractId: string,
  // ): Promise<string[]> {
  //   return this.findDlc(contractId).SignAndBroadcastCet(
  //     outcomeIndex,
  //     oracleSignatures,
  //   );
  // }

  async getFundingUtxoAddressesForOfferMessages(offerMessages: OfferMessage[]) {
    const fundingAddresses: string[] = [];
    const fundingUtxos: Utxo[] = [];
    offerMessages.forEach((offerMessage) => {
      offerMessage.localPartyInputs.utxos.forEach((utxo) => {
        if (fundingAddresses.indexOf(utxo.address) === -1)
          fundingAddresses.push(utxo.address);
        fundingUtxos.push(utxo);
      });
    });

    return { addresses: fundingAddresses, utxos: fundingUtxos };
  }

  async getFundingUtxoAddressesForAcceptMessages(
    acceptMessages: AcceptMessage[],
  ) {
    const fundingAddresses: string[] = [];
    const fundingUtxos: Utxo[] = [];
    acceptMessages.forEach((acceptMessage) => {
      acceptMessage.remotePartyInputs.utxos.forEach((utxo) => {
        if (fundingAddresses.indexOf(utxo.address) === -1)
          fundingAddresses.push(utxo.address);
        fundingUtxos.push(utxo);
      });
    });

    return { addresses: fundingAddresses, utxos: fundingUtxos };
  }

  async AddSignatureToFundTransaction(
    jsonObject: AddSignatureToFundTransactionRequest,
  ): Promise<AddSignatureToFundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.AddSignatureToFundTransaction(jsonObject);
  }

  async CreateCetAdaptorSignature(
    jsonObject: CreateCetAdaptorSignatureRequest,
  ): Promise<CreateCetAdaptorSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateCetAdaptorSignature(jsonObject);
  }

  async CreateCetAdaptorSignatures(
    jsonObject: CreateCetAdaptorSignaturesRequest,
  ): Promise<CreateCetAdaptorSignaturesResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateCetAdaptorSignatures(jsonObject);
  }

  async AddSignaturesToRefundTx(
    jsonObject: AddSignaturesToRefundTxRequest,
  ): Promise<AddSignaturesToRefundTxResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.AddSignaturesToRefundTx(jsonObject);
  }

  async CreateCet(jsonObject: CreateCetRequest): Promise<CreateCetResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateCet(jsonObject);
  }

  async CreateDlcTransactions(
    jsonObject: CreateDlcTransactionsRequest,
  ): Promise<CreateDlcTransactionsResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateDlcTransactions(jsonObject);
  }

  async CreateFundTransaction(
    jsonObject: CreateFundTransactionRequest,
  ): Promise<CreateFundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateFundTransaction(jsonObject);
  }

  async CreateRefundTransaction(
    jsonObject: CreateRefundTransactionRequest,
  ): Promise<CreateRefundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateRefundTransaction(jsonObject);
  }

  async GetRawFundTxSignature(
    jsonObject: GetRawFundTxSignatureRequest,
  ): Promise<GetRawFundTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.GetRawFundTxSignature(jsonObject);
  }

  async GetRawRefundTxSignature(
    jsonObject: GetRawRefundTxSignatureRequest,
  ): Promise<GetRawRefundTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.GetRawRefundTxSignature(jsonObject);
  }

  async SignCet(jsonObject: SignCetRequest): Promise<SignCetResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.SignCet(jsonObject);
  }

  async VerifyCetAdaptorSignature(
    jsonObject: VerifyCetAdaptorSignatureRequest,
  ): Promise<VerifyCetAdaptorSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.VerifyCetAdaptorSignature(jsonObject);
  }

  async VerifyCetAdaptorSignatures(
    jsonObject: VerifyCetAdaptorSignaturesRequest,
  ): Promise<VerifyCetAdaptorSignaturesResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.VerifyCetAdaptorSignatures(jsonObject);
  }

  async SignFundTransaction(
    jsonObject: SignFundTransactionRequest,
  ): Promise<SignFundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.SignFundTransaction(jsonObject);
  }

  async VerifyFundTxSignature(
    jsonObject: VerifyFundTxSignatureRequest,
  ): Promise<VerifyFundTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.VerifyFundTxSignature(jsonObject);
  }

  async VerifyRefundTxSignature(
    jsonObject: VerifyRefundTxSignatureRequest,
  ): Promise<VerifyRefundTxSignatureResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.VerifyRefundTxSignature(jsonObject);
  }

  async fundingInputToInput(_input: FundingInput): Promise<Input> {
    if (_input.type !== MessageType.FundingInputV0) throw Error('Wrong type');
    const network = await this.getMethod('getConnectedNetwork')();
    const input = _input as FundingInputV0;
    const prevTx = input.prevTx;
    const prevTxOut = prevTx.outputs[input.prevTxVout];
    const scriptPubKey = prevTxOut.scriptPubKey.serialize().slice(1);
    const address = bitcoin.address.fromOutputScript(scriptPubKey, network);
    const { derivationPath } = await this.getMethod('findAddress')([address]);

    return {
      txid: prevTx.txId.toString(),
      vout: input.prevTxVout,
      address,
      amount: prevTxOut.value.bitcoin,
      value: prevTxOut.value.bitcoin,
      satoshis: Number(prevTxOut.value.sats),
      derivationPath,
      maxWitnessLength: input.maxWitnessLen,
      redeemScript: input.redeemScript
        ? input.redeemScript.toString('hex')
        : '',
      scriptPubKey: scriptPubKey.toString('hex'),
      inputSerialId: input.inputSerialId,
      toUtxo: Input.prototype.toUtxo,
    };
  }

  async inputToFundingInput(input: Input): Promise<FundingInput> {
    const fundingInput = new FundingInputV0();
    fundingInput.prevTxVout = input.vout;

    const txRaw = await this.getMethod('getRawTransactionByHash')(input.txid);
    const tx = Tx.parse(StreamReader.fromHex(txRaw));

    fundingInput.prevTx = tx;
    fundingInput.sequence = Sequence.default();
    fundingInput.maxWitnessLen = input.maxWitnessLength
      ? input.maxWitnessLength
      : 108;
    fundingInput.redeemScript = input.redeemScript
      ? Buffer.from(input.redeemScript, 'hex')
      : Buffer.from('', 'hex');
    fundingInput.inputSerialId = input.inputSerialId
      ? input.inputSerialId
      : randomBytes(4).reduce((acc, num, i) => acc + num ** i, 0);

    return fundingInput;
  }
}

interface GeneratedOutput {
  payout: number;
  groups: number[][];
}
