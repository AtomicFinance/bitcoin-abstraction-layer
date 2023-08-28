import Provider from '@atomicfinance/provider';
import {
  AdaptorPair,
  Address,
  AddSignaturesToRefundTxRequest,
  AddSignaturesToRefundTxResponse,
  AddSignatureToFundTransactionRequest,
  AddSignatureToFundTransactionResponse,
  bitcoin,
  CalculateEcSignatureRequest,
  CreateCetAdaptorSignatureRequest,
  CreateCetAdaptorSignatureResponse,
  CreateCetAdaptorSignaturesRequest,
  CreateCetAdaptorSignaturesResponse,
  CreateCetRequest,
  CreateCetResponse,
  CreateDlcTransactionsRequest,
  CreateDlcTransactionsResponse,
  CreateFundTransactionRequest,
  CreateFundTransactionResponse,
  CreateRawTransactionRequest,
  CreateRefundTransactionRequest,
  CreateRefundTransactionResponse,
  CreateSignatureHashRequest,
  DlcProvider,
  GetRawFundTxSignatureRequest,
  GetRawFundTxSignatureResponse,
  GetRawRefundTxSignatureRequest,
  GetRawRefundTxSignatureResponse,
  Input,
  Messages,
  PayoutRequest,
  SignCetRequest,
  SignCetResponse,
  SignFundTransactionRequest,
  SignFundTransactionResponse,
  Utxo,
  VerifyCetAdaptorSignatureRequest,
  VerifyCetAdaptorSignatureResponse,
  VerifyCetAdaptorSignaturesRequest,
  VerifyCetAdaptorSignaturesResponse,
  VerifyFundTxSignatureRequest,
  VerifyFundTxSignatureResponse,
  VerifyRefundTxSignatureRequest,
  VerifyRefundTxSignatureResponse,
  VerifySignatureRequest,
} from '@atomicfinance/types';
import { sleep } from '@atomicfinance/utils';
import {
  DualClosingTxFinalizer,
  DualFundingTxFinalizer,
  groupByIgnoringDigits,
  HyperbolaPayoutCurve,
  PolynomialPayoutCurve,
  roundPayout,
} from '@node-dlc/core';
import {
  CetAdaptorSignatures,
  ContractDescriptor,
  ContractInfo,
  DigitDecompositionEventDescriptorV0Pre167,
  DisjointContractInfo,
  DlcAccept,
  DlcAcceptV0,
  DlcClose,
  DlcCloseMetadata,
  DlcCloseV0,
  DlcOffer,
  DlcOfferV0,
  DlcSign,
  DlcSignV0,
  DlcTransactions,
  DlcTransactionsV0,
  FundingInput,
  FundingSignatures,
  HyperbolaPayoutCurvePiece,
  MessageType,
  NumericContractDescriptor,
  OracleAttestationV0Pre167,
  OracleEventV0Pre167,
  OracleInfo,
  PayoutFunction,
  PolynomialPayoutCurvePiece,
  ScriptWitness,
  SingleContractInfo,
  SingleNegotiationFields,
  SingleOracleInfo,
  ContractInfoType,
  ContractDescriptorType,
  PayoutCurvePieceType,
} from '@node-dlc/messaging';
import { Script, Sequence, Tx } from '@node-lightning/bitcoin';
import { StreamReader } from '@node-lightning/bufio';
import { hash160, sha256, xor } from '@node-lightning/crypto';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { BitcoinNetwork, chainHashFromNetwork } from 'bitcoin-networks';
import {
  address,
  ECPairInterface,
  payments,
  Psbt,
  script,
} from 'bitcoinjs-lib';

import {
  asyncForEach,
  checkTypes,
  generateSerialId,
  outputsToPayouts,
} from './utils/Utils';

const ESTIMATED_SIZE = 312;

