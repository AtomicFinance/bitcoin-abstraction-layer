import Provider from '@atomicfinance/provider';
import { sleep } from '@liquality/utils';
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

import Input from './models/Input';
import OfferMessage from './models/OfferMessage';
import AcceptMessage from './models/AcceptMessage';
import Utxo from './models/Utxo';
import {
  ContractInfo,
  FundingInput,
  DlcOffer,
  FundingInputV0,
  MessageType,
  DlcAccept,
  DlcOfferV0,
  DlcAcceptV0,
  DlcSign,
  DlcSignV0,
} from '@node-dlc/messaging';
import { Tx, Sequence } from '@node-dlc/bitcoin';
import { StreamReader } from '@node-lightning/bufio';
import * as bitcoinjs from 'bitcoinjs-lib';
import { bitcoin, wallet, Address } from './@types/@liquality/types';
import { generateSerialId } from './utils/Utils';

const ESTIMATED_SIZE = 312;

export default class BitcoinDlcProvider extends Provider {
  _network: any;
  _cfdDlcJs: any;

  constructor(network: any, cfdDlcJs?: any) {
    super('BitcoinDlcProvider');

    this._network = network;
    this._cfdDlcJs = cfdDlcJs;
  }

  private async CfdLoaded() {
    while (!this._cfdDlcJs) {
      await sleep(10);
    }
  }

  private async GetPrivKeysForUtxos(utxoSet: Utxo[]): Promise<string[]> {
    const privKeys: string[] = [];

    for (let i = 0; i < utxoSet.length; i++) {
      const utxo = utxoSet[i];
      const keyPair = await this.client.getMethod('keyPair')(
        utxo.derivationPath,
      );
      const privKey = Buffer.from(keyPair.__D).toString('hex');
      privKeys.push(privKey);
    }

    return privKeys;
  }

  async GetInputsForAmount(
    amount: bigint,
    feeRatePerVb: bigint,
    fixedInputs: Input[],
  ): Promise<Input[]> {
    if (amount === BigInt(0)) return [];
    const targets: bitcoin.OutputTarget[] = [
      {
        address: BurnAddress,
        value: Number(amount) + ESTIMATED_SIZE * (Number(feeRatePerVb) - 1),
      },
    ];
    let inputs: Input[];
    try {
      const inputsForAmount: wallet.InputsForAmountResponse = await this.getMethod(
        'getInputsForAmount',
      )(targets, Number(feeRatePerVb), fixedInputs);
      inputs = inputsForAmount.inputs;
    } catch (e) {
      if (fixedInputs.length === 0) {
        throw Error('Not enough balance getInputsForAmount');
      } else {
        inputs = fixedInputs;
      }
    }

    return inputs;
  }

  private async Initialize(
    collateral: bigint,
    feeRatePerVb: bigint,
    fixedInputs: Input[],
  ): Promise<InitializeResponse> {
    const network = await this.getMethod('getConnectedNetwork')();
    const payoutAddress: Address = await this.client.wallet.getUnusedAddress(
      false,
    );
    const payoutSPK: Buffer = bitcoinjs.address.toOutputScript(
      payoutAddress.address,
      network,
    );
    const changeAddress: Address = await this.client.wallet.getUnusedAddress(
      true,
    );
    const changeSPK: Buffer = bitcoinjs.address.toOutputScript(
      changeAddress.address,
      network,
    );

    const fundingAddress: Address = await this.client.wallet.getUnusedAddress(
      false,
    );
    const fundingPubKey: Buffer = Buffer.from(fundingAddress.publicKey, 'hex');

    if (fundingAddress.address === payoutAddress.address)
      throw Error('Address reuse');

    // Need to get funding inputs
    const inputs: Input[] = await this.GetInputsForAmount(
      collateral,
      feeRatePerVb,
      fixedInputs,
    );
    const fundingInputs: FundingInput[] = await Promise.all(
      inputs.map(async (input) => {
        return this.inputToFundingInput(input);
      }),
    );

    const payoutSerialId: bigint = generateSerialId();
    const changeSerialId: bigint = generateSerialId();

    return {
      fundingPubKey,
      payoutSPK,
      payoutSerialId,
      fundingInputs,
      changeSPK,
      changeSerialId,
    };
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
  ): Promise<DlcOffer> {
    const dlcOffer = new DlcOfferV0();

    const {
      fundingPubKey,
      payoutSPK,
      payoutSerialId,
      fundingInputs: _fundingInputs,
      changeSPK,
      changeSerialId,
    } = await this.Initialize(
      offerCollateralSatoshis,
      feeRatePerVb,
      fixedInputs,
    );

    _fundingInputs.forEach((input) => {
      if (input.type !== MessageType.FundingInputV0)
        throw Error('FundingInput must be V0');
    });
    const fundingInputs: FundingInputV0[] = _fundingInputs.map(
      (input) => input as FundingInputV0,
    );

    dlcOffer.contractFlags = Buffer.from('00', 'hex');
    dlcOffer.chainHash = Buffer.from(
      '06226e46111a0b59caaf126043eb5bbf28c34f3a5e332a1fc7b2b73cf188910f', // TODO update this
      'hex',
    );
    dlcOffer.contractInfo = contractInfo;
    dlcOffer.fundingPubKey = fundingPubKey;
    dlcOffer.payoutSPK = payoutSPK;
    dlcOffer.payoutSerialId = payoutSerialId;
    dlcOffer.offerCollateralSatoshis = offerCollateralSatoshis;
    dlcOffer.fundingInputs = fundingInputs;
    dlcOffer.changeSPK = changeSPK;
    dlcOffer.changeSerialId = changeSerialId;
    dlcOffer.fundOutputSerialId = generateSerialId();
    dlcOffer.feeRatePerVb = feeRatePerVb;
    dlcOffer.cetLocktime = cetLocktime;
    dlcOffer.refundLocktime = refundLocktime;

    return dlcOffer;
  }

  async confirmContractOffer(
    dlcOffer: DlcOffer,
    fixedInputs?: Input[],
  ): Promise<DlcAccept> {
    const dlcAccept = new DlcAcceptV0();

    return dlcAccept;
  }

  async signContract(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAcceptV0,
  ): Promise<DlcSign> {
    const dlcSign = new DlcSignV0();

    return dlcSign;
  }

  async finalizeContract(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
  ): Promise<string> {
    return '';
  }

  async refund(contractId: string): Promise<string> {
    return '';
  }

  async unilateralClose(
    outcomeIndex: number,
    oracleSignatures: string[],
    contractId: string,
  ): Promise<string> {
    return '';
  }

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
    const address = bitcoinjs.address.fromOutputScript(scriptPubKey, network);
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
      : generateSerialId();

    return fundingInput;
  }
}

interface GeneratedOutput {
  payout: number;
  groups: number[][];
}

export interface InitializeResponse {
  fundingPubKey: Buffer;
  payoutSPK: Buffer;
  payoutSerialId: bigint;
  fundingInputs: FundingInput[];
  changeSPK: Buffer;
  changeSerialId: bigint;
}

const BurnAddress = 'bcrt1qxcjufgh2jarkp2qkx68azh08w9v5gah8u6es8s';
