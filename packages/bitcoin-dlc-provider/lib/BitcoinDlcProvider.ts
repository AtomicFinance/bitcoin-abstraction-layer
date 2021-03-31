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
  AdaptorPair,
  PayoutRequest,
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
  DlcTransactions,
  DlcTransactionsV0,
  DlcSignV0,
  ContractInfoV0,
  ContractInfoV1,
  ContractDescriptorV0,
  ContractDescriptorV1,
  PayoutFunctionV0,
  HyperbolaPayoutCurvePiece,
  OracleEventV0,
  DigitDecompositionEventDescriptorV0,
  CetAdaptorSignaturesV0,
  NegotiationFieldsV0,
  ScriptWitnessV0,
  FundingSignaturesV0,
  OracleAttestationV0,
} from '@node-dlc/messaging';
import { Tx, Sequence, Script } from '@node-dlc/bitcoin';
import { StreamReader } from '@node-lightning/bufio';
import { sha256, hash160, xor } from '@node-lightning/crypto';
import * as bitcoinjs from 'bitcoinjs-lib';
import { bitcoin, wallet, Address } from './@types/@liquality/types';
import { generateSerialId } from './utils/Utils';
import {
  CoveredCall,
  groupByIgnoringDigits,
  roundPayout,
} from '@node-dlc/core';
import { math } from 'bip-schnorr';
import { asyncForEach } from './utils/Utils';
import { HyperbolaPayoutCurve } from '@node-dlc/core';
import BigNumber from 'bignumber.js';

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

  private async GetPrivKeysForInputs(inputs: Input[]): Promise<string[]> {
    const privKeys: string[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const keyPair = await this.client.getMethod('keyPair')(
        input.derivationPath,
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
   * TODO: Add GetPayoutFromOutcomes
   *
   * private GetPayoutsFromOutcomes(
   *   contractDescriptor: ContractDescriptorV0,
   *   totalCollateral: bigint,
   * ): PayoutRequest[] {}
   */

  private GetPayoutsFromPayoutFunction(
    _dlcOffer: DlcOffer,
    contractDescriptor: ContractDescriptorV1,
    totalCollateral: bigint,
  ): GetPayoutsResponse {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    if (contractDescriptor.payoutFunction.type !== MessageType.PayoutFunctionV0)
      throw Error('PayoutFunction must be V0');
    const payoutFunction = contractDescriptor.payoutFunction as PayoutFunctionV0;
    if (payoutFunction.pieces.length === 0)
      throw Error('PayoutFunction must have at least once PayoutCurvePiece');
    if (payoutFunction.pieces.length > 1)
      throw Error('More than one PayoutCurvePiece not supported');
    const payoutCurvePiece = payoutFunction.pieces[0].payoutCurvePiece;
    if (!(payoutCurvePiece instanceof HyperbolaPayoutCurvePiece))
      throw Error('Must be HyperbolaPayoutCurvePiece');
    if (payoutCurvePiece.b !== BigInt(0) || payoutCurvePiece.c !== BigInt(0))
      throw Error('b and c HyperbolaPayoutCurvePiece values must be 0');

    const roundingIntervals = contractDescriptor.roundingIntervals;
    const cetPayouts = CoveredCall.computePayouts(
      payoutFunction,
      totalCollateral,
      roundingIntervals,
    );

    const payoutGroups: PayoutGroup[] = [];
    cetPayouts.forEach((p) => {
      payoutGroups.push({
        payout: p.payout,
        // groups: groupByIgnoringDigits(p.indexFrom, p.indexTo, 2, 18),
        groups: groupByIgnoringDigits(p.indexFrom, p.indexTo, 2, 2), // TODO update this for base
      });
    });

    const rValuesMessagesList = this.GenerateMessages(dlcOffer.contractInfo);

    const { payouts, messagesList } = this.outputsToPayouts(
      payoutGroups,
      rValuesMessagesList,
      dlcOffer.offerCollateralSatoshis,
      dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateralSatoshis,
      true,
    );

    return { payouts, payoutGroups, messagesList };
  }

  private GetPayouts(_dlcOffer: DlcOffer): GetPayoutsResponse {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    switch (dlcOffer.contractInfo.type) {
      case MessageType.ContractInfoV0:
        // eslint-disable-next-line no-case-declarations
        const contractInfo = dlcOffer.contractInfo as ContractInfoV0;
        switch (contractInfo.contractDescriptor.type) {
          case MessageType.ContractDescriptorV0:
            throw Error('ContractDescriptorV0 not yet supported');
          case MessageType.ContractDescriptorV1:
            return this.GetPayoutsFromPayoutFunction(
              dlcOffer,
              contractInfo.contractDescriptor as ContractDescriptorV1,
              contractInfo.totalCollateral,
            );
          default:
            throw Error('ConractDescriptor must be V0 or V1');
        }
      case MessageType.ContractInfoV1:
        throw Error('MultiOracle not yet supported');
      default:
        throw Error('ContractInfo must be V0 or V1');
    }
  }

  private async CreateDlcTxs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
  ): Promise<CreateDlcTxsResponse> {
    if (
      _dlcOffer.type !== MessageType.DlcOfferV0 ||
      _dlcAccept.type !== MessageType.DlcAcceptV0
    ) {
      throw Error('DlcOffer and DlcAccept must be V0');
    }
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;

    const localFundPubkey = dlcOffer.fundingPubKey.toString('hex');
    const remoteFundPubkey = dlcAccept.fundingPubKey.toString('hex');
    const localFinalScriptPubkey = dlcOffer.payoutSPK.toString('hex');
    const remoteFinalScriptPubkey = dlcAccept.payoutSPK.toString('hex');
    const localChangeScriptPubkey = dlcOffer.changeSPK.toString('hex');
    const remoteChangeScriptPubkey = dlcAccept.changeSPK.toString('hex');

    const localInputs: Utxo[] = await Promise.all(
      dlcOffer.fundingInputs.map(async (fundingInput) => {
        const input = await this.fundingInputToInput(fundingInput);
        return input.toUtxo();
      }),
    );

    const remoteInputs: Utxo[] = await Promise.all(
      dlcAccept.fundingInputs.map(async (fundingInput) => {
        const input = await this.fundingInputToInput(fundingInput);
        return input.toUtxo();
      }),
    );

    const localInputAmount = localInputs.reduce<number>(
      (prev, cur) => prev + cur.amount.GetSatoshiAmount(),
      0,
    );

    const remoteInputAmount = remoteInputs.reduce<number>(
      (prev, cur) => prev + cur.amount.GetSatoshiAmount(),
      0,
    );

    const { payouts, messagesList } = this.GetPayouts(dlcOffer);

    const dlcTxRequest: CreateDlcTransactionsRequest = {
      payouts,
      localFundPubkey,
      localFinalScriptPubkey,
      remoteFundPubkey,
      remoteFinalScriptPubkey,
      localInputAmount,
      localCollateralAmount: dlcOffer.offerCollateralSatoshis,
      remoteInputAmount,
      remoteCollateralAmount: dlcAccept.acceptCollateralSatoshis,
      refundLocktime: dlcOffer.refundLocktime,
      localInputs,
      remoteInputs,
      localChangeScriptPubkey,
      remoteChangeScriptPubkey,
      feeRate: Number(dlcOffer.feeRatePerVb),
    };

    const dlcTxs = await this.CreateDlcTransactions(dlcTxRequest);

    const dlcTransactions = new DlcTransactionsV0();
    dlcTransactions.fundTx = Tx.parse(StreamReader.fromHex(dlcTxs.fundTxHex));
    dlcTransactions.fundTxOutAmount =
      dlcTransactions.fundTx.outputs[0].value.sats;
    dlcTransactions.refundTx = Tx.parse(
      StreamReader.fromHex(dlcTxs.refundTxHex),
    );
    dlcTransactions.cets = dlcTxs.cetsHex.map((cetHex) => {
      return Tx.parse(StreamReader.fromHex(cetHex));
    });

    return { dlcTransactions, messagesList };
  }

  private GenerateEnumMessages(oracleEvent: OracleEventV0): Messages[] {
    throw Error('Only DigitDecomposition Oracle Events supported');
  }

  private GenerateDigitDecompositionMessages(
    oracleEvent: OracleEventV0,
  ): Messages[] {
    const oracleNonces = oracleEvent.oracleNonces;
    const eventDescriptor = oracleEvent.eventDescriptor as DigitDecompositionEventDescriptorV0;

    const messagesList: Messages[] = [];
    oracleNonces.forEach((nonce) => {
      const messages = [];
      for (let i = 0; i < eventDescriptor.base; i++) {
        const m = math
          .taggedHash('DLC/oracle/attestation/v0', i.toString())
          .toString('hex');
        messages.push(m);
      }
      messagesList.push({ messages });
    });

    return messagesList;
  }

  private GenerateMessages(_contractInfo: ContractInfo): Messages[] {
    if (_contractInfo.type !== MessageType.ContractInfoV0)
      throw Error('ContractInfo must be V0');
    const contractInfo = _contractInfo as ContractInfoV0;
    const oracleEvent = contractInfo.oracleInfo.announcement.oracleEvent;

    switch (oracleEvent.eventDescriptor.type) {
      case MessageType.EnumEventDescriptorV0:
        return this.GenerateEnumMessages(oracleEvent);
      case MessageType.DigitDecompositionEventDescriptorV0:
        return this.GenerateDigitDecompositionMessages(oracleEvent);
      default:
        throw Error('EventDescriptor must be Enum or DigitDecomposition');
    }
  }

  private async CreateCetAdaptorAndRefundSigs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    messagesList: Messages[],
    isLocalParty: boolean,
  ): Promise<CreateCetAdaptorAndRefundSigsResponse> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcAccept must be V0');
    if (_dlcTxs.type !== MessageType.DlcTransactionsV0)
      throw Error('DlcTransactions must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;
    const dlcTxs = _dlcTxs as DlcTransactionsV0;
    const network = await this.getMethod('getConnectedNetwork')();

    const cetsHex = dlcTxs.cets.map((cet) => cet.serialize().toString('hex'));

    const fundingSPK = Script.p2wpkhLock(
      hash160(isLocalParty ? dlcOffer.fundingPubKey : dlcAccept.fundingPubKey),
    )
      .serialize()
      .slice(1);

    const fundingAddress: string = bitcoinjs.address.fromOutputScript(
      fundingSPK,
      network,
    );

    const { derivationPath } = await this.getMethod('findAddress')([
      fundingAddress,
    ]);

    const fundPrivateKeyPair = await this.client.getMethod('keyPair')(
      derivationPath,
    );

    const fundPrivateKey = Buffer.from(fundPrivateKeyPair.__D).toString('hex');

    if (dlcOffer.contractInfo.type !== MessageType.ContractInfoV0)
      throw Error('ContractInfo must be V0');
    const contractInfo = dlcOffer.contractInfo as ContractInfoV0;
    const oracleAnnouncement = contractInfo.oracleInfo.announcement;

    const chunk = 100;
    const adaptorSigRequestPromises: Promise<AdaptorPair[]>[] = [];

    console.log('cetsHex[27787]', cetsHex[27787]);
    console.log(
      `oracleAnnouncement.oracleEvent.oracleNonces.map(
      (nonce) => nonce.toString('hex'),
    )`,
      oracleAnnouncement.oracleEvent.oracleNonces.map((nonce) =>
        nonce.toString('hex'),
      ),
    );

    for (let i = 0, j = messagesList.length; i < j; i += chunk) {
      const tempMessagesList = messagesList.slice(i, i + chunk);
      const tempCetsHex = cetsHex.slice(i, i + chunk);

      const cetSignRequest: CreateCetAdaptorSignaturesRequest = {
        messagesList: tempMessagesList,
        cetsHex: tempCetsHex,
        privkey: fundPrivateKey,
        fundTxId: dlcTxs.fundTx.txId.toString(),
        localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
        remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
        fundInputAmount: dlcTxs.fundTxOutAmount,
        oraclePubkey: oracleAnnouncement.oraclePubkey.toString('hex'),
        oracleRValues: oracleAnnouncement.oracleEvent.oracleNonces.map(
          (nonce) => nonce.toString('hex'),
        ),
      };

      adaptorSigRequestPromises.push(
        (async () => {
          const response = await this.CreateCetAdaptorSignatures(
            cetSignRequest,
          );
          return response.adaptorPairs;
        })(),
      );
    }

    const adaptorPairs: AdaptorPair[] = (
      await Promise.all(adaptorSigRequestPromises)
    ).flat();

    const refundSignRequest: GetRawRefundTxSignatureRequest = {
      refundTxHex: dlcTxs.refundTx.serialize().toString('hex'),
      privkey: fundPrivateKey,
      fundTxId: dlcTxs.fundTx.txId.toString(),
      localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
      fundInputAmount: dlcTxs.fundTxOutAmount,
    };

    console.log('adaptorPairs[27787]', adaptorPairs[27787]);

    const sigs: ISig[] = adaptorPairs.map((adaptorPair) => {
      return {
        encryptedSig: Buffer.from(adaptorPair.signature, 'hex'),
        dleqProof: Buffer.from(adaptorPair.proof, 'hex'),
      };
    });

    const cetSignatures = new CetAdaptorSignaturesV0();
    cetSignatures.sigs = sigs;

    const refundSignature = Buffer.from(
      (await this.GetRawRefundTxSignature(refundSignRequest)).hex,
      'hex',
    );

    return { cetSignatures, refundSignature };
  }

  private async VerifyCetAdaptorAndRefundSigs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    messagesList: Messages[],
    isLocalParty: boolean,
  ): Promise<void> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcAccept must be V0');
    if (_dlcSign.type !== MessageType.DlcSignV0)
      throw Error('DlcSign must be V0');
    if (_dlcTxs.type !== MessageType.DlcTransactionsV0)
      throw Error('DlcTransactions must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;
    const dlcSign = _dlcSign as DlcSignV0;
    const dlcTxs = _dlcTxs as DlcTransactionsV0;

    const cetsHex = dlcTxs.cets.map((cet) => cet.serialize().toString('hex'));

    if (dlcOffer.contractInfo.type !== MessageType.ContractInfoV0)
      throw Error('ContractInfo must be V0');
    const contractInfo = dlcOffer.contractInfo as ContractInfoV0;
    const oracleAnnouncement = contractInfo.oracleInfo.announcement;

    const chunk = 100;
    const sigsValidity: Promise<boolean>[] = [];

    for (let i = 0, j = messagesList.length; i < j; i += chunk) {
      const tempMessagesList = messagesList.slice(i, i + chunk);
      const tempCetsHex = cetsHex.slice(i, i + chunk);
      const tempSigs = isLocalParty
        ? dlcAccept.cetSignatures.sigs.slice(i, i + chunk)
        : dlcSign.cetSignatures.sigs.slice(i, i + chunk);
      const tempAdaptorPairs = tempSigs.map((sig) => {
        return {
          signature: sig.encryptedSig.toString('hex'),
          proof: sig.dleqProof.toString('hex'),
        };
      });

      const verifyCetAdaptorSignaturesRequest: VerifyCetAdaptorSignaturesRequest = {
        cetsHex: tempCetsHex,
        messagesList: tempMessagesList,
        oraclePubkey: oracleAnnouncement.oraclePubkey.toString('hex'),
        oracleRValues: oracleAnnouncement.oracleEvent.oracleNonces.map(
          (nonce) => nonce.toString('hex'),
        ),
        adaptorPairs: tempAdaptorPairs,
        localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
        remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
        fundTxId: dlcTxs.fundTx.txId.toString(),
        fundInputAmount: dlcTxs.fundTxOutAmount,
        verifyRemote: isLocalParty,
      };

      sigsValidity.push(
        (async () => {
          const response = await this.VerifyCetAdaptorSignatures(
            verifyCetAdaptorSignaturesRequest,
          );
          return response.valid;
        })(),
      );
    }

    let areSigsValid = (await Promise.all(sigsValidity)).every((b) => b);

    const verifyRefundSigRequest: VerifyRefundTxSignatureRequest = {
      refundTxHex: dlcTxs.refundTx.serialize().toString('hex'),
      signature: isLocalParty
        ? dlcAccept.refundSignature.toString('hex')
        : dlcSign.refundSignature.toString('hex'),
      localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
      fundTxId: dlcTxs.fundTx.txId.toString(),
      fundInputAmount: dlcTxs.fundTxOutAmount,
      verifyRemote: isLocalParty,
    };

    areSigsValid =
      areSigsValid &&
      (await this.VerifyRefundTxSignature(verifyRefundSigRequest)).valid;

    if (!areSigsValid) {
      throw new Error('Invalid signatures received');
    }
  }

  private async CreateFundingSigs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    isLocalParty: boolean,
  ): Promise<FundingSignaturesV0> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcAccept must be V0');
    if (_dlcTxs.type !== MessageType.DlcTransactionsV0)
      throw Error('DlcTransactions must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;
    const dlcTxs = _dlcTxs as DlcTransactionsV0;

    const fundingInputs = isLocalParty
      ? dlcOffer.fundingInputs
      : dlcAccept.fundingInputs;

    const inputs: Input[] = await Promise.all(
      fundingInputs.map(async (fundingInput) => {
        return this.fundingInputToInput(fundingInput);
      }),
    );

    const inputPrivKeys = await this.GetPrivKeysForInputs(inputs);

    const fundTxSigs = await Promise.all(
      inputs.map(async (input, index) => {
        const fundTxSignRequest: GetRawFundTxSignatureRequest = {
          fundTxHex: dlcTxs.fundTx.serialize().toString('hex'),
          privkey: inputPrivKeys[index],
          prevTxId: input.txid,
          prevVout: input.vout,
          amount: input.value,
        };

        return (await this.GetRawFundTxSignature(fundTxSignRequest)).hex;
      }),
    );

    const inputPubKeys = await Promise.all(
      inputPrivKeys.map(async (privkey) => {
        const reqPrivKey = {
          privkey,
          isCompressed: true,
        };

        return (await this.getMethod('GetPubkeyFromPrivkey')(reqPrivKey))
          .pubkey;
      }),
    );

    const witnessElements: ScriptWitnessV0[][] = [];
    for (let i = 0; i < fundTxSigs.length; i++) {
      const sigWitness = new ScriptWitnessV0();
      sigWitness.witness = Buffer.from(fundTxSigs[i], 'hex');
      const pubKeyWitness = new ScriptWitnessV0();
      pubKeyWitness.witness = Buffer.from(inputPubKeys[i], 'hex');
      witnessElements.push([sigWitness, pubKeyWitness]);
    }

    const fundingSignatures = new FundingSignaturesV0();
    fundingSignatures.witnessElements = witnessElements;

    return fundingSignatures;
  }

  private async VerifyFundingSigs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    isLocalParty: boolean,
  ): Promise<void> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcAccept must be V0');
    if (_dlcSign.type !== MessageType.DlcSignV0)
      throw Error('DlcSign must be V0');
    if (_dlcTxs.type !== MessageType.DlcTransactionsV0)
      throw Error('DlcTransactions must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;
    const dlcSign = _dlcSign as DlcSignV0;
    const dlcTxs = _dlcTxs as DlcTransactionsV0;

    const sigsValidity: Promise<boolean>[] = [];
    for (let i = 0; i < dlcSign.fundingSignatures.witnessElements.length; i++) {
      const witnessElement = dlcSign.fundingSignatures.witnessElements[i];
      const signature = witnessElement[0].witness.toString('hex');
      const pubkey = witnessElement[1].witness.toString('hex');

      const fundingInput = isLocalParty
        ? (dlcAccept.fundingInputs[i] as FundingInputV0)
        : (dlcOffer.fundingInputs[i] as FundingInputV0);

      const verifyFundSigRequest: VerifyFundTxSignatureRequest = {
        fundTxHex: dlcTxs.fundTx.serialize().toString('hex'),
        signature,
        pubkey,
        prevTxId: fundingInput.prevTx.txId.toString(),
        prevVout: fundingInput.prevTxVout,
        fundInputAmount:
          fundingInput.prevTx.outputs[fundingInput.prevTxVout].value.sats,
      };

      sigsValidity.push(
        (async () => {
          const response = await this.VerifyFundTxSignature(
            verifyFundSigRequest,
          );
          return response.valid;
        })(),
      );
    }

    const areSigsValid = (await Promise.all(sigsValidity)).every((b) => b);

    if (!areSigsValid) {
      throw new Error('Invalid signatures received');
    }
  }

  private async CreateFundingTx(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    fundingSignatures: FundingSignaturesV0,
  ): Promise<void> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcAccept must be V0');
    if (_dlcSign.type !== MessageType.DlcSignV0)
      throw Error('DlcSign must be V0');
    if (_dlcTxs.type !== MessageType.DlcTransactionsV0)
      throw Error('DlcTransactions must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;
    const dlcSign = _dlcSign as DlcSignV0;
    const dlcTxs = _dlcTxs as DlcTransactionsV0;

    const witnessElements = [
      ...dlcSign.fundingSignatures.witnessElements,
      ...fundingSignatures.witnessElements,
    ];
    const fundingInputs = [
      ...dlcOffer.fundingInputs,
      ...dlcAccept.fundingInputs,
    ];

    let fundTxHex = dlcTxs.fundTx.serialize().toString('hex');

    await asyncForEach(
      witnessElements,
      async (witnessElement: ScriptWitnessV0, i: number) => {
        const signature = witnessElement[0].witness.toString('hex');
        const pubkey = witnessElement[1].witness.toString('hex');

        const fundingInput = fundingInputs[i] as FundingInputV0;

        const addSignRequest: AddSignatureToFundTransactionRequest = {
          fundTxHex,
          signature,
          prevTxId: fundingInput.prevTx.txId.toString(),
          prevVout: fundingInput.prevTxVout,
          pubkey,
        };
        fundTxHex = (await this.AddSignatureToFundTransaction(addSignRequest))
          .hex;
      },
    );

    dlcTxs.fundTx = Tx.parse(StreamReader.fromHex(fundTxHex));
  }

  async FindOutcomeIndexFromHyperbolaPayoutCurvePiece(
    _dlcOffer: DlcOffer,
    contractDescriptor: ContractDescriptorV1,
    hyperbolaPayoutCurvePiece: HyperbolaPayoutCurvePiece,
    oracleAttestation: OracleAttestationV0,
    outcome: bigint,
  ): Promise<number> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;

    const hyperbolaCurve = HyperbolaPayoutCurve.fromPayoutCurvePiece(
      hyperbolaPayoutCurvePiece,
    );
    const payout = hyperbolaCurve.getPayout(outcome);

    const { payoutGroups } = this.GetPayouts(dlcOffer);

    const intervalsSorted = contractDescriptor.roundingIntervals.intervals.sort(
      (a, b) => Number(b.beginInterval) - Number(a.beginInterval),
    );

    const interval = intervalsSorted.find(
      (interval) => payout.toNumber() > Number(interval.beginInterval),
    );

    console.log('outcome', outcome);
    console.log('payout', payout.toNumber());

    let roundedPayout = await roundPayout(payout, interval.roundingMod);

    console.log('oracleAttestation.outcomes', oracleAttestation.outcomes);
    const outcomesFormatted = oracleAttestation.outcomes.map((outcome) =>
      parseInt(outcome),
    );

    console.log('roundedPayout', roundedPayout);
    console.log('outcomesFormatted', outcomesFormatted);

    console.log(
      'dlcOffer.totalcolalteral',
      dlcOffer.contractInfo.totalCollateral,
    );

    if (roundedPayout > dlcOffer.contractInfo.totalCollateral) {
      roundedPayout = dlcOffer.contractInfo.totalCollateral;
    }

    console.log('roundedPayout', roundedPayout);
    console.log('payoutGroups', payoutGroups[0]);

    let index = 0;
    for (const payoutGroup of payoutGroups) {
      if (payoutGroup.payout === roundedPayout) {
        index += payoutGroup.groups.findIndex((group) => {
          console.log('group', group);
          console.log('group.length', group.length);
          return group.every((msg, i) => msg === outcomesFormatted[i]);
        });
        break;
      } else {
        index += payoutGroup.groups.length;
      }
    }

    return index;
  }

  async FindOutcomeIndexFromPayoutFunction(
    dlcOffer: DlcOffer,
    contractDescriptor: ContractDescriptorV1,
    eventDescriptor: DigitDecompositionEventDescriptorV0,
    oracleAttestation: OracleAttestationV0,
  ): Promise<number> {
    const _payoutFunction = contractDescriptor.payoutFunction;
    if (_payoutFunction.type !== MessageType.PayoutFunctionV0)
      throw Error('PayoutFunction must be V0');
    const payoutFunction = _payoutFunction as PayoutFunctionV0;
    const base = eventDescriptor.base;

    const outcome: number = [...oracleAttestation.outcomes]
      .reverse()
      .reduce((acc, val, i) => acc + Number(val) * base ** i, 0);
    console.log('outcome', outcome);

    const piecesSorted = payoutFunction.pieces.sort(
      (a, b) => Number(b.endpoint) - Number(a.endpoint),
    );

    const piece = piecesSorted.find((piece) => outcome < piece.endpoint);

    switch (piece.payoutCurvePiece.type) {
      case MessageType.PolynomialPayoutCurvePiece:
        throw Error('Polynomial Curve Piece not yet supported');
      case MessageType.HyperbolaPayoutCurvePiece:
        return this.FindOutcomeIndexFromHyperbolaPayoutCurvePiece(
          dlcOffer,
          contractDescriptor,
          piece.payoutCurvePiece as HyperbolaPayoutCurvePiece,
          oracleAttestation,
          BigInt(outcome),
        );
      default:
        throw Error('Must be Hyperbola or Polynomial curve piece');
    }
  }

  async FindOutcomeIndex(
    _dlcOffer: DlcOffer,
    oracleAttestation: OracleAttestationV0,
  ): Promise<number> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    switch (dlcOffer.contractInfo.type) {
      case MessageType.ContractInfoV0:
        // eslint-disable-next-line no-case-declarations
        const contractInfo = dlcOffer.contractInfo as ContractInfoV0;
        switch (contractInfo.contractDescriptor.type) {
          case MessageType.ContractDescriptorV0:
            throw Error('ContractDescriptorV0 not yet supported');
          case MessageType.ContractDescriptorV1:
            return this.FindOutcomeIndexFromPayoutFunction(
              dlcOffer,
              contractInfo.contractDescriptor as ContractDescriptorV1,
              contractInfo.oracleInfo.announcement.oracleEvent
                .eventDescriptor as DigitDecompositionEventDescriptorV0,
              oracleAttestation,
            );
          default:
            throw Error('ConractDescriptor must be V0 or V1');
        }
      case MessageType.ContractInfoV1:
        throw Error('MultiOracle not yet supported');
      default:
        throw Error('ContractInfo must be V0 or V1');
    }
  }

  async FindAndSignCet(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    oracleAttestation: OracleAttestationV0,
    isLocalParty: boolean,
  ): Promise<Tx> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcAccept must be V0');
    if (_dlcSign.type !== MessageType.DlcSignV0)
      throw Error('DlcSign must be V0');
    if (_dlcTxs.type !== MessageType.DlcTransactionsV0)
      throw Error('DlcTransactions must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;
    const dlcSign = _dlcSign as DlcSignV0;
    const dlcTxs = _dlcTxs as DlcTransactionsV0;

    const outcomeIndex = await this.FindOutcomeIndex(
      dlcOffer,
      oracleAttestation,
    );

    console.log('outcomeIndex', outcomeIndex);

    const network = await this.getMethod('getConnectedNetwork')();

    const fundingSPK = Script.p2wpkhLock(
      hash160(isLocalParty ? dlcOffer.fundingPubKey : dlcAccept.fundingPubKey),
    )
      .serialize()
      .slice(1);

    const fundingAddress: string = bitcoinjs.address.fromOutputScript(
      fundingSPK,
      network,
    );

    const { derivationPath } = await this.getMethod('findAddress')([
      fundingAddress,
    ]);

    const fundPrivateKeyPair = await this.client.getMethod('keyPair')(
      derivationPath,
    );

    const fundPrivateKey = Buffer.from(fundPrivateKeyPair.__D).toString('hex');

    console.log(
      'oracle',
      oracleAttestation.signatures.map((sig) => sig.toString('hex')),
    );

    console.log('dlcTxs.cets.length', dlcTxs.cets.length);
    console.log(
      'dlcSign.cetSignatures.sigs',
      dlcSign.cetSignatures.sigs.length,
    );
    console.log(
      'dlcAccept.cetSignatures.sigs',
      dlcAccept.cetSignatures.sigs.length,
    );

    const signCetRequest: SignCetRequest = {
      cetHex: dlcTxs.cets[outcomeIndex].serialize().toString('hex'),
      fundPrivkey: fundPrivateKey,
      fundTxId: dlcTxs.fundTx.txId.toString(),
      localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
      oracleSignatures: oracleAttestation.signatures.map((sig) =>
        sig.toString('hex'),
      ),
      fundInputAmount: dlcTxs.fundTxOutAmount,
      adaptorSignature: isLocalParty
        ? dlcAccept.cetSignatures.sigs[outcomeIndex].encryptedSig.toString(
            'hex',
          )
        : dlcSign.cetSignatures.sigs[outcomeIndex].encryptedSig.toString('hex'),
    };

    console.log('signCetRequest', signCetRequest);

    const finalCet = (await this.SignCet(signCetRequest)).hex;
    console.log('finalCet', finalCet);

    return Tx.parse(StreamReader.fromHex(finalCet));

    // dlcOffer.contractInfo

    // HyperbolaPayoutCurve()

    // const { payoutGroups } = this.GetPayouts(dlcOffer);

    // const outcomes = oracleAttestation.outcomes.map((outcome) =>
    //   parseInt(outcome),
    // );

    // const index = -1;
    // payoutGroups.forEach((payoutGroup, i) => {
    // payoutGroup.groups.forEach((group, j) => {
    //   index++;
    // });
    // });
  }

  outputsToPayouts(
    outputs: PayoutGroup[],
    rValuesMessagesList: Messages[],
    localCollateral: bigint,
    remoteCollateral: bigint,
    payoutLocal: boolean,
  ): { payouts: PayoutRequest[]; messagesList: Messages[] } {
    const payouts: PayoutRequest[] = [];
    const messagesList: Messages[] = [];

    outputs.forEach((output: any) => {
      const { payout, groups } = output;
      const payoutAmount: bigint = payout;

      groups.forEach((group: number[]) => {
        const messages = [];
        for (let i = 0; i < group.length; i++) {
          const digit: number = group[i];
          messages.push(rValuesMessagesList[i].messages[digit]);
        }

        const local = payoutLocal
          ? payoutAmount
          : localCollateral + remoteCollateral - payoutAmount;
        const remote = payoutLocal
          ? localCollateral + remoteCollateral - payoutAmount
          : payoutAmount;
        payouts.push({ local, remote });
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
    _dlcOffer: DlcOffer,
    fixedInputs?: Input[],
  ): Promise<ConfirmContractOfferResponse> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;

    const acceptCollateralSatoshis =
      dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateralSatoshis;

    const {
      fundingPubKey,
      payoutSPK,
      payoutSerialId,
      fundingInputs: _fundingInputs,
      changeSPK,
      changeSerialId,
    } = await this.Initialize(
      acceptCollateralSatoshis,
      dlcOffer.feeRatePerVb,
      fixedInputs,
    );

    _fundingInputs.forEach((input) => {
      if (input.type !== MessageType.FundingInputV0)
        throw Error('FundingInput must be V0');
    });
    const fundingInputs: FundingInputV0[] = _fundingInputs.map(
      (input) => input as FundingInputV0,
    );

    const dlcAccept = new DlcAcceptV0();

    dlcAccept.tempContractId = sha256(dlcOffer.serialize());
    dlcAccept.acceptCollateralSatoshis = acceptCollateralSatoshis;
    dlcAccept.fundingPubKey = fundingPubKey;
    dlcAccept.payoutSPK = payoutSPK;
    dlcAccept.payoutSerialId = payoutSerialId;
    dlcAccept.fundingInputs = fundingInputs;
    dlcAccept.changeSPK = changeSPK;
    dlcAccept.changeSerialId = changeSerialId;

    const { dlcTransactions, messagesList } = await this.CreateDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    const {
      cetSignatures,
      refundSignature,
    } = await this.CreateCetAdaptorAndRefundSigs(
      dlcOffer,
      dlcAccept,
      dlcTransactions,
      messagesList,
      false,
    );

    dlcAccept.cetSignatures = cetSignatures;
    dlcAccept.refundSignature = refundSignature;
    dlcAccept.negotiationFields = new NegotiationFieldsV0();

    return { dlcAccept, dlcTransactions };
  }

  async signContract(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
  ): Promise<SignContractResponse> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcAccept.type !== MessageType.DlcAcceptV0)
      throw Error('DlcAccept must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;

    const dlcSign = new DlcSignV0();

    const { dlcTransactions, messagesList } = await this.CreateDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    await this.VerifyCetAdaptorAndRefundSigs(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      messagesList,
      true,
    );

    const {
      cetSignatures,
      refundSignature,
    } = await this.CreateCetAdaptorAndRefundSigs(
      dlcOffer,
      dlcAccept,
      dlcTransactions,
      messagesList,
      true,
    );

    const fundingSignatures = await this.CreateFundingSigs(
      dlcOffer,
      dlcAccept,
      dlcTransactions,
      true,
    );

    const dlcTxs = dlcTransactions as DlcTransactionsV0;

    const contractId = xor(
      dlcTxs.fundTx.txId.serialize(),
      dlcAccept.tempContractId,
    );

    dlcSign.contractId = contractId;
    dlcSign.cetSignatures = cetSignatures;
    dlcSign.refundSignature = refundSignature;
    dlcSign.fundingSignatures = fundingSignatures;

    return { dlcSign, dlcTransactions };
  }

  async finalizeContract(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTransactions: DlcTransactions,
  ): Promise<DlcTransactions> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcAccept.type !== MessageType.DlcAcceptV0)
      throw Error('DlcAccept must be V0');
    if (_dlcSign.type !== MessageType.DlcSignV0)
      throw Error('DlcSign must be V0');
    if (_dlcTransactions.type !== MessageType.DlcTransactionsV0)
      throw Error('DlcTransactions must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;
    const dlcSign = _dlcSign as DlcSignV0;
    const dlcTransactions = _dlcTransactions as DlcTransactionsV0;

    const { messagesList } = await this.GetPayouts(dlcOffer);

    await this.VerifyCetAdaptorAndRefundSigs(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      messagesList,
      false,
    );

    await this.VerifyFundingSigs(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      false,
    );

    const fundingSignatures = await this.CreateFundingSigs(
      dlcOffer,
      dlcAccept,
      dlcTransactions,
      false,
    );

    await this.CreateFundingTx(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      fundingSignatures,
    );

    return dlcTransactions;
  }

  async refund(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTransactions: DlcTransactions,
  ): Promise<DlcTransactions> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcAccept.type !== MessageType.DlcAcceptV0)
      throw Error('DlcAccept must be V0');
    if (_dlcSign.type !== MessageType.DlcSignV0)
      throw Error('DlcSign must be V0');
    if (_dlcTransactions.type !== MessageType.DlcTransactionsV0)
      throw Error('DlcTransactions must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;
    const dlcSign = _dlcSign as DlcSignV0;
    const dlcTransactions = _dlcTransactions as DlcTransactionsV0;

    const signatures =
      Buffer.compare(dlcOffer.fundingPubKey, dlcAccept.fundingPubKey) === -1
        ? [
            dlcSign.refundSignature.toString('hex'),
            dlcAccept.refundSignature.toString('hex'),
          ]
        : [
            dlcAccept.refundSignature.toString('hex'),
            dlcSign.refundSignature.toString('hex'),
          ];

    const addSigsToRefundTxRequest: AddSignaturesToRefundTxRequest = {
      refundTxHex: dlcTransactions.refundTx.serialize().toString('hex'),
      signatures,
      fundTxId: dlcTransactions.fundTx.txId.toString(),
      localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
    };

    const refundHex = (
      await this.AddSignaturesToRefundTx(addSigsToRefundTxRequest)
    ).hex;

    dlcTransactions.refundTx = Tx.parse(StreamReader.fromHex(refundHex));

    return dlcTransactions;
  }

  async execute(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTransactions: DlcTransactions,
    oracleAttestation: OracleAttestationV0,
    isLocalParty: boolean,
  ): Promise<Tx> {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    if (_dlcAccept.type !== MessageType.DlcAcceptV0)
      throw Error('DlcAccept must be V0');
    if (_dlcSign.type !== MessageType.DlcSignV0)
      throw Error('DlcSign must be V0');
    if (_dlcTransactions.type !== MessageType.DlcTransactionsV0)
      throw Error('DlcTransactions must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    const dlcAccept = _dlcAccept as DlcAcceptV0;
    const dlcSign = _dlcSign as DlcSignV0;
    const dlcTransactions = _dlcTransactions as DlcTransactionsV0;

    console.log('execute-1');

    // const cet =
    return this.FindAndSignCet(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      isLocalParty,
    );

    // get outcomeIndex
    // const signCetRequest: SignCetRequest = {
    //   cetHex: this.contract.cetsHex[outcomeIndex],
    //   fundPrivkey: this.fundPrivateKey,
    //   fundTxId: this.contract.fundTxId,
    //   localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
    //   remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
    //   oracleSignatures,
    //   fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    //   adaptorSignature: this.contract.cetAdaptorPairs[outcomeIndex].signature,
    // };
    // const finalCet = (await this.client.SignCet(signCetRequest)).hex;
    // let cetTxHash;
    // try {
    //   cetTxHash = await this.client.getMethod('sendRawTransaction')(finalCet);
    // } catch (e) {
    //   const cetTxid = decodeRawTransaction(finalCet).txid;
    //   try {
    //     cetTxHash = (
    //       await this.client.getMethod('getTransactionByHash')(cetTxid)
    //     ).hash;
    //     console.log('Cet Tx already created');
    //   } catch (e) {
    //     throw Error(
    //       `Failed to sendRawTransaction cetHex and tx has not been previously broadcast. cetHex: ${finalCet}`,
    //     );
    //   }
    // }
    // return cetTxHash;
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
    const inputAddress: Address = await this.getMethod('findAddress')([
      address,
    ]);
    let derivationPath: string;
    if (inputAddress) {
      derivationPath = inputAddress.derivationPath;
    }

    return {
      txid: prevTx.txId.toString(),
      vout: input.prevTxVout,
      address,
      amount: prevTxOut.value.bitcoin,
      value: Number(prevTxOut.value.sats),
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

export interface ConfirmContractOfferResponse {
  dlcAccept: DlcAccept;
  dlcTransactions: DlcTransactions;
}

export interface SignContractResponse {
  dlcSign: DlcSign;
  dlcTransactions: DlcTransactions;
}

export interface GetPayoutsResponse {
  payouts: PayoutRequest[];
  payoutGroups: PayoutGroup[];
  messagesList: Messages[];
}

export interface CreateDlcTxsResponse {
  dlcTransactions: DlcTransactions;
  messagesList: Messages[];
}

interface ISig {
  encryptedSig: Buffer;
  dleqProof: Buffer;
}

export interface CreateCetAdaptorAndRefundSigsResponse {
  cetSignatures: CetAdaptorSignaturesV0;
  refundSignature: Buffer;
}

interface PayoutGroup {
  payout: bigint;
  groups: number[][];
}

const BurnAddress = 'bcrt1qxcjufgh2jarkp2qkx68azh08w9v5gah8u6es8s';