export default class BitcoinDlcProvider
  extends Provider
  implements Partial<DlcProvider> {
  _network: BitcoinNetwork;
  _cfdDlcJs: any;

  constructor(network: BitcoinNetwork, cfdDlcJs?: any) {
    super();

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
      let derivationPath = input.derivationPath;

      if (!derivationPath) {
        derivationPath = (
          await this.getMethod('getWalletAddress')(input.address)
        ).derivationPath;
      }

      const keyPair = await this.getMethod('keyPair')(derivationPath);
      const privKey = Buffer.from(keyPair.__D).toString('hex');
      privKeys.push(privKey);
    }

    return privKeys;
  }

  async GetCfdNetwork(): Promise<string> {
    const network = await this.getConnectedNetwork();

    switch (network.name) {
      case 'bitcoin_testnet':
        return 'testnet';
      case 'bitcoin_regtest':
        return 'regtest';
      default:
        return 'bitcoin';
    }
  }

  async GetInputsForAmount(
    amount: bigint,
    feeRatePerVb: bigint,
    fixedInputs: Input[] = [],
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
      const inputsForAmount: InputsForAmountResponse = await this.getMethod(
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
    const network = await this.getConnectedNetwork();
    const payoutAddress: Address = await this.client.wallet.getUnusedAddress(
      false,
    );
    const payoutSPK: Buffer = address.toOutputScript(
      payoutAddress.address,
      network,
    );
    const changeAddress: Address = await this.client.wallet.getUnusedAddress(
      true,
    );
    const changeSPK: Buffer = address.toOutputScript(
      changeAddress.address,
      network,
    );

    const fundingAddress: Address = await this.client.wallet.getUnusedAddress(
      false,
    );
    const fundingPubKey: Buffer = Buffer.from(fundingAddress.publicKey, 'hex');

    if (fundingAddress.address === payoutAddress.address)
      throw Error('Address reuse');

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
    contractDescriptor: NumericContractDescriptor,
    oracleInfo: OracleInfo,
    totalCollateral: bigint,
  ): GetPayoutsResponse {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    if (contractDescriptor.payoutFunction.type !== MessageType.PayoutFunctionV0)
      throw Error('PayoutFunction must be V0');
    const payoutFunction = contractDescriptor.payoutFunction as PayoutFunction;
    if (payoutFunction.pieces.length === 0)
      throw Error('PayoutFunction must have at least once PayoutCurvePiece');
    if (payoutFunction.pieces.length > 1)
      throw Error('More than one PayoutCurvePiece not supported');
    const payoutCurvePiece = payoutFunction.pieces[0]
      .payoutCurvePiece as HyperbolaPayoutCurvePiece;
    if (
      payoutCurvePiece.type !== PayoutCurvePieceType.HyperbolaPayoutCurvePiece
    )
      throw Error('Must be HyperbolaPayoutCurvePiece');
    if (
      payoutCurvePiece.b.toString() !== '0' ||
      payoutCurvePiece.c.toString() !== '0'
    )
      throw Error('b and c HyperbolaPayoutCurvePiece values must be 0');
    const eventDescriptor = (oracleInfo as SingleOracleInfo).announcement
      .oracleEvent.eventDescriptor as DigitDecompositionEventDescriptorV0Pre167;
    if (
      eventDescriptor.type !== MessageType.DigitDecompositionEventDescriptorV0
    )
      throw Error('Only DigitDecomposition Oracle Events supported');

    const roundingIntervals = contractDescriptor.roundingIntervals;
    const cetPayouts = HyperbolaPayoutCurve.computePayouts(
      payoutFunction,
      totalCollateral,
      roundingIntervals,
    );

    const payoutGroups: PayoutGroup[] = [];
    cetPayouts.forEach((p) => {
      payoutGroups.push({
        payout: p.payout,
        groups: groupByIgnoringDigits(
          p.indexFrom,
          p.indexTo,
          eventDescriptor.base,
          contractDescriptor.numDigits,
        ),
      });
    });

    const rValuesMessagesList = this.GenerateMessages(oracleInfo);

    const { payouts, messagesList } = outputsToPayouts(
      payoutGroups,
      rValuesMessagesList,
      dlcOffer.offerCollateral,
      dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateral,
      true,
    );

    return { payouts, payoutGroups, messagesList };
  }

  private GetPayoutsFromPolynomialPayoutFunction(
    _dlcOffer: DlcOffer,
    contractDescriptor: NumericContractDescriptor,
    oracleInfo: OracleInfo,
    totalCollateral: bigint,
  ): GetPayoutsResponse {
    if (_dlcOffer.type !== MessageType.DlcOfferV0)
      throw Error('DlcOffer must be V0');
    const dlcOffer = _dlcOffer as DlcOfferV0;
    if (contractDescriptor.payoutFunction.type !== MessageType.PayoutFunctionV0)
      throw Error('PayoutFunction must be V0');
    const payoutFunction = contractDescriptor.payoutFunction as PayoutFunction;

    if (payoutFunction.pieces.length === 0)
      throw Error('PayoutFunction must have at least once PayoutCurvePiece');
    for (const piece of payoutFunction.pieces) {
      if (
        piece.payoutCurvePiece.type !== PayoutCurvePieceType.PolynomialPayoutCurvePiece
      )
        throw Error('Must be PolynomialPayoutCurvePiece');
    }
    const eventDescriptor = (oracleInfo as SingleOracleInfo).announcement
      .oracleEvent.eventDescriptor as DigitDecompositionEventDescriptorV0Pre167;
    if (
      eventDescriptor.type !== MessageType.DigitDecompositionEventDescriptorV0
    )
      throw Error('Only DigitDecomposition Oracle Events supported');

    const roundingIntervals = contractDescriptor.roundingIntervals;
    const cetPayouts = PolynomialPayoutCurve.computePayouts(
      payoutFunction,
      totalCollateral,
      roundingIntervals,
    );

    const payoutGroups: PayoutGroup[] = [];
    cetPayouts.forEach((p) => {
      payoutGroups.push({
        payout: p.payout,
        groups: groupByIgnoringDigits(
          p.indexFrom,
          p.indexTo,
          eventDescriptor.base,
          contractDescriptor.numDigits,
        ),
      });
    });

    const rValuesMessagesList = this.GenerateMessages(oracleInfo);

    const { payouts, messagesList } = outputsToPayouts(
      payoutGroups,
      rValuesMessagesList,
      dlcOffer.offerCollateral,
      dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateral,
      true,
    );

    return { payouts, payoutGroups, messagesList };
  }

  private GetPayouts(_dlcOffer: DlcOffer): GetPayoutsResponse[] {
    const { dlcOffer } = checkTypes({ _dlcOffer });

    const contractInfo = dlcOffer.contractInfo;
    const totalCollateral = contractInfo.totalCollateral;
    const contractOraclePairs = this.GetContractOraclePairs(contractInfo);

    const payoutResponses = contractOraclePairs.map(
      ({ contractDescriptor, oracleInfo }) =>
        this.GetPayoutsFromContractDescriptor(
          dlcOffer,
          contractDescriptor,
          oracleInfo,
          totalCollateral,
        ),
    );

    return payoutResponses;
  }

  private FlattenPayouts(payoutResponses: GetPayoutsResponse[]) {
    return payoutResponses.reduce(
      (acc, { payouts, payoutGroups, messagesList }) => {
        return {
          payouts: acc.payouts.concat(payouts),
          payoutGroups: acc.payoutGroups.concat(payoutGroups),
          messagesList: acc.messagesList.concat(messagesList),
        };
      },
    );
  }

  private GetIndicesFromPayouts(payoutResponses: GetPayoutsResponse[]) {
    return payoutResponses.reduce(
      (prev, acc) => {
        return prev.concat({
          startingMessagesIndex:
            prev[prev.length - 1].startingMessagesIndex +
            acc.messagesList.length,
          startingPayoutGroupsIndex:
            prev[prev.length - 1].startingPayoutGroupsIndex +
            acc.payoutGroups.length,
        });
      },
      [{ startingMessagesIndex: 0, startingPayoutGroupsIndex: 0 }],
    );
  }

  private GetPayoutsFromContractDescriptor(
    dlcOffer: DlcOfferV0,
    contractDescriptor: ContractDescriptor,
    oracleInfo: OracleInfo,
    totalCollateral: bigint,
  ) {
    switch (contractDescriptor.type) {
      case ContractDescriptorType.Enumerated: {
        throw Error('Enumerated ContractDescriptor not yet supported');
      }
      case ContractDescriptorType.Numeric:
        {
          const payoutFunction = (contractDescriptor as NumericContractDescriptor)
            .payoutFunction as PayoutFunction;

          // TODO: add a better check for this
          const payoutCurvePiece = payoutFunction.pieces[0].payoutCurvePiece;

          switch (payoutCurvePiece.type) {
            case PayoutCurvePieceType.HyperbolaPayoutCurvePiece:
              return this.GetPayoutsFromPayoutFunction(
                dlcOffer,
                contractDescriptor as NumericContractDescriptor,
                oracleInfo,
                totalCollateral,
              );
            case PayoutCurvePieceType.PolynomialPayoutCurvePiece:
              return this.GetPayoutsFromPolynomialPayoutFunction(
                dlcOffer,
                contractDescriptor as NumericContractDescriptor,
                oracleInfo,
                totalCollateral,
              );
          }
        }
        break;
      default: {
        throw Error('ContractDescriptor must be Enumerated or Numeric');
      }
    }
  }

  public async createDlcTxs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
  ): Promise<CreateDlcTxsResponse> {
    const { dlcOffer, dlcAccept } = checkTypes({
      _dlcOffer,
      _dlcAccept,
    });

    const localFundPubkey = dlcOffer.fundingPubKey.toString('hex');
    const remoteFundPubkey = dlcAccept.fundingPubKey.toString('hex');
    const localFinalScriptPubkey = dlcOffer.payoutSPK.toString('hex');
    const remoteFinalScriptPubkey = dlcAccept.payoutSPK.toString('hex');
    const localChangeScriptPubkey = dlcOffer.changeSPK.toString('hex');
    const remoteChangeScriptPubkey = dlcAccept.changeSPK.toString('hex');

    const localInputs: Utxo[] = await Promise.all(
      dlcOffer.fundingInputs.map(async (fundingInput) => {
        const input = await this.fundingInputToInput(fundingInput, false);
        return input.toUtxo();
      }),
    );

    const remoteInputs: Utxo[] = await Promise.all(
      dlcAccept.fundingInputs.map(async (fundingInput) => {
        const input = await this.fundingInputToInput(fundingInput, false);
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

    const payoutResponses = this.GetPayouts(dlcOffer);
    const { payouts, messagesList } = this.FlattenPayouts(payoutResponses);

    const dlcTxRequest: CreateDlcTransactionsRequest = {
      payouts,
      localFundPubkey,
      localFinalScriptPubkey,
      remoteFundPubkey,
      remoteFinalScriptPubkey,
      localInputAmount,
      localCollateralAmount: dlcOffer.offerCollateral,
      localPayoutSerialId: dlcOffer.payoutSerialId,
      localChangeSerialId: dlcOffer.changeSerialId,
      remoteInputAmount,
      remoteCollateralAmount: dlcAccept.acceptCollateral,
      remotePayoutSerialId: dlcAccept.payoutSerialId,
      remoteChangeSerialId: dlcAccept.changeSerialId,
      refundLocktime: dlcOffer.refundLocktime,
      localInputs,
      remoteInputs,
      localChangeScriptPubkey,
      remoteChangeScriptPubkey,
      feeRate: Number(dlcOffer.feeRatePerVb),
      cetLockTime: dlcOffer.cetLocktime,
      fundOutputSerialId: dlcOffer.fundOutputSerialId,
    };

    const dlcTxs = await this.CreateDlcTransactions(dlcTxRequest);

    const dlcTransactions = new DlcTransactionsV0();
    dlcTransactions.fundTx = Tx.decode(StreamReader.fromHex(dlcTxs.fundTxHex));
    dlcTransactions.fundTxVout = [
      BigInt(dlcOffer.changeSerialId),
      BigInt(dlcAccept.changeSerialId),
      BigInt(dlcTxRequest.fundOutputSerialId),
    ]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .findIndex((i) => BigInt(i) === BigInt(dlcTxRequest.fundOutputSerialId));
    dlcTransactions.refundTx = Tx.decode(
      StreamReader.fromHex(dlcTxs.refundTxHex),
    );
    dlcTransactions.cets = dlcTxs.cetsHex.map((cetHex) => {
      return Tx.decode(StreamReader.fromHex(cetHex));
    });

    return { dlcTransactions, messagesList };
  }

  private GenerateEnumMessages(oracleEvent: OracleEventV0Pre167): Messages[] {
    throw Error('Only DigitDecomposition Oracle Events supported');
  }

  private GenerateDigitDecompositionMessages(
    oracleEvent: OracleEventV0Pre167,
  ): Messages[] {
    const oracleNonces = oracleEvent.oracleNonces;
    const eventDescriptor = oracleEvent.eventDescriptor as DigitDecompositionEventDescriptorV0Pre167;

    const messagesList: Messages[] = [];
    oracleNonces.forEach(() => {
      const messages = [];
      for (let i = 0; i < eventDescriptor.base; i++) {
        const m = i.toString();
        messages.push(m);
      }
      messagesList.push({ messages });
    });

    return messagesList;
  }

  private GenerateMessages(oracleInfo: OracleInfo): Messages[] {
    const oracleEvent = (oracleInfo as SingleOracleInfo).announcement
      .oracleEvent;

    switch (oracleEvent.eventDescriptor.type) {
      case MessageType.EnumEventDescriptorV0:
        return this.GenerateEnumMessages(oracleEvent);
      case MessageType.DigitDecompositionEventDescriptorV0:
        return this.GenerateDigitDecompositionMessages(oracleEvent);
      default:
        throw Error('EventDescriptor must be Enum or DigitDecomposition');
    }
  }

  private GetContractOraclePairs(
    _contractInfo: ContractInfo,
  ): { contractDescriptor: ContractDescriptor; oracleInfo: OracleInfo }[] {
    switch (_contractInfo.type) {
      case ContractInfoType.Single: {
        const contractInfo = _contractInfo as SingleContractInfo;
        return [
          {
            contractDescriptor: contractInfo.contractDescriptor,
            oracleInfo: contractInfo.oracleInfo,
          },
        ];
      }
      case ContractInfoType.Disjoint: {
        return (_contractInfo as DisjointContractInfo).contractOraclePairs;
      }
      default:
        throw Error('ContractInfo must be Single or Disjoint');
    }
  }

  private async CreateCetAdaptorAndRefundSigs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    messagesList: Messages[],
    isOfferer: boolean,
  ): Promise<CreateCetAdaptorAndRefundSigsResponse> {
    const { dlcOffer, dlcAccept, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcTxs,
    });
    const network = await this.getConnectedNetwork();

    const cetsHex = dlcTxs.cets.map((cet) => cet.serialize().toString('hex'));

    const fundingSPK = Script.p2wpkhLock(
      hash160(isOfferer ? dlcOffer.fundingPubKey : dlcAccept.fundingPubKey),
    )
      .serialize()
      .slice(1);

    const fundingAddress: string = address.fromOutputScript(
      fundingSPK,
      network,
    );

    const { derivationPath } = await this.client.wallet.findAddress([
      fundingAddress,
    ]);

    const fundPrivateKeyPair = await this.getMethod('keyPair')(derivationPath);
    const fundPrivateKey = Buffer.from(fundPrivateKeyPair.__D).toString('hex');

    const contractOraclePairs = this.GetContractOraclePairs(
      dlcOffer.contractInfo,
    );

    const indices = this.GetIndicesFromPayouts(this.GetPayouts(_dlcOffer));
    const sigs: ISig[][] = [];

    for (const [index, { oracleInfo }] of contractOraclePairs.entries()) {
      const oracleAnnouncement = (oracleInfo as SingleOracleInfo).announcement;

      const startingIndex = indices[index].startingMessagesIndex,
        endingIndex = indices[index + 1].startingMessagesIndex;

      const oracleEventMessagesList = messagesList.slice(
        startingIndex,
        endingIndex,
      );
      const oracleEventCetsHex = cetsHex.slice(startingIndex, endingIndex);

      const chunk = 100;
      const adaptorSigRequestPromises: Promise<AdaptorPair[]>[] = [];

      for (let i = 0, j = oracleEventMessagesList.length; i < j; i += chunk) {
        const tempMessagesList = oracleEventMessagesList.slice(i, i + chunk);
        const tempCetsHex = oracleEventCetsHex.slice(i, i + chunk);

        const cetSignRequest: CreateCetAdaptorSignaturesRequest = {
          messagesList: tempMessagesList,
          cetsHex: tempCetsHex,
          privkey: fundPrivateKey,
          fundTxId: dlcTxs.fundTx.txId.toString(),
          fundVout: dlcTxs.fundTxVout,
          localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
          remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
          fundInputAmount: dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
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

      sigs.push(
        adaptorPairs.map((adaptorPair) => {
          return {
            encryptedSig: Buffer.from(adaptorPair.signature, 'hex'),
            dleqProof: Buffer.from(adaptorPair.proof, 'hex'),
          };
        }),
      );
    }

    const refundSignRequest: GetRawRefundTxSignatureRequest = {
      refundTxHex: dlcTxs.refundTx.serialize().toString('hex'),
      privkey: fundPrivateKey,
      fundTxId: dlcTxs.fundTx.txId.toString(),
      fundVout: dlcTxs.fundTxVout,
      localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
      fundInputAmount: dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
    };

    const refundSignature = Buffer.from(
      (await this.GetRawRefundTxSignature(refundSignRequest)).hex,
      'hex',
    );

    const cetSignatures = new CetAdaptorSignatures();
    cetSignatures.sigs = sigs.flat();

    return { cetSignatures, refundSignature };
  }

  private async VerifyCetAdaptorAndRefundSigs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    messagesList: Messages[],
    isOfferer: boolean,
  ): Promise<void> {
    const { dlcOffer, dlcAccept, dlcSign, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcSign,
      _dlcTxs,
    });

    const cetsHex = dlcTxs.cets.map((cet) => cet.serialize().toString('hex'));

    const chunk = 100;

    const contractOraclePairs = this.GetContractOraclePairs(
      dlcOffer.contractInfo,
    );

    const indices = this.GetIndicesFromPayouts(this.GetPayouts(_dlcOffer));

    for (const [index, { oracleInfo }] of contractOraclePairs.entries()) {
      const oracleAnnouncement = (oracleInfo as SingleOracleInfo).announcement;

      const startingIndex = indices[index].startingMessagesIndex,
        endingIndex = indices[index + 1].startingMessagesIndex;

      const oracleEventMessagesList = messagesList.slice(
        startingIndex,
        endingIndex,
      );
      const oracleEventCetsHex = cetsHex.slice(startingIndex, endingIndex);
      const oracleEventSigs = (isOfferer
        ? dlcAccept.cetSignatures.sigs
        : dlcSign.cetSignatures.sigs
      ).slice(startingIndex, endingIndex);

      const sigsValidity: Promise<boolean>[] = [];

      for (let i = 0, j = oracleEventMessagesList.length; i < j; i += chunk) {
        const tempMessagesList = oracleEventMessagesList.slice(i, i + chunk);
        const tempCetsHex = oracleEventCetsHex.slice(i, i + chunk);
        const tempSigs = oracleEventSigs.slice(i, i + chunk);
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
          fundVout: dlcTxs.fundTxVout,
          fundInputAmount: dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
          verifyRemote: isOfferer,
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
        signature: isOfferer
          ? dlcAccept.refundSignature.toString('hex')
          : dlcSign.refundSignature.toString('hex'),
        localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
        remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
        fundTxId: dlcTxs.fundTx.txId.toString(),
        fundVout: dlcTxs.fundTxVout,
        fundInputAmount: dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
        verifyRemote: isOfferer,
      };

      areSigsValid =
        areSigsValid &&
        (await this.VerifyRefundTxSignature(verifyRefundSigRequest)).valid;

      if (!areSigsValid) {
        throw new Error('Invalid signatures received');
      }
    }
  }

  private async CreateFundingSigs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    isOfferer: boolean,
  ): Promise<FundingSignatures> {
    const { dlcOffer, dlcAccept, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcTxs,
    });

    const fundingInputs = isOfferer
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

    const witnessElements: ScriptWitness[][] = [];
    for (let i = 0; i < fundTxSigs.length; i++) {
      const sigWitness = new ScriptWitness();
      sigWitness.witness = Buffer.from(fundTxSigs[i], 'hex');
      const pubKeyWitness = new ScriptWitness();
      pubKeyWitness.witness = Buffer.from(inputPubKeys[i], 'hex');
      witnessElements.push([sigWitness, pubKeyWitness]);
    }

    const fundingSignatures = new FundingSignatures();
    fundingSignatures.witnessElements = witnessElements;

    return fundingSignatures;
  }

  private async VerifyFundingSigs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    isOfferer: boolean,
  ): Promise<void> {
    const { dlcOffer, dlcAccept, dlcSign, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcSign,
      _dlcTxs,
    });

    const sigsValidity: Promise<boolean>[] = [];
    for (let i = 0; i < dlcSign.fundingSignatures.witnessElements.length; i++) {
      const witnessElement = dlcSign.fundingSignatures.witnessElements[i];
      const signature = witnessElement[0].witness.toString('hex');
      const pubkey = witnessElement[1].witness.toString('hex');

      const fundingInput = isOfferer
        ? (dlcAccept.fundingInputs[i] as FundingInput)
        : (dlcOffer.fundingInputs[i] as FundingInput);

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
    fundingSignatures: FundingSignatures,
  ): Promise<Tx> {
    const { dlcOffer, dlcAccept, dlcSign, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcSign,
      _dlcTxs,
    });

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
      async (witnessElement: ScriptWitness, i: number) => {
        const signature = witnessElement[0].witness.toString('hex');
        const pubkey = witnessElement[1].witness.toString('hex');

        const fundingInput = fundingInputs[i] as FundingInput;

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

    const fundTx = Tx.decode(StreamReader.fromHex(fundTxHex));

    return fundTx;
  }

  async FindOutcomeIndexFromPolynomialPayoutCurvePiece(
    _dlcOffer: DlcOffer,
    contractDescriptor: NumericContractDescriptor,
    contractOraclePairIndex: number,
    polynomialPayoutCurvePiece: PolynomialPayoutCurvePiece,
    oracleAttestation: OracleAttestationV0Pre167,
    outcome: bigint,
  ): Promise<FindOutcomeResponse> {
    const { dlcOffer } = checkTypes({ _dlcOffer });

    const polynomialCurve = PolynomialPayoutCurve.fromPayoutCurvePiece(
      polynomialPayoutCurvePiece,
    );

    const payouts = polynomialPayoutCurvePiece.points.map((point) =>
      Number(point.outcomePayout),
    );
    const minPayout = Math.min(...payouts);
    const maxPayout = Math.max(...payouts);

    const clampBN = (val: BigNumber) =>
      BigNumber.max(minPayout, BigNumber.min(val, maxPayout));

    const payout = clampBN(polynomialCurve.getPayout(outcome));

    const payoutResponses = this.GetPayouts(dlcOffer);
    const payoutIndexOffset = this.GetIndicesFromPayouts(payoutResponses)[
      contractOraclePairIndex
    ].startingMessagesIndex;

    const { payoutGroups } = payoutResponses[contractOraclePairIndex];

    const intervalsSorted = [
      ...contractDescriptor.roundingIntervals.intervals,
    ].sort((a, b) => Number(b.beginInterval) - Number(a.beginInterval));

    const interval = intervalsSorted.find(
      (interval) => Number(outcome) >= Number(interval.beginInterval),
    );

    const roundedPayout = BigInt(
      clampBN(
        new BigNumber(roundPayout(payout, interval.roundingMod).toString()),
      ).toString(),
    );

    const outcomesFormatted = oracleAttestation.outcomes.map((outcome) =>
      parseInt(outcome),
    );

    let index = 0;
    let groupIndex = -1;
    let groupLength = 0;

    for (const payoutGroup of payoutGroups) {
      if (payoutGroup.payout === roundedPayout) {
        groupIndex = payoutGroup.groups.findIndex((group) => {
          return group.every((msg, i) => msg === outcomesFormatted[i]);
        });
        if (groupIndex === -1)
          throw Error(
            'Failed to Find OutcomeIndex From PolynomialPayoutCurvePiece. \
Payout Group found but incorrect group index',
          );
        index += groupIndex;
        groupLength = payoutGroup.groups[groupIndex].length;
        break;
      } else {
        index += payoutGroup.groups.length;
      }
    }

    if (groupIndex === -1)
      throw Error(
        'Failed to Find OutcomeIndex From PolynomialPayoutCurvePiece. \
Payout Group not found',
      );

    return { index: payoutIndexOffset + index, groupLength };
  }

  async FindOutcomeIndexFromHyperbolaPayoutCurvePiece(
    _dlcOffer: DlcOffer,
    contractDescriptor: NumericContractDescriptor,
    contractOraclePairIndex: number,
    hyperbolaPayoutCurvePiece: HyperbolaPayoutCurvePiece,
    oracleAttestation: OracleAttestationV0Pre167,
    outcome: bigint,
  ): Promise<FindOutcomeResponse> {
    const { dlcOffer } = checkTypes({ _dlcOffer });

    const hyperbolaCurve = HyperbolaPayoutCurve.fromPayoutCurvePiece(
      hyperbolaPayoutCurvePiece,
    );

    const clampBN = (val: BigNumber) =>
      BigNumber.max(
        0,
        BigNumber.min(val, dlcOffer.contractInfo.totalCollateral.toString()),
      );

    const payout = clampBN(hyperbolaCurve.getPayout(outcome));

    const payoutResponses = this.GetPayouts(dlcOffer);
    const payoutIndexOffset = this.GetIndicesFromPayouts(payoutResponses)[
      contractOraclePairIndex
    ].startingMessagesIndex;

    const { payoutGroups } = payoutResponses[contractOraclePairIndex];

    const intervalsSorted = [
      ...contractDescriptor.roundingIntervals.intervals,
    ].sort((a, b) => Number(b.beginInterval) - Number(a.beginInterval));

    const interval = intervalsSorted.find(
      (interval) => Number(outcome) >= Number(interval.beginInterval),
    );

    const roundedPayout = BigInt(
      clampBN(
        new BigNumber(roundPayout(payout, interval.roundingMod).toString()),
      ).toString(),
    );

    const outcomesFormatted = oracleAttestation.outcomes.map((outcome) =>
      parseInt(outcome),
    );

    let index = 0;
    let groupIndex = -1;
    let groupLength = 0;

    for (const payoutGroup of payoutGroups) {
      if (payoutGroup.payout === roundedPayout) {
        groupIndex = payoutGroup.groups.findIndex((group) => {
          return group.every((msg, i) => msg === outcomesFormatted[i]);
        });
        if (groupIndex === -1)
          throw Error(
            'Failed to Find OutcomeIndex From HyperbolaPayoutCurvePiece. \
Payout Group found but incorrect group index',
          );
        index += groupIndex;
        groupLength = payoutGroup.groups[groupIndex].length;
        break;
      } else {
        index += payoutGroup.groups.length;
      }
    }

    if (groupIndex === -1)
      throw Error(
        'Failed to Find OutcomeIndex From HyperbolaPayoutCurvePiece. \
Payout Group not found',
      );

    return { index: payoutIndexOffset + index, groupLength };
  }

  async FindOutcomeIndex(
    _dlcOffer: DlcOffer,
    oracleAttestation: OracleAttestationV0Pre167,
  ): Promise<FindOutcomeResponse> {
    const { dlcOffer } = checkTypes({ _dlcOffer });

    const contractOraclePairs = this.GetContractOraclePairs(
      dlcOffer.contractInfo,
    );

    const contractOraclePairIndex = contractOraclePairs.findIndex(
      ({ oracleInfo }) =>
        (oracleInfo as SingleOracleInfo).announcement.oracleEvent.eventId ===
        oracleAttestation.eventId,
    );

    assert(
      contractOraclePairIndex !== -1,
      'OracleAttestation must be for an existing OracleEvent',
    );

    const contractOraclePair = contractOraclePairs[contractOraclePairIndex];

    const {
      contractDescriptor: _contractDescriptor,
      oracleInfo,
    } = contractOraclePair;

    assert(
      _contractDescriptor.type === ContractDescriptorType.Numeric,
      'ContractDescriptor must be Numeric',
    );

    const contractDescriptor = _contractDescriptor as NumericContractDescriptor;
    const _payoutFunction = contractDescriptor.payoutFunction;

    assert(
      _payoutFunction.type === MessageType.PayoutFunctionV0,
      'PayoutFunction must be V0',
    );

    const eventDescriptor = (oracleInfo as SingleOracleInfo).announcement
      .oracleEvent.eventDescriptor as DigitDecompositionEventDescriptorV0Pre167;
    const payoutFunction = _payoutFunction as PayoutFunction;

    const base = eventDescriptor.base;

    const outcome: number = [...oracleAttestation.outcomes]
      .reverse()
      .reduce((acc, val, i) => acc + Number(val) * base ** i, 0);

    // Deep copy payoutFunction.pieces into piecesSorted to prevent sorting the
    // original payoutFunction.pieces array with .sort()
    const piecesSorted = Object.assign([], payoutFunction.pieces);
    // Sort pieces by descending piece.endPoint.eventOutcome
    piecesSorted.sort(
      (a, b) =>
        Number(b.endPoint.eventOutcome) - Number(a.endPoint.eventOutcome),
    );
    // Iterate through piecesSorted to find the first piece where
    // outcome > piece.endPoint.eventOutcome
    const piece = piecesSorted.find(
      (piece) => outcome >= piece.endPoint.eventOutcome,
    );

    switch (piece.payoutCurvePiece.type) {
      case PayoutCurvePieceType.PolynomialPayoutCurvePiece:
        return this.FindOutcomeIndexFromPolynomialPayoutCurvePiece(
          dlcOffer,
          contractDescriptor,
          contractOraclePairIndex,
          piece.payoutCurvePiece as PolynomialPayoutCurvePiece,
          oracleAttestation,
          BigInt(outcome),
        );
      case PayoutCurvePieceType.HyperbolaPayoutCurvePiece:
        return this.FindOutcomeIndexFromHyperbolaPayoutCurvePiece(
          dlcOffer,
          contractDescriptor,
          contractOraclePairIndex,
          piece.payoutCurvePiece as HyperbolaPayoutCurvePiece,
          oracleAttestation,
          BigInt(outcome),
        );
      default:
        throw Error('Must be Hyperbola or Polynomial curve piece');
    }
  }

  ValidateEvent(
    _dlcOffer: DlcOffer,
    oracleAttestation: OracleAttestationV0Pre167,
  ): void {
    const { dlcOffer } = checkTypes({
      _dlcOffer,
    });

    switch (dlcOffer.contractInfo.type) {
      case ContractInfoType.Single: {
        const contractInfo = dlcOffer.contractInfo as SingleContractInfo;
        switch (contractInfo.contractDescriptor.type) {
          case ContractDescriptorType.Enumerated:
            throw Error('Enumerated ContractDescriptor not yet supported');
          case ContractDescriptorType.Numeric: {
            const oracleInfo = contractInfo.oracleInfo;
            if (
              (oracleInfo as SingleOracleInfo).announcement.oracleEvent
                .eventId !== oracleAttestation.eventId
            )
              throw Error('Incorrect Oracle Attestation. Event Id must match.');
            break;
          }
          default:
            throw Error('ContractDescriptor must be Enumerated or Numeric');
        }
        break;
      }
      case ContractInfoType.Disjoint: {
        const contractInfo = dlcOffer.contractInfo as DisjointContractInfo;
        const attestedOracleEvent = contractInfo.contractOraclePairs.find(
          ({ oracleInfo }) =>
            (oracleInfo as SingleOracleInfo).announcement.oracleEvent
              .eventId === oracleAttestation.eventId,
        );

        if (!attestedOracleEvent)
          throw Error('Oracle event of attestation not found.');

        break;
      }
      default:
        throw Error('ContractInfo must be Single or Disjoint');
    }
  }

  async FindAndSignCet(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    oracleAttestation: OracleAttestationV0Pre167,
    isOfferer?: boolean,
  ): Promise<Tx> {
    const { dlcOffer, dlcAccept, dlcSign, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcSign,
      _dlcTxs,
    });

    if (isOfferer === undefined)
      isOfferer = await this.isOfferer(dlcOffer, dlcAccept);

    const { index: outcomeIndex, groupLength } = await this.FindOutcomeIndex(
      dlcOffer,
      oracleAttestation,
    );

    const fundPrivateKey = await this.GetFundPrivateKey(
      dlcOffer,
      dlcAccept,
      isOfferer,
    );

    const sliceIndex = -(oracleAttestation.signatures.length - groupLength);

    const oracleSignatures =
      sliceIndex === 0
        ? oracleAttestation.signatures
        : oracleAttestation.signatures.slice(0, sliceIndex);

    const signCetRequest: SignCetRequest = {
      cetHex: dlcTxs.cets[outcomeIndex].serialize().toString('hex'),
      fundPrivkey: fundPrivateKey,
      fundTxId: dlcTxs.fundTx.txId.toString(),
      fundVout: dlcTxs.fundTxVout,
      localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
      oracleSignatures: oracleSignatures.map((sig) => sig.toString('hex')),
      fundInputAmount: dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
      adaptorSignature: isOfferer
        ? dlcAccept.cetSignatures.sigs[outcomeIndex].encryptedSig.toString(
            'hex',
          )
        : dlcSign.cetSignatures.sigs[outcomeIndex].encryptedSig.toString('hex'),
    };

    const finalCet = (await this.SignCet(signCetRequest)).hex;

    return Tx.decode(StreamReader.fromHex(finalCet));
  }

  private async GetFundAddress(
    dlcOffer: DlcOfferV0,
    dlcAccept: DlcAcceptV0,
    isOfferer: boolean,
  ): Promise<string> {
    const network = await this.getConnectedNetwork();

    const fundingSPK = Script.p2wpkhLock(
      hash160(isOfferer ? dlcOffer.fundingPubKey : dlcAccept.fundingPubKey),
    )
      .serialize()
      .slice(1);

    const fundingAddress: string = address.fromOutputScript(
      fundingSPK,
      network,
    );

    return fundingAddress;
  }

  private async GetFundKeyPair(
    dlcOffer: DlcOfferV0,
    dlcAccept: DlcAcceptV0,
    isOfferer: boolean,
  ): Promise<ECPairInterface> {
    const fundingAddress = await this.GetFundAddress(
      dlcOffer,
      dlcAccept,
      isOfferer,
    );

    const { derivationPath } = await this.getMethod('getWalletAddress')(
      fundingAddress,
    );
    const keyPair: ECPairInterface = await this.getMethod('keyPair')(
      derivationPath,
    );

    return keyPair;
  }

  private async GetFundPrivateKey(
    dlcOffer: DlcOfferV0,
    dlcAccept: DlcAcceptV0,
    isOfferer: boolean,
  ): Promise<string> {
    const fundPrivateKeyPair: ECPairInterface = await this.GetFundKeyPair(
      dlcOffer,
      dlcAccept,
      isOfferer,
    );

    return Buffer.from(fundPrivateKeyPair.privateKey).toString('hex');
  }

  async CreateCloseRawTxs(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    closeInputAmount: bigint,
    isOfferer: boolean,
    _dlcCloses: DlcClose[] = [],
    fundingInputs?: FundingInput[],
    initiatorPayouts?: bigint[],
  ): Promise<string[]> {
    const { dlcOffer, dlcAccept, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcTxs,
    });
    const network = await this.getConnectedNetwork();

    let finalizer: DualClosingTxFinalizer;
    if (_dlcCloses.length === 0) {
      finalizer = new DualClosingTxFinalizer(
        fundingInputs,
        dlcOffer.payoutSPK,
        dlcAccept.payoutSPK,
        dlcOffer.feeRatePerVb,
      );
    }

    const rawTransactionRequestPromises: Promise<string>[] = [];
    const rawCloseTxs = [];

    const numPayouts =
      _dlcCloses.length === 0 ? initiatorPayouts.length : _dlcCloses.length;

    for (let i = 0; i < numPayouts; i++) {
      let offerPayoutValue = BigInt(0);
      let acceptPayoutValue = BigInt(0);

      if (_dlcCloses.length === 0) {
        const payout = initiatorPayouts[i];
        const payoutMinusOfferFees =
          finalizer.offerInitiatorFees > payout
            ? BigInt(0)
            : payout - finalizer.offerInitiatorFees;
        const collateralMinusPayout =
          payout > dlcOffer.contractInfo.totalCollateral
            ? BigInt(0)
            : dlcOffer.contractInfo.totalCollateral - payout;

        offerPayoutValue = isOfferer
          ? closeInputAmount + payoutMinusOfferFees
          : collateralMinusPayout;

        acceptPayoutValue = isOfferer
          ? collateralMinusPayout
          : closeInputAmount + payoutMinusOfferFees;
      } else {
        const dlcClose = checkTypes({ _dlcClose: _dlcCloses[i] }).dlcClose;

        offerPayoutValue = dlcClose.offerPayoutSatoshis;
        acceptPayoutValue = dlcClose.acceptPayoutSatoshis;
      }

      const txOuts = [];

      if (Number(offerPayoutValue) > 0) {
        txOuts.push({
          address: address.fromOutputScript(dlcOffer.payoutSPK, network),
          amount: Number(offerPayoutValue),
        });
      }

      if (Number(acceptPayoutValue) > 0) {
        txOuts.push({
          address: address.fromOutputScript(dlcAccept.payoutSPK, network),
          amount: Number(acceptPayoutValue),
        });
      }

      if (dlcOffer.payoutSerialId > dlcAccept.payoutSerialId) txOuts.reverse();

      const rawTransactionRequest: CreateRawTransactionRequest = {
        version: 2,
        locktime: 0,
        txins: [
          {
            txid: dlcTxs.fundTx.txId.serialize().reverse().toString('hex'),
            vout: dlcTxs.fundTxVout,
            sequence: 0,
          },
        ],
        txouts: txOuts,
      };

      rawTransactionRequestPromises.push(
        (async () => {
          const response = await this.getMethod('CreateRawTransaction')(
            rawTransactionRequest,
          );
          return response.hex;
        })(),
      );
    }

    const hexs: string[] = await Promise.all(rawTransactionRequestPromises);

    rawCloseTxs.push(hexs);

    return rawCloseTxs.flat();
  }

  async CreateSignatureHashes(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    rawCloseTxs: string[],
  ): Promise<string[]> {
    const { dlcOffer, dlcAccept, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcTxs,
    });

    const network = await this.getConnectedNetwork();

    const fundingPubKeys =
      Buffer.compare(dlcOffer.fundingPubKey, dlcAccept.fundingPubKey) === -1
        ? [dlcOffer.fundingPubKey, dlcAccept.fundingPubKey]
        : [dlcAccept.fundingPubKey, dlcOffer.fundingPubKey];

    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: fundingPubKeys,
      network,
    });

    const paymentVariant = payments.p2wsh({
      redeem: p2ms,
      network,
    });

    const sigHashRequestPromises: Promise<string>[] = [];
    const sigHashes = [];

    for (let i = 0; i < rawCloseTxs.length; i++) {
      const rawTx = rawCloseTxs[i];

      const sigHashRequest: CreateSignatureHashRequest = {
        tx: rawTx,
        txin: {
          txid: dlcTxs.fundTx.txId.serialize().reverse().toString('hex'),
          vout: dlcTxs.fundTxVout,
          keyData: {
            hex: paymentVariant.redeem.output.toString('hex'),
            type: 'redeem_script',
          },
          amount: Number(dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats),
          hashType: 'p2wsh',
          sighashType: 'all',
          sighashAnyoneCanPay: false,
        },
      };

      sigHashRequestPromises.push(
        (async () => {
          const response = await this.getMethod('CreateSignatureHash')(
            sigHashRequest,
          );
          return response.sighash;
        })(),
      );
    }

    const sighashes: string[] = await Promise.all(sigHashRequestPromises);

    sigHashes.push(sighashes);

    return sigHashes.flat();
  }

  async CalculateEcSignatureHashes(
    sigHashes: string[],
    privKey: string,
  ): Promise<string[]> {
    const cfdNetwork = await this.GetCfdNetwork();

    const sigsRequestPromises: Promise<string>[] = [];

    for (let i = 0; i < sigHashes.length; i++) {
      const sigHash = sigHashes[i];

      const calculateEcSignatureRequest: CalculateEcSignatureRequest = {
        sighash: sigHash,
        privkeyData: {
          privkey: privKey,
          wif: false,
          network: cfdNetwork,
        },
        isGrindR: true,
      };

      sigsRequestPromises.push(
        (async () => {
          const response = await this.getMethod('CalculateEcSignature')(
            calculateEcSignatureRequest,
          );
          return response.signature;
        })(),
      );
    }

    const sigs: string[] = await Promise.all(sigsRequestPromises);

    return sigs.flat();
  }

  async VerifySignatures(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    _dlcCloses: DlcClose[],
    rawCloseTxs: string[],
    isOfferer: boolean,
  ): Promise<boolean> {
    const { dlcOffer, dlcAccept, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcTxs,
    });

    const dlcCloses = _dlcCloses.map(
      (_dlcClose) => checkTypes({ _dlcClose }).dlcClose,
    );

    const network = await this.getConnectedNetwork();

    const fundingPubKeys =
      Buffer.compare(dlcOffer.fundingPubKey, dlcAccept.fundingPubKey) === -1
        ? [dlcOffer.fundingPubKey, dlcAccept.fundingPubKey]
        : [dlcAccept.fundingPubKey, dlcOffer.fundingPubKey];

    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: fundingPubKeys,
      network,
    });

    const paymentVariant = payments.p2wsh({
      redeem: p2ms,
      network,
    });

    const pubkey = isOfferer ? dlcAccept.fundingPubKey : dlcOffer.fundingPubKey;

    const sigsValidity: Promise<boolean>[] = [];

    for (let i = 0; i < rawCloseTxs.length; i++) {
      const rawTx = rawCloseTxs[i];
      const dlcClose = dlcCloses[i];

      const verifySignatureRequest: VerifySignatureRequest = {
        tx: rawTx,
        txin: {
          txid: dlcTxs.fundTx.txId.serialize().reverse().toString('hex'),
          vout: dlcTxs.fundTxVout,
          signature: dlcClose.closeSignature.toString('hex'),
          pubkey: pubkey.toString('hex'),
          redeemScript: paymentVariant.redeem.output.toString('hex'),
          hashType: 'p2wsh',
          sighashType: 'all',
          sighashAnyoneCanPay: false,
          amount: Number(dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats),
        },
      };

      sigsValidity.push(
        (async () => {
          const response = await this.getMethod('VerifySignature')(
            verifySignatureRequest,
          );
          return response.success;
        })(),
      );
    }

    const areSigsValid = (await Promise.all(sigsValidity)).every((b) => b);
    return areSigsValid;
  }

  /**
   * Check whether wallet is offerer of DlcOffer or DlcAccept
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @returns {Promise<boolean>}
   */
  async isOfferer(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
  ): Promise<boolean> {
    const { dlcOffer, dlcAccept } = checkTypes({
      _dlcOffer,
      _dlcAccept,
    });
    const network = await this.getConnectedNetwork();

    const offerFundingSPK = Script.p2wpkhLock(hash160(dlcOffer.fundingPubKey))
      .serialize()
      .slice(1);
    const acceptFundingSPK = Script.p2wpkhLock(hash160(dlcAccept.fundingPubKey))
      .serialize()
      .slice(1);

    const offerFundingAddress: string = address.fromOutputScript(
      offerFundingSPK,
      network,
    );

    const acceptFundingAddress: string = address.fromOutputScript(
      acceptFundingSPK,
      network,
    );

    let walletAddress: Address = await this.client.wallet.findAddress([
      offerFundingAddress,
    ]);
    if (walletAddress) return true;
    walletAddress = await this.client.wallet.findAddress([
      acceptFundingAddress,
    ]);
    if (walletAddress) return false;

    throw Error('Wallet Address not found for DlcOffer or DlcAccept');
  }

  /**
   * Create DLC Offer Message
   * @param contractInfo ContractInfo TLV (V0 or V1)
   * @param offerCollateral Amount (in satoshi) DLC Initiator is putting into the contract
   * @param feeRatePerVb Fee rate in satoshi per virtual byte that both sides use to compute fees in funding tx
   * @param cetLocktime The nLockTime to be put on CETs
   * @param refundLocktime The nLockTime to be put on the refund transaction
   * @returns {Promise<DlcOffer>}
   */
  async createDlcOffer(
    contractInfo: ContractInfo,
    offerCollateral: bigint,
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktime: number,
    fixedInputs?: Input[],
  ): Promise<DlcOffer> {
    contractInfo.validate();
    const network = await this.getConnectedNetwork();

    const tempDlcOffer = new DlcOfferV0();

    const {
      fundingPubKey,
      payoutSPK,
      payoutSerialId,
      fundingInputs: _fundingInputs,
      changeSPK,
      changeSerialId,
    } = await this.Initialize(offerCollateral, feeRatePerVb, fixedInputs);

    const fundingInputs: FundingInput[] = _fundingInputs.map(
      (input) => input as FundingInput,
    );

    fundingInputs.sort(
      (a, b) => Number(a.inputSerialId) - Number(b.inputSerialId),
    );

    const fundOutputSerialId = generateSerialId();

    assert(
      changeSerialId !== fundOutputSerialId,
      'changeSerialId cannot equal the fundOutputSerialId',
    );

    tempDlcOffer.contractFlags = 0;
    tempDlcOffer.chainHash = chainHashFromNetwork(network);
    tempDlcOffer.contractInfo = contractInfo;
    tempDlcOffer.fundingPubKey = fundingPubKey;
    tempDlcOffer.payoutSPK = payoutSPK;
    tempDlcOffer.payoutSerialId = payoutSerialId;
    tempDlcOffer.offerCollateral = offerCollateral;
    tempDlcOffer.fundingInputs = fundingInputs;
    tempDlcOffer.changeSPK = changeSPK;
    tempDlcOffer.changeSerialId = changeSerialId;
    tempDlcOffer.fundOutputSerialId = fundOutputSerialId;
    tempDlcOffer.feeRatePerVb = feeRatePerVb;
    tempDlcOffer.cetLocktime = cetLocktime;
    tempDlcOffer.refundLocktime = refundLocktime;

    assert(
      (() => {
        const finalizer = new DualFundingTxFinalizer(
          tempDlcOffer.fundingInputs,
          tempDlcOffer.payoutSPK,
          tempDlcOffer.changeSPK,
          null,
          null,
          null,
          tempDlcOffer.feeRatePerVb,
        );
        const funding = fundingInputs.reduce((total, input) => {
          return total + input.prevTx.outputs[input.prevTxVout].value.sats;
        }, BigInt(0));

        return funding >= offerCollateral + finalizer.offerFees;
      })(),
      'fundingInputs for dlcOffer must be greater than offerCollateral plus offerFees',
    );

    tempDlcOffer.validate();

    // Assign unique temporaryContractId to finalize DLC offer
    const dlcOffer = tempDlcOffer;
    dlcOffer.temporaryContractId = sha256(tempDlcOffer.serialize());

    return dlcOffer;
  }

  /**
   * Accept DLC Offer
   * @param _dlcOffer Dlc Offer Message
   * @param fixedInputs Optional inputs to use for Funding Inputs
   * @returns {Promise<AcceptDlcOfferResponse}
   */
  async acceptDlcOffer(
    _dlcOffer: DlcOffer,
    fixedInputs?: Input[],
  ): Promise<AcceptDlcOfferResponse> {
    const { dlcOffer } = checkTypes({ _dlcOffer });
    dlcOffer.validate();

    const acceptCollateral =
      dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateral;

    assert(
      acceptCollateral ===
        dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateral,
      'acceptCollateral should equal totalCollateral - offerCollateral',
    );

    const {
      fundingPubKey,
      payoutSPK,
      payoutSerialId,
      fundingInputs: _fundingInputs,
      changeSPK,
      changeSerialId,
    } = await this.Initialize(
      acceptCollateral,
      dlcOffer.feeRatePerVb,
      fixedInputs,
    );

    assert(
      Buffer.compare(dlcOffer.fundingPubKey, fundingPubKey) !== 0,
      'DlcOffer and DlcAccept FundingPubKey cannot be the same',
    );

    const fundingInputs: FundingInput[] = _fundingInputs.map(
      (input) => input as FundingInput,
    );

    fundingInputs.sort(
      (a, b) => Number(a.inputSerialId) - Number(b.inputSerialId),
    );

    const dlcAccept = new DlcAcceptV0();

    dlcAccept.temporaryContractId = dlcOffer.temporaryContractId;
    dlcAccept.acceptCollateral = acceptCollateral;
    dlcAccept.fundingPubKey = fundingPubKey;
    dlcAccept.payoutSPK = payoutSPK;
    dlcAccept.payoutSerialId = dlcAccept.payoutSerialId = payoutSerialId;
    dlcAccept.fundingInputs = fundingInputs;
    dlcAccept.changeSPK = changeSPK;
    dlcAccept.changeSerialId = dlcAccept.changeSerialId = changeSerialId;

    assert(
      dlcAccept.changeSerialId !== dlcOffer.fundOutputSerialId,
      'changeSerialId cannot equal the fundOutputSerialId',
    );

    assert(
      dlcOffer.payoutSerialId !== dlcAccept.payoutSerialId,
      'offer.payoutSerialId cannot equal accept.payoutSerialId',
    );

    assert(
      (() => {
        const ids = [
          dlcOffer.changeSerialId,
          dlcAccept.changeSerialId,
          dlcOffer.fundOutputSerialId,
        ];
        return new Set(ids).size === ids.length;
      })(),
      'offer.changeSerialID, accept.changeSerialId and fundOutputSerialId must be unique',
    );

    dlcAccept.validate();

    assert(
      (() => {
        const finalizer = new DualFundingTxFinalizer(
          dlcOffer.fundingInputs,
          dlcOffer.payoutSPK,
          dlcOffer.changeSPK,
          dlcAccept.fundingInputs,
          dlcAccept.payoutSPK,
          dlcAccept.changeSPK,
          dlcOffer.feeRatePerVb,
        );
        const funding = fundingInputs.reduce((total, input) => {
          return total + input.prevTx.outputs[input.prevTxVout].value.sats;
        }, BigInt(0));

        return funding >= acceptCollateral + finalizer.acceptFees;
      })(),
      'fundingInputs for dlcAccept must be greater than acceptCollateral plus acceptFees',
    );

    const { dlcTransactions, messagesList } = await this.createDlcTxs(
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

    assert(
      dlcTransactions.type === MessageType.DlcTransactionsV0,
      'DlcTransactions must be V0',
    );
    const _dlcTransactions = dlcTransactions as DlcTransactionsV0;

    const contractId = xor(
      _dlcTransactions.fundTx.txId.serialize(),
      dlcAccept.temporaryContractId,
    );
    _dlcTransactions.contractId = contractId;

    dlcAccept.cetSignatures = cetSignatures;
    dlcAccept.refundSignature = refundSignature;

    // The following line is commented out because specifying empty
    // negotiationFields causes dlcAccept serialization to fail
    // dlcAccept.negotiationFields = new SingleNegotiationFields();

    return { dlcAccept, dlcTransactions: _dlcTransactions };
  }

  /**
   * Sign Dlc Accept Message
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @returns {Promise<SignDlcAcceptResponse}
   */
  async signDlcAccept(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
  ): Promise<SignDlcAcceptResponse> {
    const { dlcOffer, dlcAccept } = checkTypes({
      _dlcOffer,
      _dlcAccept,
    });
    dlcOffer.validate();
    dlcAccept.validate();

    assert(
      Buffer.compare(dlcOffer.fundingPubKey, dlcAccept.fundingPubKey) !== 0,
      'DlcOffer and DlcAccept FundingPubKey cannot be the same',
    );

    const dlcSign = new DlcSignV0();

    const { dlcTransactions, messagesList } = await this.createDlcTxs(
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
      dlcAccept.temporaryContractId,
    );

    assert(
      Buffer.compare(
        contractId,
        xor(dlcTxs.fundTx.txId.serialize(), dlcAccept.temporaryContractId),
      ) === 0,
      'contractId must be the xor of funding txid, fundingOutputIndex and the temporaryContractId',
    );

    dlcTxs.contractId = contractId;

    dlcSign.contractId = contractId;
    dlcSign.cetSignatures = cetSignatures;
    dlcSign.refundSignature = refundSignature;
    dlcSign.fundingSignatures = fundingSignatures;

    return { dlcSign, dlcTransactions: dlcTxs };
  }

  /**
   * Finalize Dlc Sign
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @param _dlcSign Dlc Sign Message
   * @param _dlcTxs Dlc Transactions Message
   * @returns {Promise<Tx>}
   */
  async finalizeDlcSign(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
  ): Promise<Tx> {
    const { dlcOffer, dlcAccept, dlcSign, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcSign,
      _dlcTxs,
    });

    const payoutResponses = this.GetPayouts(dlcOffer);
    const { messagesList } = this.FlattenPayouts(payoutResponses);

    await this.VerifyCetAdaptorAndRefundSigs(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
      messagesList,
      false,
    );

    await this.VerifyFundingSigs(dlcOffer, dlcAccept, dlcSign, dlcTxs, false);

    const fundingSignatures = await this.CreateFundingSigs(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      false,
    );

    const fundTx = await this.CreateFundingTx(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
      fundingSignatures,
    );

    return fundTx;
  }

  /**
   * Execute DLC
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @param _dlcSign Dlc Sign Message
   * @param _dlcTxs Dlc Transactions Message
   * @param oracleAttestation Oracle Attestations TLV (V0)
   * @param isOfferer Whether party is Dlc Offerer
   * @returns {Promise<Tx>}
   */
  async execute(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    oracleAttestation: OracleAttestationV0Pre167,
    isOfferer?: boolean,
  ): Promise<Tx> {
    const { dlcOffer, dlcAccept, dlcSign, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcSign,
      _dlcTxs,
    });

    if (isOfferer === undefined)
      isOfferer = await this.isOfferer(dlcOffer, dlcAccept);

    this.ValidateEvent(dlcOffer, oracleAttestation);

    return this.FindAndSignCet(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
      oracleAttestation,
      isOfferer,
    );
  }

  /**
   * Refund DLC
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @param _dlcSign Dlc Sign Message
   * @param _dlcTxs Dlc Transactions message
   * @returns {Promise<Tx>}
   */
  async refund(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
  ): Promise<Tx> {
    const { dlcOffer, dlcAccept, dlcSign, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcSign,
      _dlcTxs,
    });

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
      refundTxHex: dlcTxs.refundTx.serialize().toString('hex'),
      signatures,
      fundTxId: dlcTxs.fundTx.txId.toString(),
      fundVout: dlcTxs.fundTxVout,
      localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
    };

    const refundHex = (
      await this.AddSignaturesToRefundTx(addSigsToRefundTxRequest)
    ).hex;

    return Tx.decode(StreamReader.fromHex(refundHex));
  }

  /**
   * Goal of createDlcClose is for alice (the initiator) to
   * 1. take dlcoffer, accept, and sign messages. Create a dlcClose message.
   * 2. Build a close tx, sign.
   * 3. return dlcClose message (no psbt)
   */

  /**
   * Generate DlcClose messagetype for closing DLC with Mutual Consent
   * @param _dlcOffer DlcOffer TLV (V0)
   * @param _dlcAccept DlcAccept TLV (V0)
   * @param _dlcTxs DlcTransactions TLV (V0)
   * @param initiatorPayoutSatoshis Amount initiator expects as a payout
   * @param isOfferer Whether offerer or not
   * @param _inputs Optionally specified closing inputs
   * @returns {Promise<DlcClose>}
   */
  async createDlcClose(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    initiatorPayoutSatoshis: bigint,
    isOfferer?: boolean,
    _inputs?: Input[],
  ): Promise<DlcClose> {
    const { dlcOffer, dlcAccept, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcTxs,
    });

    if (isOfferer === undefined)
      isOfferer = await this.isOfferer(dlcOffer, dlcAccept);

    const network = await this.getConnectedNetwork();
    const psbt = new Psbt({ network });

    const fundingPubKeys =
      Buffer.compare(dlcOffer.fundingPubKey, dlcAccept.fundingPubKey) === -1
        ? [dlcOffer.fundingPubKey, dlcAccept.fundingPubKey]
        : [dlcAccept.fundingPubKey, dlcOffer.fundingPubKey];

    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: fundingPubKeys,
      network,
    });

    const paymentVariant = payments.p2wsh({
      redeem: p2ms,
      network,
    });

    // Initiate and build PSBT
    let inputs: Input[] = _inputs;
    if (!_inputs) {
      const tempInputs = await this.GetInputsForAmount(
        BigInt(20000),
        dlcOffer.feeRatePerVb,
        _inputs,
      );
      _inputs = tempInputs;
    }
    inputs = _inputs.map((input) => {
      return {
        ...input,
        inputSerialId: input.inputSerialId || generateSerialId(),
        toUtxo: input.toUtxo,
      };
    });

    const pubkeys: Buffer[] = await Promise.all(
      inputs.map(async (input) => {
        const address: Address = await this.getMethod('getWalletAddress')(
          input.address,
        );
        return Buffer.from(address.publicKey, 'hex');
      }),
    );

    const fundingInputSerialId = generateSerialId();

    // Make temporary array to hold all inputs and then sort them
    // this method can be improved later
    const psbtInputs = [];
    psbtInputs.push({
      hash: dlcTxs.fundTx.txId.serialize(),
      index: dlcTxs.fundTxVout,
      sequence: 0,
      witnessUtxo: {
        script: paymentVariant.output,
        value: Number(dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats),
      },
      witnessScript: paymentVariant.redeem.output,
      inputSerialId: fundingInputSerialId,
      derivationPath: null,
    });

    // add all dlc close inputs
    inputs.forEach((input, i) => {
      const paymentVariant = payments.p2wpkh({ pubkey: pubkeys[i], network });

      psbtInputs.push({
        hash: input.txid,
        index: input.vout,
        sequence: 0,
        witnessUtxo: {
          script: paymentVariant.output,
          value: input.value,
        },
        inputSerialId: input.inputSerialId,
        derivationPath: input.derivationPath,
      });
    });

    // sort all inputs in ascending order by serial ID
    // The only reason we are doing this is for privacy. If the fundingInput is
    // always first, it is very obvious. Hence, a serialId is randomly generated
    // and the inputs are sorted by that instead.
    const sortedPsbtInputs = psbtInputs.sort((a, b) =>
      Number(a.inputSerialId - b.inputSerialId),
    );

    // Get index of fundingInput
    const fundingInputIndex = sortedPsbtInputs.findIndex(
      (input) => input.inputSerialId === fundingInputSerialId,
    );

    // add to psbt
    sortedPsbtInputs.forEach((input, i) => psbt.addInput(input));

    const fundingInputs: FundingInput[] = await Promise.all(
      inputs.map(async (input) => {
        return this.inputToFundingInput(input);
      }),
    );

    const finalizer = new DualClosingTxFinalizer(
      fundingInputs,
      dlcOffer.payoutSPK,
      dlcAccept.payoutSPK,
      dlcOffer.feeRatePerVb,
    );

    const closeInputAmount = BigInt(
      inputs.reduce((acc, val) => acc + val.value, 0),
    );

    const offerPayoutValue: bigint = isOfferer
      ? closeInputAmount +
        initiatorPayoutSatoshis -
        finalizer.offerInitiatorFees
      : dlcOffer.contractInfo.totalCollateral - initiatorPayoutSatoshis;

    const acceptPayoutValue: bigint = isOfferer
      ? dlcOffer.contractInfo.totalCollateral - initiatorPayoutSatoshis
      : closeInputAmount +
        initiatorPayoutSatoshis -
        finalizer.offerInitiatorFees;

    const offerFirst = dlcOffer.payoutSerialId < dlcAccept.payoutSerialId;

    psbt.addOutput({
      value: Number(offerFirst ? offerPayoutValue : acceptPayoutValue),
      address: address.fromOutputScript(
        offerFirst ? dlcOffer.payoutSPK : dlcAccept.payoutSPK,
        network,
      ),
    });

    psbt.addOutput({
      value: Number(offerFirst ? acceptPayoutValue : offerPayoutValue),
      address: address.fromOutputScript(
        offerFirst ? dlcAccept.payoutSPK : dlcOffer.payoutSPK,
        network,
      ),
    });

    // Generate keypair to sign inputs
    const fundPrivateKeyPair = await this.GetFundKeyPair(
      dlcOffer,
      dlcAccept,
      isOfferer,
    );

    // Sign dlc fundinginput
    psbt.signInput(fundingInputIndex, fundPrivateKeyPair);

    // Sign dlcclose inputs
    await Promise.all(
      sortedPsbtInputs.map(async (input, i) => {
        if (i === fundingInputIndex) return;

        // derive keypair
        const keyPair = await this.getMethod('keyPair')(input.derivationPath);
        psbt.signInput(i, keyPair);
      }),
    );

    // Validate signatures
    psbt.validateSignaturesOfAllInputs();

    // Extract close signature from psbt and decode it to only extract r and s values
    const closeSignature = await script.signature.decode(
      psbt.data.inputs[fundingInputIndex].partialSig[0].signature,
    ).signature;

    // Extract funding signatures from psbt
    const inputSigs = psbt.data.inputs
      .filter((input) => input !== fundingInputIndex)
      .map((input) => input.partialSig[0]);

    // create fundingSignatures
    const witnessElements: ScriptWitness[][] = [];
    for (let i = 0; i < inputSigs.length; i++) {
      const sigWitness = new ScriptWitness();
      sigWitness.witness = inputSigs[i].signature;
      const pubKeyWitness = new ScriptWitness();
      pubKeyWitness.witness = inputSigs[i].pubkey;
      witnessElements.push([sigWitness, pubKeyWitness]);
    }
    const fundingSignatures = new FundingSignatures();
    fundingSignatures.witnessElements = witnessElements;

    // Create DlcClose
    const dlcClose = new DlcCloseV0();
    dlcClose.contractId = dlcTxs.contractId;
    dlcClose.offerPayoutSatoshis = BigInt(
      psbt.txOutputs[offerFirst ? 0 : 1].value,
    ); // You give collateral back to users
    dlcClose.acceptPayoutSatoshis = BigInt(
      psbt.txOutputs[offerFirst ? 1 : 0].value,
    ); // give collateral back to users
    dlcClose.fundInputSerialId = fundingInputSerialId; // randomly generated serial id
    dlcClose.closeSignature = closeSignature;
    dlcClose.fundingSignatures = fundingSignatures;
    dlcClose.fundingInputs = fundingInputs as FundingInput[];
    dlcClose.validate();

    return dlcClose;
  }

  /**
   * Generate multiple DlcClose messagetypes for closing DLC with Mutual Consent
   * @param _dlcOffer DlcOffer TLV (V0)
   * @param _dlcAccept DlcAccept TLV (V0)
   * @param _dlcTxs DlcTransactions TLV (V0)
   * @param initiatorPayouts Array of amounts initiator expects as payouts
   * @param isOfferer Whether offerer or not
   * @param _inputs Optionally specified closing inputs
   * @returns {Promise<DlcClose[]>}
   */
  async createBatchDlcClose(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    initiatorPayouts: bigint[],
    isOfferer?: boolean,
    _inputs?: Input[],
  ): Promise<DlcClose[]> {
    const { dlcOffer, dlcAccept, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcTxs,
    });

    if (isOfferer === undefined)
      isOfferer = await this.isOfferer(dlcOffer, dlcAccept);

    if (_inputs && _inputs.length > 0)
      throw Error('funding inputs not supported on BatchDlcClose'); // TODO support multiple funding inputs

    const fundingInputSerialId = generateSerialId();

    const fundingInputs: FundingInput[] = []; // TODO: support multiple funding inputs

    const finalizer = new DualClosingTxFinalizer(
      fundingInputs,
      dlcOffer.payoutSPK,
      dlcAccept.payoutSPK,
      dlcOffer.feeRatePerVb,
    );

    // Generate keypair to sign inputs
    const fundPrivateKeyPair = await this.GetFundKeyPair(
      dlcOffer,
      dlcAccept,
      isOfferer,
    );

    const closeInputAmount = BigInt(0); // TODO support multiple funding inputs

    const privKey = Buffer.from(fundPrivateKeyPair.privateKey).toString('hex');

    const rawCloseTxs = await this.CreateCloseRawTxs(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      closeInputAmount,
      isOfferer,
      [],
      fundingInputs,
      initiatorPayouts,
    );

    const sigHashes = await this.CreateSignatureHashes(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      rawCloseTxs,
    );

    const signatures = await this.CalculateEcSignatureHashes(
      sigHashes,
      privKey,
    );

    const dlcCloses = [];

    signatures.forEach((sig, i) => {
      const payout = initiatorPayouts[i];
      const payoutMinusOfferFees =
        finalizer.offerInitiatorFees > payout
          ? BigInt(0)
          : payout - finalizer.offerInitiatorFees;
      const collateralMinusPayout =
        payout > dlcOffer.contractInfo.totalCollateral
          ? BigInt(0)
          : dlcOffer.contractInfo.totalCollateral - payout;

      const offerPayoutValue: bigint = isOfferer
        ? closeInputAmount + payoutMinusOfferFees
        : collateralMinusPayout;

      const acceptPayoutValue: bigint = isOfferer
        ? collateralMinusPayout
        : closeInputAmount + payoutMinusOfferFees;

      const fundingSignatures = new FundingSignatures();

      const dlcClose = new DlcCloseV0();
      dlcClose.contractId = dlcTxs.contractId;
      dlcClose.offerPayoutSatoshis = offerPayoutValue;
      dlcClose.acceptPayoutSatoshis = acceptPayoutValue;
      dlcClose.fundInputSerialId = fundingInputSerialId;
      dlcClose.closeSignature = Buffer.from(sig, 'hex');
      dlcClose.fundingSignatures = fundingSignatures;
      dlcClose.validate();

      dlcCloses.push(dlcClose);
    });

    return dlcCloses;
  }

  async verifyBatchDlcCloseUsingMetadata(
    dlcCloseMetadata: DlcCloseMetadata,
    _dlcCloses: DlcClose[],
    isOfferer?: boolean,
  ): Promise<void> {
    const { dlcOffer, dlcAccept, dlcTxs } = dlcCloseMetadata.toDlcMessages();

    await this.verifyBatchDlcClose(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      _dlcCloses,
      isOfferer,
    );
  }

  /**
   * Verify multiple DlcClose messagetypes for closing DLC with Mutual Consent
   * @param _dlcOffer DlcOffer TLV (V0)
   * @param _dlcAccept DlcAccept TLV (V0)
   * @param _dlcTxs DlcTransactions TLV (V0)
   * @param _dlcCloses DlcClose[] TLV (V0)
   * @param isOfferer Whether offerer or not
   * @returns {Promise<void>}
   */
  async verifyBatchDlcClose(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    _dlcCloses: DlcClose[],
    isOfferer?: boolean,
  ): Promise<void> {
    const { dlcOffer, dlcAccept, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcTxs,
    });

    const dlcCloses = _dlcCloses.map(
      (_dlcClose) => checkTypes({ _dlcClose }).dlcClose,
    );

    if (isOfferer === undefined)
      isOfferer = await this.isOfferer(dlcOffer, dlcAccept);

    assert(
      dlcCloses.every((dlcClose) => dlcClose.fundingInputs.length === 0),
      'funding inputs not supported on verify BatchDlcClose',
    ); // TODO support multiple funding inputs

    const closeInputAmount = BigInt(0); // TODO support multiple funding inputs

    const rawCloseTxs = await this.CreateCloseRawTxs(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      closeInputAmount,
      isOfferer,
      dlcCloses,
    );

    const areSigsValid = await this.VerifySignatures(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      dlcCloses,
      rawCloseTxs,
      isOfferer,
    );

    assert(areSigsValid, 'Signatures invalid in Verify Batch DlcClose');
  }

  /**
   * Goal of finalize Dlc Close is for bob to
   * 1. take the dlcClose created by alice using createDlcClose,
   * 2. Build a psbt using Alice's dlcClose message
   * 3. Sign psbt with bob's privkey
   * 4. return a tx ready to be broadcast
   */

  /**
   * Finalize Dlc Close
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @param _dlcClose Dlc Close Message
   * @param _dlcTxs Dlc Transactions Message
   * @returns {Promise<Tx>}
   */
  async finalizeDlcClose(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcClose: DlcClose,
    _dlcTxs: DlcTransactions,
  ): Promise<string> {
    const { dlcOffer, dlcAccept, dlcClose, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcClose,
      _dlcTxs,
    });

    dlcOffer.validate();
    dlcAccept.validate();
    dlcClose.validate();

    const network = await this.getConnectedNetwork();
    const psbt = new Psbt({ network });

    const fundingPubKeys =
      Buffer.compare(dlcOffer.fundingPubKey, dlcAccept.fundingPubKey) === -1
        ? [dlcOffer.fundingPubKey, dlcAccept.fundingPubKey]
        : [dlcAccept.fundingPubKey, dlcOffer.fundingPubKey];

    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: fundingPubKeys,
      network,
    });

    const paymentVariant = payments.p2wsh({
      redeem: p2ms,
      network,
    });

    // Make temporary array to hold all inputs and then sort them
    // this method can be improved later
    const psbtInputs = [];
    psbtInputs.push({
      hash: dlcTxs.fundTx.txId.serialize(),
      index: dlcTxs.fundTxVout,
      sequence: 0,
      witnessUtxo: {
        script: paymentVariant.output,
        value: Number(dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats),
      },
      witnessScript: paymentVariant.redeem.output,
      inputSerialId: dlcClose.fundInputSerialId,
    });

    // add all dlc close inputs
    dlcClose.fundingInputs.forEach((input, i) => {
      psbtInputs.push({
        hash: input.prevTx.txId.serialize(),
        index: input.prevTxVout,
        sequence: 0,
        witnessUtxo: {
          script: input.prevTx.outputs[input.prevTxVout].scriptPubKey
            .serialize()
            .slice(1),
          value: Number(input.prevTx.outputs[input.prevTxVout].value.sats),
        },
        inputSerialId: input.inputSerialId,
      });
    });

    // sort all inputs in ascending order by serial ID
    // The only reason we are doing this is for privacy. If the fundingInput is
    // always first, it is very obvious. Hence, a serialId is randomly generated
    // and the inputs are sorted by that instead.
    const sortedPsbtInputs = psbtInputs.sort((a, b) =>
      Number(a.inputSerialId - b.inputSerialId),
    );

    // Get index of fundingInput
    const fundingInputIndex = sortedPsbtInputs.findIndex(
      (input) => input.inputSerialId === dlcClose.fundInputSerialId,
    );

    const offerFirst = dlcOffer.payoutSerialId < dlcAccept.payoutSerialId;

    psbt.addOutput({
      value: Number(
        offerFirst
          ? dlcClose.offerPayoutSatoshis
          : dlcClose.acceptPayoutSatoshis,
      ),
      address: address.fromOutputScript(
        offerFirst ? dlcOffer.payoutSPK : dlcAccept.payoutSPK,
        network,
      ),
    });

    psbt.addOutput({
      value: Number(
        offerFirst
          ? dlcClose.acceptPayoutSatoshis
          : dlcClose.offerPayoutSatoshis,
      ),
      address: address.fromOutputScript(
        offerFirst ? dlcAccept.payoutSPK : dlcOffer.payoutSPK,
        network,
      ),
    });

    // add to psbt
    sortedPsbtInputs.forEach((input, i) => psbt.addInput(input));

    const offerer = await this.isOfferer(dlcOffer, dlcAccept);

    // Generate keypair to sign inputs
    const fundPrivateKeyPair = await this.GetFundKeyPair(
      dlcOffer,
      dlcAccept,
      offerer,
    );

    // Sign dlc fundinginput
    psbt.signInput(fundingInputIndex, fundPrivateKeyPair);

    const partialSig = [
      {
        pubkey: offerer ? dlcAccept.fundingPubKey : dlcOffer.fundingPubKey,
        signature: await script.signature.encode(dlcClose.closeSignature, 1), // encode using SIGHASH_ALL
      },
    ];
    psbt.updateInput(fundingInputIndex, { partialSig });

    for (let i = 0; i < psbt.data.inputs.length; ++i) {
      if (i === fundingInputIndex) continue;
      if (!psbt.data.inputs[i].partialSig) psbt.data.inputs[i].partialSig = [];

      const witnessI = dlcClose.fundingSignatures.witnessElements.findIndex(
        (el) =>
          Buffer.compare(
            Script.p2wpkhLock(hash160(el[1].witness)).serialize().slice(1),
            psbt.data.inputs[i].witnessUtxo.script,
          ) === 0,
      );

      const partialSig = [
        {
          pubkey:
            dlcClose.fundingSignatures.witnessElements[witnessI][1].witness,
          signature:
            dlcClose.fundingSignatures.witnessElements[witnessI][0].witness,
        },
      ];

      psbt.updateInput(i, { partialSig });
    }

    psbt.validateSignaturesOfAllInputs();
    psbt.finalizeAllInputs();

    return psbt.extractTransaction().toHex();
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

  async fundingInputToInput(
    _input: FundingInput,
    findDerivationPath = true,
  ): Promise<Input> {
    const network = await this.getConnectedNetwork();
    const input = _input as FundingInput;
    const prevTx = input.prevTx;
    const prevTxOut = prevTx.outputs[input.prevTxVout];
    const scriptPubKey = prevTxOut.scriptPubKey.serialize().slice(1);
    const _address = address.fromOutputScript(scriptPubKey, network);
    let derivationPath: string;

    if (findDerivationPath) {
      const inputAddress: Address = await this.client.wallet.findAddress([
        _address,
      ]);
      if (inputAddress) {
        derivationPath = inputAddress.derivationPath;
      }
    }

    return {
      txid: prevTx.txId.toString(),
      vout: input.prevTxVout,
      address: _address,
      amount: prevTxOut.value.bitcoin,
      value: Number(prevTxOut.value.sats),
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
    const fundingInput = new FundingInput();
    fundingInput.prevTxVout = input.vout;

    let txRaw = '';
    try {
      txRaw = await this.getMethod('getRawTransactionByHash')(input.txid);
    } catch (e) {
      try {
        txRaw = (await this.getMethod('jsonrpc')('gettransaction', input.txid))
          .hex;
      } catch (e) {
        throw Error(
          `Cannot find tx ${input.txid} in inputToFundingInput using getrawtransactionbyhash or gettransaction`,
        );
      }
    }

    const tx = Tx.decode(StreamReader.fromHex(txRaw));

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

  async getConnectedNetwork(): Promise<BitcoinNetwork> {
    return this._network;
  }
}

export interface InitializeResponse {
  fundingPubKey: Buffer;
  payoutSPK: Buffer;
  payoutSerialId: bigint;
  fundingInputs: FundingInput[];
  changeSPK: Buffer;
  changeSerialId: bigint;
}

export interface AcceptDlcOfferResponse {
  dlcAccept: DlcAccept;
  dlcTransactions: DlcTransactions;
}

export interface SignDlcAcceptResponse {
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
  cetSignatures: CetAdaptorSignatures;
  refundSignature: Buffer;
}

interface PayoutGroup {
  payout: bigint;
  groups: number[][];
}

interface FindOutcomeResponse {
  index: number;
  groupLength: number;
}

export interface Change {
  value: number;
}

export interface Output {
  value: number;
  id?: string;
}

export interface InputsForAmountResponse {
  inputs: Input[];
  change: Change;
  outputs: Output[];
  fee: number;
}

const BurnAddress = 'bcrt1qxcjufgh2jarkp2qkx68azh08w9v5gah8u6es8s';
