import Provider from '@atomicfinance/provider';
import {
  AdaptorPair,
  Address,
  AddSignaturesToRefundTxRequest,
  AddSignaturesToRefundTxResponse,
  AddSignatureToFundTransactionRequest,
  AddSignatureToFundTransactionResponse,
  CalculateEcSignatureRequest,
  CreateBatchDlcTransactionsRequest,
  CreateBatchDlcTransactionsResponse,
  CreateBatchFundTransactionRequest,
  CreateBatchFundTransactionResponse,
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
import { Script, Sequence, Tx } from '@node-dlc/bitcoin';
import { StreamReader } from '@node-dlc/bufio';
import {
  DualClosingTxFinalizer,
  DualFundingTxFinalizer,
  groupByIgnoringDigits,
  HyperbolaPayoutCurve,
  PolynomialPayoutCurve,
  roundPayout,
} from '@node-dlc/core';
import { hash160, sha256, xor } from '@node-dlc/crypto';
import {
  CetAdaptorSignatures,
  ContractDescriptor,
  ContractDescriptorType,
  ContractInfo,
  ContractInfoType,
  DigitDecompositionEventDescriptor,
  DisjointContractInfo,
  DlcAccept,
  DlcClose,
  DlcCloseMetadata,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  EnumeratedDescriptor,
  EnumEventDescriptor,
  F64,
  FundingInput,
  FundingSignatures,
  HyperbolaPayoutCurvePiece,
  MessageType,
  MultiOracleInfo,
  NumericalDescriptor,
  OracleAttestation,
  OracleEvent,
  OracleInfo,
  PayoutCurvePieceType,
  PayoutFunction,
  PayoutFunctionV0,
  PolynomialPayoutCurvePiece,
  ScriptWitnessV0,
  SingleContractInfo,
  SingleOracleInfo,
} from '@node-dlc/messaging';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { BitcoinNetwork, chainHashFromNetwork } from 'bitcoin-networks';
import { address, payments, Psbt, script } from 'bitcoinjs-lib';
import crypto from 'crypto';
import { ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

import {
  asyncForEach,
  checkTypes,
  generateSerialId,
  generateSerialIds,
  outputsToPayouts,
} from './utils/Utils';

export default class BitcoinDlcProvider
  extends Provider
  implements Partial<DlcProvider>
{
  _network: BitcoinNetwork;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _cfdDlcJs: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(network: BitcoinNetwork, cfdDlcJs?: any) {
    super();

    this._network = network;
    this._cfdDlcJs = cfdDlcJs;
  }

  public async CfdLoaded() {
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
    amounts: bigint[],
    feeRatePerVb: bigint,
    fixedInputs: Input[] = [],
  ): Promise<Input[]> {
    if (amounts.length === 0) return [];

    const fixedUtxos = fixedInputs.map((input) => input.toUtxo());

    let inputs: Input[];
    try {
      const inputsForAmount: InputsForDualAmountResponse = await this.getMethod(
        'getInputsForDualFunding',
      )(amounts, feeRatePerVb, fixedUtxos);

      inputs = inputsForAmount.inputs;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      if (fixedInputs.length === 0) {
        throw Error(
          `Not enough balance getInputsForAmount. Error: ${errorMessage}`,
        );
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
    const payoutAddress: Address =
      await this.client.wallet.getUnusedAddress(false);
    const payoutSPK: Buffer = address.toOutputScript(
      payoutAddress.address,
      network,
    );
    const changeAddress: Address =
      await this.client.wallet.getUnusedAddress(true);
    const changeSPK: Buffer = address.toOutputScript(
      changeAddress.address,
      network,
    );

    const fundingAddress: Address =
      await this.client.wallet.getUnusedAddress(false);
    const fundingPubKey: Buffer = Buffer.from(fundingAddress.publicKey, 'hex');

    if (fundingAddress.address === payoutAddress.address)
      throw Error('Address reuse');

    const inputs: Input[] = await this.GetInputsForAmount(
      [collateral],
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

  private async BatchInitialize(
    collaterals: bigint[],
    feeRatePerVb: bigint,
    fixedInputs: Input[],
  ): Promise<BatchInitializeResponse> {
    const network = await this.getConnectedNetwork();

    const inputs: Input[] = await this.GetInputsForAmount(
      collaterals,
      feeRatePerVb,
      fixedInputs,
    );

    const fundingInputs: FundingInput[] = await Promise.all(
      inputs.map(async (input) => {
        return this.inputToFundingInput(input);
      }),
    );

    const initializeResponses: BatchBaseInitializeResponse[] = [];

    const changeSerialId: bigint = generateSerialId();

    const changeAddress: Address =
      await this.client.wallet.getUnusedAddress(true);
    const changeSPK: Buffer = address.toOutputScript(
      changeAddress.address,
      network,
    );

    for (let i = 0; i < collaterals.length; i++) {
      const payoutAddress: Address =
        await this.client.wallet.getUnusedAddress(false);
      const payoutSPK: Buffer = address.toOutputScript(
        payoutAddress.address,
        network,
      );

      const fundingAddress: Address =
        await this.client.wallet.getUnusedAddress(false);
      const fundingPubKey: Buffer = Buffer.from(
        fundingAddress.publicKey,
        'hex',
      );

      if (fundingAddress.address === payoutAddress.address)
        throw Error('Address reuse');

      const payoutSerialId: bigint = generateSerialId();

      initializeResponses.push({
        fundingPubKey,
        payoutSPK,
        payoutSerialId,
      });
    }

    return { fundingInputs, initializeResponses, changeSerialId, changeSPK };
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
    dlcOffer: DlcOffer,
    contractDescriptor: NumericalDescriptor,
    oracleInfo: OracleInfo,
    totalCollateral: bigint,
  ): GetPayoutsResponse {
    const payoutFunction = contractDescriptor.payoutFunction as PayoutFunction;
    if (payoutFunction.payoutFunctionPieces.length === 0)
      throw Error('PayoutFunction must have at least once PayoutCurvePiece');
    if (payoutFunction.payoutFunctionPieces.length > 1)
      throw Error('More than one PayoutCurvePiece not supported');
    const payoutCurvePiece = payoutFunction.payoutFunctionPieces[0]
      .payoutCurvePiece as HyperbolaPayoutCurvePiece;
    if (
      payoutCurvePiece.payoutCurvePieceType !== PayoutCurvePieceType.Hyperbola
    )
      throw Error('Must be HyperbolaPayoutCurvePiece');
    if (!payoutCurvePiece.b.eq(F64.ZERO) || !payoutCurvePiece.c.eq(F64.ZERO))
      throw Error('b and c HyperbolaPayoutCurvePiece values must be 0');
    // Cast to SingleOracleInfo to access announcement property
    const singleOracleInfo = oracleInfo as SingleOracleInfo;
    const eventDescriptor = singleOracleInfo.announcement.oracleEvent
      .eventDescriptor as DigitDecompositionEventDescriptor;
    if (eventDescriptor.type !== MessageType.DigitDecompositionEventDescriptor)
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

    const rValuesMessagesList = this.GenerateMessages(singleOracleInfo);

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
    dlcOffer: DlcOffer,
    contractDescriptor: NumericalDescriptor,
    oracleInfo: SingleOracleInfo,
    totalCollateral: bigint,
  ): GetPayoutsResponse {
    const payoutFunction = contractDescriptor.payoutFunction as PayoutFunction;
    if (payoutFunction.payoutFunctionPieces.length === 0)
      throw Error('PayoutFunction must have at least once PayoutCurvePiece');
    for (const piece of payoutFunction.payoutFunctionPieces) {
      if (
        piece.payoutCurvePiece.type !== MessageType.PolynomialPayoutCurvePiece
      )
        throw Error('Must be PolynomialPayoutCurvePiece');
    }
    const eventDescriptor = oracleInfo.announcement.oracleEvent
      .eventDescriptor as DigitDecompositionEventDescriptor;
    if (eventDescriptor.type !== MessageType.DigitDecompositionEventDescriptor)
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

  private GetPayouts(dlcOffer: DlcOffer): GetPayoutsResponse[] {
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

  private GetPayoutsFromEnumeratedDescriptor(
    dlcOffer: DlcOffer,
    contractDescriptor: EnumeratedDescriptor,
    oracleInfo: OracleInfo,
    totalCollateral: bigint,
  ): GetPayoutsResponse {
    const payoutGroups: PayoutGroup[] = [];
    const rValuesMessagesList = this.GenerateMessages(
      oracleInfo as SingleOracleInfo,
    );

    // For enumerated descriptors, each outcome creates one payout
    // Each outcome maps to one index in the oracle's possible outcomes
    contractDescriptor.outcomes.forEach((outcome, index) => {
      payoutGroups.push({
        payout: outcome.localPayout,
        groups: [[index]], // Simple index-based grouping for enum outcomes
      });
    });

    const { payouts, messagesList } = outputsToPayouts(
      payoutGroups,
      rValuesMessagesList,
      dlcOffer.offerCollateral,
      totalCollateral - dlcOffer.offerCollateral,
      true,
    );

    return { payouts, payoutGroups, messagesList };
  }

  private GetPayoutsFromContractDescriptor(
    dlcOffer: DlcOffer,
    contractDescriptor: ContractDescriptor,
    oracleInfo: OracleInfo,
    totalCollateral: bigint,
  ) {
    switch (contractDescriptor.contractDescriptorType) {
      case ContractDescriptorType.Enumerated: {
        return this.GetPayoutsFromEnumeratedDescriptor(
          dlcOffer,
          contractDescriptor as EnumeratedDescriptor,
          oracleInfo,
          totalCollateral,
        );
      }
      case ContractDescriptorType.NumericOutcome: {
        const numericalDescriptor = contractDescriptor as NumericalDescriptor;
        const payoutFunction = numericalDescriptor.payoutFunction;

        // TODO: add a better check for this
        const payoutCurvePiece =
          payoutFunction.payoutFunctionPieces[0].payoutCurvePiece;

        switch (payoutCurvePiece.payoutCurvePieceType) {
          case PayoutCurvePieceType.Hyperbola:
            return this.GetPayoutsFromPayoutFunction(
              dlcOffer,
              numericalDescriptor,
              oracleInfo,
              totalCollateral,
            );
          case PayoutCurvePieceType.Polynomial:
            return this.GetPayoutsFromPolynomialPayoutFunction(
              dlcOffer,
              numericalDescriptor,
              oracleInfo as SingleOracleInfo,
              totalCollateral,
            );
        }
      }
    }
  }

  public async createDlcTxs(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
  ): Promise<CreateDlcTxsResponse> {
    const localFundPubkey = dlcOffer.fundingPubkey.toString('hex');
    const remoteFundPubkey = dlcAccept.fundingPubkey.toString('hex');
    const localFinalScriptPubkey = dlcOffer.payoutSpk.toString('hex');
    const remoteFinalScriptPubkey = dlcAccept.payoutSpk.toString('hex');
    const localChangeScriptPubkey = dlcOffer.changeSpk.toString('hex');
    const remoteChangeScriptPubkey = dlcAccept.changeSpk.toString('hex');

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

    let payouts: PayoutRequest[] = [];
    let messagesList: Messages[] = [];

    if (
      dlcOffer.contractInfo.type === MessageType.SingleContractInfo &&
      (dlcOffer.contractInfo as SingleContractInfo).contractDescriptor.type ===
        ContractDescriptorType.Enumerated
    ) {
      for (const outcome of (
        (dlcOffer.contractInfo as SingleContractInfo)
          .contractDescriptor as EnumeratedDescriptor
      ).outcomes) {
        payouts.push({
          local: outcome.localPayout,
          remote:
            dlcOffer.offerCollateral +
            dlcAccept.acceptCollateral -
            outcome.localPayout,
        });
        messagesList.push({ messages: [outcome.outcome] });
      }
    } else {
      const payoutResponses = this.GetPayouts(dlcOffer);
      const { payouts: tempPayouts, messagesList: tempMessagesList } =
        this.FlattenPayouts(payoutResponses);
      payouts = tempPayouts;
      messagesList = tempMessagesList;
    }

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

    const dlcTransactions = new DlcTransactions();
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

  public async createBatchDlcTxs(
    dlcOffers: DlcOffer[],
    dlcAccepts: DlcAccept[],
  ): Promise<CreateBatchDlcTxsResponse> {
    const localFundPubkeys = dlcOffers.map((dlcOffer) =>
      dlcOffer.fundingPubkey.toString('hex'),
    );
    const remoteFundPubkeys = dlcAccepts.map((dlcAccept) =>
      dlcAccept.fundingPubkey.toString('hex'),
    );
    const localFinalScriptPubkeys = dlcOffers.map((dlcOffer) =>
      dlcOffer.payoutSpk.toString('hex'),
    );
    const remoteFinalScriptPubkeys = dlcAccepts.map((dlcAccept) =>
      dlcAccept.payoutSpk.toString('hex'),
    );
    const localChangeScriptPubkey = dlcOffers[0].changeSpk.toString('hex');
    const remoteChangeScriptPubkey = dlcAccepts[0].changeSpk.toString('hex');

    const localInputs: Utxo[] = await Promise.all(
      dlcOffers[0].fundingInputs.map(async (fundingInput) => {
        const input = await this.fundingInputToInput(fundingInput, false);
        return input.toUtxo();
      }),
    );

    const remoteInputs: Utxo[] = await Promise.all(
      dlcAccepts[0].fundingInputs.map(async (fundingInput) => {
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

    const localPayouts: (bigint | number)[] = [];
    const remotePayouts: (bigint | number)[] = [];
    const numPayouts: (bigint | number)[] = [];

    const nestedMessagesList: Messages[][] = [];

    // loop through all dlc offers, get payouts, and add to localPayouts and remotePayouts
    for (const dlcOffer of dlcOffers) {
      const payoutResponses = this.GetPayouts(dlcOffer);
      const { payouts, messagesList } = this.FlattenPayouts(payoutResponses);
      const tempLocalPayouts = payouts.map((payout) => payout.local);
      const tempRemotePayouts = payouts.map((payout) => payout.remote);
      localPayouts.push(...tempLocalPayouts);
      remotePayouts.push(...tempRemotePayouts);
      numPayouts.push(tempLocalPayouts.length);
      nestedMessagesList.push(messagesList);
    }

    const batchDlcTxRequest: CreateBatchDlcTransactionsRequest = {
      localPayouts,
      remotePayouts,
      numPayouts,
      localFundPubkeys,
      localFinalScriptPubkeys,
      remoteFundPubkeys,
      remoteFinalScriptPubkeys,
      localInputAmount,
      localCollateralAmounts: dlcOffers.map(
        (dlcOffer) => dlcOffer.offerCollateral,
      ),
      localPayoutSerialIds: dlcOffers.map(
        (dlcOffer) => dlcOffer.payoutSerialId,
      ),
      localChangeSerialId: dlcOffers[0].changeSerialId,
      remoteInputAmount,
      remoteCollateralAmounts: dlcAccepts.map(
        (dlcAccept) => dlcAccept.acceptCollateral,
      ),
      remotePayoutSerialIds: dlcAccepts.map(
        (dlcAccept) => dlcAccept.payoutSerialId,
      ),
      remoteChangeSerialId: dlcAccepts[0].changeSerialId,
      refundLocktimes: dlcOffers.map((dlcOffer) => dlcOffer.refundLocktime),
      localInputs,
      remoteInputs,
      localChangeScriptPubkey,
      remoteChangeScriptPubkey,
      feeRate: Number(dlcOffers[0].feeRatePerVb),
      cetLockTime: dlcOffers[0].cetLocktime,
      fundOutputSerialIds: dlcOffers.map(
        (dlcOffer) => dlcOffer.fundOutputSerialId,
      ),
    };

    const dlcTxs = await this.CreateBatchDlcTransactions(batchDlcTxRequest);

    const dlcTransactionsList: DlcTransactions[] = [];

    let start = 0;
    for (let i = 0; i < dlcTxs.refundTxHexList.length; i++) {
      const dlcTransactions = new DlcTransactions();

      dlcTransactions.fundTx = Tx.decode(
        StreamReader.fromHex(dlcTxs.fundTxHex),
      );

      dlcTransactions.fundTxVout = [
        BigInt(dlcOffers[i].changeSerialId),
        BigInt(dlcAccepts[i].changeSerialId),
        ...dlcOffers.map((dlcOffer) => dlcOffer.fundOutputSerialId),
      ]
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .findIndex(
          (j) => BigInt(j) === BigInt(dlcOffers[i].fundOutputSerialId),
        );

      dlcTransactions.refundTx = Tx.decode(
        StreamReader.fromHex(dlcTxs.refundTxHexList[i]),
      );

      // slice cetsHexList based on numPayouts
      const end = start + Number(numPayouts[i]);
      const cetsHexList = dlcTxs.cetsHexList.slice(start, end);
      start = end;
      dlcTransactions.cets = cetsHexList.map((cetHex) => {
        return Tx.decode(StreamReader.fromHex(cetHex));
      });

      dlcTransactionsList.push(dlcTransactions);
    }

    return { dlcTransactionsList, nestedMessagesList };
  }

  private GenerateEnumMessages(oracleEvent: OracleEvent): Messages[] {
    const eventDescriptor = oracleEvent.eventDescriptor as EnumEventDescriptor;

    // For enum events, each oracle has one nonce and can attest to one of the possible outcomes
    const messagesList: Messages[] = [];

    // For enum events, hash the outcomes to match the contract descriptor format
    const messages = eventDescriptor.outcomes.map((outcome) =>
      sha256(Buffer.from(outcome)).toString('hex'),
    );
    messagesList.push({ messages });

    return messagesList;
  }

  private GenerateDigitDecompositionMessages(
    oracleEvent: OracleEvent,
  ): Messages[] {
    const oracleNonces = oracleEvent.oracleNonces;
    const eventDescriptor =
      oracleEvent.eventDescriptor as DigitDecompositionEventDescriptor;

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
    // Handle both SingleOracleInfo and MultiOracleInfo using type property instead of instanceof
    let oracleEvent: OracleEvent;

    if (oracleInfo.type === MessageType.SingleOracleInfo) {
      const singleOracleInfo = oracleInfo as SingleOracleInfo;
      oracleEvent = singleOracleInfo.announcement.oracleEvent;
    } else if (oracleInfo.type === MessageType.MultiOracleInfo) {
      const multiOracleInfo = oracleInfo as MultiOracleInfo;
      // For multi-oracle, use the first announcement for now
      // TODO: This might need more sophisticated handling for multi-oracle scenarios
      if (multiOracleInfo.announcements.length === 0) {
        throw Error('MultiOracleInfo must have at least one announcement');
      }
      oracleEvent = multiOracleInfo.announcements[0].oracleEvent;
    } else {
      throw Error(
        `OracleInfo must be SingleOracleInfo or MultiOracleInfo, got type: ${oracleInfo.type}`,
      );
    }

    switch (oracleEvent.eventDescriptor.type) {
      case MessageType.EnumEventDescriptor:
        return this.GenerateEnumMessages(oracleEvent);
      case MessageType.DigitDecompositionEventDescriptor:
        return this.GenerateDigitDecompositionMessages(oracleEvent);
      default:
        throw Error('EventDescriptor must be Enum or DigitDecomposition');
    }
  }

  private GetContractOraclePairs(
    _contractInfo: ContractInfo,
  ): { contractDescriptor: ContractDescriptor; oracleInfo: OracleInfo }[] {
    // Use contractInfoType property instead of instanceof for more reliable type checking
    if (_contractInfo.contractInfoType === ContractInfoType.Single) {
      const singleInfo = _contractInfo as SingleContractInfo;
      return [
        {
          contractDescriptor: singleInfo.contractDescriptor,
          oracleInfo: singleInfo.oracleInfo,
        },
      ];
    } else if (_contractInfo.contractInfoType === ContractInfoType.Disjoint) {
      const disjointInfo = _contractInfo as DisjointContractInfo;
      return disjointInfo.contractOraclePairs;
    } else {
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
      hash160(isOfferer ? dlcOffer.fundingPubkey : dlcAccept.fundingPubkey),
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

    const sigs: ISig[][] = [];

    if (
      dlcOffer.contractInfo.contractInfoType === ContractInfoType.Single &&
      (dlcOffer.contractInfo as SingleContractInfo).contractDescriptor.type ===
        MessageType.ContractDescriptorV0
    ) {
      for (const { oracleInfo } of contractOraclePairs) {
        if (oracleInfo.type !== MessageType.SingleOracleInfo) {
          throw new Error('Only SingleOracleInfo supported in this context');
        }
        const oracleAnnouncement = (oracleInfo as SingleOracleInfo)
          .announcement;

        const adaptorSigRequestPromises: Promise<AdaptorPair[]>[] = [];

        const tempMessagesList = messagesList;
        const tempCetsHex = cetsHex;

        const cetSignRequest: CreateCetAdaptorSignaturesRequest = {
          messagesList: tempMessagesList,
          cetsHex: tempCetsHex,
          privkey: fundPrivateKey,
          fundTxId: dlcTxs.fundTx.txId.toString(),
          fundVout: dlcTxs.fundTxVout,
          localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
          remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
          fundInputAmount: dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
          oraclePubkey: oracleAnnouncement.oraclePubkey.toString('hex'),
          oracleRValues: oracleAnnouncement.oracleEvent.oracleNonces.map(
            (nonce) => nonce.toString('hex'),
          ),
        };

        adaptorSigRequestPromises.push(
          (async () => {
            const response =
              await this.CreateCetAdaptorSignatures(cetSignRequest);
            return response.adaptorPairs;
          })(),
        );

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
    } else {
      const indices = this.GetIndicesFromPayouts(this.GetPayouts(_dlcOffer));

      for (const [index, { oracleInfo }] of contractOraclePairs.entries()) {
        if (oracleInfo.type !== MessageType.SingleOracleInfo) {
          throw new Error('Only SingleOracleInfo supported in this context');
        }
        const oracleAnnouncement = (oracleInfo as SingleOracleInfo)
          .announcement;

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
            localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
            remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
            fundInputAmount:
              dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
            oraclePubkey: oracleAnnouncement.oraclePubkey.toString('hex'),
            oracleRValues: oracleAnnouncement.oracleEvent.oracleNonces.map(
              (nonce) => nonce.toString('hex'),
            ),
          };

          adaptorSigRequestPromises.push(
            (async () => {
              const response =
                await this.CreateCetAdaptorSignatures(cetSignRequest);
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
    }

    const refundSignRequest: GetRawRefundTxSignatureRequest = {
      refundTxHex: dlcTxs.refundTx.serialize().toString('hex'),
      privkey: fundPrivateKey,
      fundTxId: dlcTxs.fundTx.txId.toString(),
      fundVout: dlcTxs.fundTxVout,
      localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
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

    const contractOraclePairs = this.GetContractOraclePairs(
      dlcOffer.contractInfo,
    );

    if (
      dlcOffer.contractInfo.type === MessageType.SingleContractInfo &&
      (dlcOffer.contractInfo as SingleContractInfo).contractDescriptor.type ===
        MessageType.ContractDescriptorV0
    ) {
      for (const { oracleInfo } of contractOraclePairs) {
        if (oracleInfo.type !== MessageType.SingleOracleInfo) {
          throw new Error('Only SingleOracleInfo supported in this context');
        }
        const oracleAnnouncement = (oracleInfo as SingleOracleInfo)
          .announcement;

        const oracleEventCetsHex = cetsHex;
        const oracleEventSigs = isOfferer
          ? dlcAccept.cetAdaptorSignatures.sigs
          : dlcSign.cetAdaptorSignatures.sigs;

        const sigsValidity: Promise<boolean>[] = [];

        const tempMessagesList = messagesList;
        const tempCetsHex = oracleEventCetsHex;
        const tempSigs = oracleEventSigs;
        const tempAdaptorPairs = tempSigs.map((sig) => {
          return {
            signature: sig.encryptedSig.toString('hex'),
            proof: sig.dleqProof.toString('hex'),
          };
        });

        const verifyCetAdaptorSignaturesRequest: VerifyCetAdaptorSignaturesRequest =
          {
            cetsHex: tempCetsHex,
            messagesList: tempMessagesList,
            oraclePubkey: oracleAnnouncement.oraclePubkey.toString('hex'),
            oracleRValues: oracleAnnouncement.oracleEvent.oracleNonces.map(
              (nonce) => nonce.toString('hex'),
            ),
            adaptorPairs: tempAdaptorPairs,
            localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
            remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
            fundTxId: dlcTxs.fundTx.txId.toString(),
            fundVout: dlcTxs.fundTxVout,
            fundInputAmount:
              dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
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

        let areSigsValid = (await Promise.all(sigsValidity)).every((b) => b);

        const verifyRefundSigRequest: VerifyRefundTxSignatureRequest = {
          refundTxHex: dlcTxs.refundTx.serialize().toString('hex'),
          signature: isOfferer
            ? dlcAccept.refundSignature.toString('hex')
            : dlcSign.refundSignature.toString('hex'),
          localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
          remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
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
    } else {
      const chunk = 100;

      const indices = this.GetIndicesFromPayouts(this.GetPayouts(_dlcOffer));

      for (const [index, { oracleInfo }] of contractOraclePairs.entries()) {
        if (oracleInfo.type !== MessageType.SingleOracleInfo) {
          throw new Error('Only SingleOracleInfo supported in this context');
        }
        const oracleAnnouncement = (oracleInfo as SingleOracleInfo)
          .announcement;

        const startingIndex = indices[index].startingMessagesIndex,
          endingIndex = indices[index + 1].startingMessagesIndex;

        const oracleEventMessagesList = messagesList.slice(
          startingIndex,
          endingIndex,
        );
        const oracleEventCetsHex = cetsHex.slice(startingIndex, endingIndex);
        const oracleEventSigs = (
          isOfferer
            ? dlcAccept.cetAdaptorSignatures.sigs
            : dlcSign.cetAdaptorSignatures.sigs
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

          const verifyCetAdaptorSignaturesRequest: VerifyCetAdaptorSignaturesRequest =
            {
              cetsHex: tempCetsHex,
              messagesList: tempMessagesList,
              oraclePubkey: oracleAnnouncement.oraclePubkey.toString('hex'),
              oracleRValues: oracleAnnouncement.oracleEvent.oracleNonces.map(
                (nonce) => nonce.toString('hex'),
              ),
              adaptorPairs: tempAdaptorPairs,
              localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
              remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
              fundTxId: dlcTxs.fundTx.txId.toString(),
              fundVout: dlcTxs.fundTxVout,
              fundInputAmount:
                dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
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
          localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
          remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
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

    const witnessElements: ScriptWitnessV0[][] = [];
    for (let i = 0; i < fundTxSigs.length; i++) {
      const sigWitness = new ScriptWitnessV0();
      sigWitness.witness = Buffer.from(fundTxSigs[i], 'hex');
      const pubKeyWitness = new ScriptWitnessV0();
      pubKeyWitness.witness = Buffer.from(inputPubKeys[i], 'hex');
      witnessElements.push([sigWitness, pubKeyWitness]);
    }

    const fundingSignatures = new FundingSignatures();
    fundingSignatures.witnessElements = witnessElements;

    return fundingSignatures;
  }

  private async VerifyFundingSigs(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    isOfferer: boolean,
  ): Promise<void> {
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
          const response =
            await this.VerifyFundTxSignature(verifyFundSigRequest);
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
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    fundingSignatures: FundingSignatures,
  ): Promise<Tx> {
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
    dlcOffer: DlcOffer,
    contractDescriptor: NumericalDescriptor,
    contractOraclePairIndex: number,
    polynomialPayoutCurvePiece: PolynomialPayoutCurvePiece,
    oracleAttestation: OracleAttestation,
    outcome: bigint,
  ): Promise<FindOutcomeResponse> {
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
    const payoutIndexOffset =
      this.GetIndicesFromPayouts(payoutResponses)[contractOraclePairIndex]
        .startingMessagesIndex;

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
    contractDescriptor: NumericalDescriptor,
    contractOraclePairIndex: number,
    hyperbolaPayoutCurvePiece: HyperbolaPayoutCurvePiece,
    oracleAttestation: OracleAttestation,
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
    const payoutIndexOffset =
      this.GetIndicesFromPayouts(payoutResponses)[contractOraclePairIndex]
        .startingMessagesIndex;

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

    for (const [i, payoutGroup] of payoutGroups.entries()) {
      if (payoutGroup.payout === roundedPayout) {
        groupIndex = payoutGroup.groups.findIndex((group) => {
          return group.every((msg, i) => msg === outcomesFormatted[i]);
        });
        if (groupIndex !== -1) {
          index += groupIndex;
          groupLength = payoutGroup.groups[groupIndex].length;
          break;
        }
      } else if (
        payoutGroup.payout === BigInt(Math.round(Number(payout.toString()))) &&
        i !== 0
      ) {
        // Edge case to account for case where payout is maximum payout for DLC
        // But rounded payout does not round down
        if (payoutGroups[i - 1].payout === roundedPayout) {
          // Ensure that the previous payout group causes index to be incremented
          index += payoutGroups[i - 1].groups.length;
        }

        groupIndex = payoutGroup.groups.findIndex((group) => {
          return group.every((msg, i) => msg === outcomesFormatted[i]);
        });
        if (groupIndex !== -1) {
          index += groupIndex;
          groupLength = payoutGroup.groups[groupIndex].length;
          break;
        }
      } else {
        index += payoutGroup.groups.length;
      }
    }

    if (groupIndex === -1) {
      // Fallback to brute force search if payout-based search fails
      index = 0;
      groupLength = 0;

      for (const [, payoutGroup] of payoutGroups.entries()) {
        groupIndex = payoutGroup.groups.findIndex((group) => {
          return group.every((msg, j) => msg === outcomesFormatted[j]);
        });

        if (groupIndex !== -1) {
          index += groupIndex;
          groupLength = payoutGroup.groups[groupIndex].length;
          break;
        } else {
          index += payoutGroup.groups.length;
        }
      }

      if (groupIndex === -1) {
        throw Error(
          'Failed to Find OutcomeIndex From HyperbolaPayoutCurvePiece. \
Payout Group not found even with brute force search',
        );
      }
    }

    return { index: payoutIndexOffset + index, groupLength };
  }

  async FindOutcomeIndex(
    dlcOffer: DlcOffer,
    oracleAttestation: OracleAttestation,
  ): Promise<FindOutcomeResponse> {
    const contractOraclePairs = this.GetContractOraclePairs(
      dlcOffer.contractInfo,
    );
    const contractOraclePairIndex = contractOraclePairs.findIndex(
      ({ oracleInfo }) => {
        if (oracleInfo.type !== MessageType.SingleOracleInfo) return false;
        const singleOracleInfo = oracleInfo as SingleOracleInfo;
        return (
          singleOracleInfo.announcement.oracleEvent.eventId ===
          oracleAttestation.eventId
        );
      },
    );
    assert(
      contractOraclePairIndex !== -1,
      'OracleAttestation must be for an existing OracleEvent',
    );

    const contractOraclePair = contractOraclePairs[contractOraclePairIndex];

    const { contractDescriptor: _contractDescriptor, oracleInfo } =
      contractOraclePair;
    assert(
      _contractDescriptor.contractDescriptorType ===
        ContractDescriptorType.NumericOutcome,
      'ContractDescriptor must be NumericOutcome',
    );
    const contractDescriptor = _contractDescriptor as NumericalDescriptor;
    const _payoutFunction = contractDescriptor.payoutFunction;
    assert(
      _payoutFunction.type === MessageType.PayoutFunction,
      'PayoutFunction must be V0',
    );

    if (oracleInfo.type !== MessageType.SingleOracleInfo) {
      throw new Error('Only SingleOracleInfo supported in this context');
    }

    const singleOracleInfo = oracleInfo as SingleOracleInfo;
    const eventDescriptor = singleOracleInfo.announcement.oracleEvent
      .eventDescriptor as DigitDecompositionEventDescriptor;
    const payoutFunction = _payoutFunction as PayoutFunctionV0;

    const base = eventDescriptor.base;
    const outcome: number = [...oracleAttestation.outcomes]
      .reverse()
      .reduce((acc, val, i) => acc + Number(val) * base ** i, 0);

    const piecesSorted = payoutFunction.payoutFunctionPieces.sort(
      (a, b) =>
        Number(a.endPoint.eventOutcome) - Number(b.endPoint.eventOutcome),
    );

    const piece = piecesSorted.find(
      (piece) => outcome < piece.endPoint.eventOutcome,
    );

    switch (piece.payoutCurvePiece.type) {
      case MessageType.PolynomialPayoutCurvePiece:
        return this.FindOutcomeIndexFromPolynomialPayoutCurvePiece(
          dlcOffer,
          contractDescriptor,
          contractOraclePairIndex,
          piece.payoutCurvePiece as PolynomialPayoutCurvePiece,
          oracleAttestation,
          BigInt(outcome),
        );
      case MessageType.HyperbolaPayoutCurvePiece:
        return this.FindOutcomeIndexFromHyperbolaPayoutCurvePiece(
          dlcOffer,
          contractDescriptor,
          contractOraclePairIndex,
          piece.payoutCurvePiece as HyperbolaPayoutCurvePiece,
          oracleAttestation,
          BigInt(outcome),
        );
      case MessageType.OldHyperbolaPayoutCurvePiece:
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
    dlcOffer: DlcOffer,
    oracleAttestation: OracleAttestation,
  ): void {
    switch (dlcOffer.contractInfo.contractInfoType) {
      case ContractInfoType.Single: {
        const contractInfo = dlcOffer.contractInfo as SingleContractInfo;
        switch (contractInfo.contractDescriptor.contractDescriptorType) {
          case ContractDescriptorType.Enumerated: {
            const oracleInfo = contractInfo.oracleInfo;
            if (oracleInfo.type !== MessageType.SingleOracleInfo) {
              throw Error('Only SingleOracleInfo supported in this context');
            }
            const singleOracleInfo = oracleInfo as SingleOracleInfo;
            if (
              singleOracleInfo.announcement.oracleEvent.eventId !==
              oracleAttestation.eventId
            )
              throw Error('Incorrect Oracle Attestation. Event Id must match.');
            break;
          }
          case ContractDescriptorType.NumericOutcome: {
            const oracleInfo = contractInfo.oracleInfo;
            if (oracleInfo.type !== MessageType.SingleOracleInfo) {
              throw Error('Only SingleOracleInfo supported in this context');
            }
            const singleOracleInfo = oracleInfo as SingleOracleInfo;
            if (
              singleOracleInfo.announcement.oracleEvent.eventId !==
              oracleAttestation.eventId
            )
              throw Error('Incorrect Oracle Attestation. Event Id must match.');
            break;
          }
          default:
            throw Error('ConractDescriptor must be V0 or V1');
        }
        break;
      }
      case ContractInfoType.Disjoint: {
        const contractInfo = dlcOffer.contractInfo as DisjointContractInfo;
        const attestedOracleEvent = contractInfo.contractOraclePairs.find(
          ({ oracleInfo }) => {
            if (oracleInfo.type !== MessageType.SingleOracleInfo) return false;
            const singleOracleInfo = oracleInfo as SingleOracleInfo;
            return (
              singleOracleInfo.announcement.oracleEvent.eventId ===
              oracleAttestation.eventId
            );
          },
        );

        if (!attestedOracleEvent)
          throw Error('Oracle event of attestation not found.');

        break;
      }
      default:
        throw Error('ContractInfo must be V0 or V1');
    }
  }

  async FindAndSignCet(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    oracleAttestation: OracleAttestation,
    isOfferer?: boolean,
  ): Promise<Tx> {
    if (isOfferer === undefined)
      isOfferer = await this.isOfferer(dlcOffer, dlcAccept);

    const fundPrivateKey = await this.GetFundPrivateKey(
      dlcOffer,
      dlcAccept,
      isOfferer,
    );

    let signCetRequest: SignCetRequest;

    if (
      dlcOffer.contractInfo.contractInfoType === ContractInfoType.Single &&
      (dlcOffer.contractInfo as SingleContractInfo).contractDescriptor
        .contractDescriptorType === ContractDescriptorType.Enumerated
    ) {
      const outcomeIndex = (
        (dlcOffer.contractInfo as SingleContractInfo)
          .contractDescriptor as EnumeratedDescriptor
      ).outcomes.findIndex(
        (outcome) =>
          outcome.outcome ===
          sha256(Buffer.from(oracleAttestation.outcomes[0])).toString('hex'),
      );

      signCetRequest = {
        cetHex: dlcTxs.cets[outcomeIndex].serialize().toString('hex'),
        fundPrivkey: fundPrivateKey,
        fundTxId: dlcTxs.fundTx.txId.toString(),
        fundVout: dlcTxs.fundTxVout,
        localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
        remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
        oracleSignatures: oracleAttestation.signatures.map((sig) =>
          sig.toString('hex'),
        ),
        fundInputAmount: dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
        adaptorSignature: isOfferer
          ? dlcAccept.cetAdaptorSignatures.sigs[
              outcomeIndex
            ].encryptedSig.toString('hex')
          : dlcSign.cetAdaptorSignatures.sigs[
              outcomeIndex
            ].encryptedSig.toString('hex'),
      };
    } else {
      const { index: outcomeIndex, groupLength } = await this.FindOutcomeIndex(
        dlcOffer,
        oracleAttestation,
      );

      const sliceIndex = -(oracleAttestation.signatures.length - groupLength);

      const oracleSignatures =
        sliceIndex === 0
          ? oracleAttestation.signatures
          : oracleAttestation.signatures.slice(0, sliceIndex);

      signCetRequest = {
        cetHex: dlcTxs.cets[outcomeIndex].serialize().toString('hex'),
        fundPrivkey: fundPrivateKey,
        fundTxId: dlcTxs.fundTx.txId.toString(),
        fundVout: dlcTxs.fundTxVout,
        localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
        remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
        oracleSignatures: oracleSignatures.map((sig) => sig.toString('hex')),
        fundInputAmount: dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
        adaptorSignature: isOfferer
          ? dlcAccept.cetAdaptorSignatures.sigs[
              outcomeIndex
            ].encryptedSig.toString('hex')
          : dlcSign.cetAdaptorSignatures.sigs[
              outcomeIndex
            ].encryptedSig.toString('hex'),
      };
    }

    const finalCet = (await this.SignCet(signCetRequest)).hex;

    return Tx.decode(StreamReader.fromHex(finalCet));
  }

  private async GetFundAddress(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    isOfferer: boolean,
  ): Promise<string> {
    const network = await this.getConnectedNetwork();

    const fundingSPK = Script.p2wpkhLock(
      hash160(isOfferer ? dlcOffer.fundingPubkey : dlcAccept.fundingPubkey),
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
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    isOfferer: boolean,
  ): Promise<ECPairInterface> {
    const fundingAddress = await this.GetFundAddress(
      dlcOffer,
      dlcAccept,
      isOfferer,
    );

    const { derivationPath } =
      await this.getMethod('getWalletAddress')(fundingAddress);
    const keyPair: ECPairInterface =
      await this.getMethod('keyPair')(derivationPath);

    return keyPair;
  }

  private async GetFundPrivateKey(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
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
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTxs: DlcTransactions,
    closeInputAmount: bigint,
    isOfferer: boolean,
    _dlcCloses: DlcClose[] = [],
    fundingInputs?: FundingInput[],
    initiatorPayouts?: bigint[],
  ): Promise<string[]> {
    const network = await this.getConnectedNetwork();

    let finalizer: DualClosingTxFinalizer;
    if (_dlcCloses.length === 0) {
      finalizer = new DualClosingTxFinalizer(
        fundingInputs,
        dlcOffer.payoutSpk,
        dlcAccept.payoutSpk,
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
          address: address.fromOutputScript(dlcOffer.payoutSpk, network),
          amount: Number(offerPayoutValue),
        });
      }

      if (Number(acceptPayoutValue) > 0) {
        txOuts.push({
          address: address.fromOutputScript(dlcAccept.payoutSpk, network),
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
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
        ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
        : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

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
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
        ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
        : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: fundingPubKeys,
      network,
    });

    const paymentVariant = payments.p2wsh({
      redeem: p2ms,
      network,
    });

    const pubkey = isOfferer ? dlcAccept.fundingPubkey : dlcOffer.fundingPubkey;

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

    const offerFundingSPK = Script.p2wpkhLock(hash160(dlcOffer.fundingPubkey))
      .serialize()
      .slice(1);
    const acceptFundingSPK = Script.p2wpkhLock(hash160(dlcAccept.fundingPubkey))
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
   * @param offerCollateralSatoshis Amount DLC Initiator is putting into the contract
   * @param feeRatePerVb Fee rate in satoshi per virtual byte that both sides use to compute fees in funding tx
   * @param cetLocktime The nLockTime to be put on CETs
   * @param refundLocktime The nLockTime to be put on the refund transaction
   * @returns {Promise<DlcOffer>}
   */
  async createDlcOffer(
    contractInfo: ContractInfo,
    offerCollateralSatoshis: bigint,
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktime: number,
    fixedInputs?: Input[],
  ): Promise<DlcOffer> {
    contractInfo.validate();
    const network = await this.getConnectedNetwork();

    const dlcOffer = new DlcOffer();

    // Generate a random 32-byte temporary contract ID
    dlcOffer.temporaryContractId = crypto.randomBytes(32);

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

    _fundingInputs.forEach((input) =>
      assert(
        input.type === MessageType.FundingInput,
        'FundingInput must be V0',
      ),
    );

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

    dlcOffer.contractFlags = Buffer.from('00', 'hex');
    dlcOffer.chainHash = chainHashFromNetwork(network);
    dlcOffer.contractInfo = contractInfo;
    dlcOffer.fundingPubkey = fundingPubKey;
    dlcOffer.payoutSpk = payoutSPK;
    dlcOffer.payoutSerialId = payoutSerialId;
    dlcOffer.offerCollateral = offerCollateralSatoshis;
    dlcOffer.fundingInputs = fundingInputs;
    dlcOffer.changeSpk = changeSPK;
    dlcOffer.changeSerialId = changeSerialId;
    dlcOffer.fundOutputSerialId = dlcOffer.fundOutputSerialId =
      fundOutputSerialId;
    dlcOffer.feeRatePerVb = feeRatePerVb;
    dlcOffer.cetLocktime = cetLocktime;
    dlcOffer.refundLocktime = refundLocktime;

    assert(
      (() => {
        const finalizer = new DualFundingTxFinalizer(
          dlcOffer.fundingInputs,
          dlcOffer.payoutSpk,
          dlcOffer.changeSpk,
          null,
          null,
          null,
          dlcOffer.feeRatePerVb,
        );
        const funding = fundingInputs.reduce((total, input) => {
          return total + input.prevTx.outputs[input.prevTxVout].value.sats;
        }, BigInt(0));

        return funding >= offerCollateralSatoshis + finalizer.offerFees;
      })(),
      'fundingInputs for dlcOffer must be greater than offerCollateralSatoshis plus offerFees',
    );

    dlcOffer.validate();

    return dlcOffer;
  }

  async batchCreateDlcOffer(
    contractInfos: ContractInfo[],
    offerCollaterals: bigint[],
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktimes: number[],
    fixedInputs?: Input[],
  ): Promise<DlcOffer[]> {
    if (
      contractInfos.length !== offerCollaterals.length ||
      contractInfos.length !== refundLocktimes.length
    ) {
      throw new Error(
        'The number of contractInfos, offerCollateralSatoshis, and refundLocktimes must be the same',
      );
    }

    const dlcOffers: DlcOffer[] = [];

    for (let i = 0; i < contractInfos.length; i++) {
      contractInfos[i].validate();
    }

    const network = await this.getConnectedNetwork();

    const {
      fundingInputs: _fundingInputs,
      changeSPK,
      changeSerialId,
      initializeResponses,
    } = await this.BatchInitialize(offerCollaterals, feeRatePerVb, fixedInputs);

    _fundingInputs.forEach((input) =>
      assert(
        input.type === MessageType.FundingInput,
        'FundingInput must be V0',
      ),
    );

    const fundingInputs: FundingInput[] = _fundingInputs.map(
      (input) => input as FundingInput,
    );

    fundingInputs.sort(
      (a, b) => Number(a.inputSerialId) - Number(b.inputSerialId),
    );

    const fundOutputsSerialIds = generateSerialIds(contractInfos.length);

    for (let i = 0; i < contractInfos.length; i++) {
      const contractInfo = contractInfos[i];
      const offerCollateralSatoshis = offerCollaterals[i];
      const fundOutputSerialId = fundOutputsSerialIds[i];
      const { fundingPubKey, payoutSPK, payoutSerialId } =
        initializeResponses[i];
      const refundLocktime = refundLocktimes[i];

      const dlcOffer = new DlcOffer();

      // Generate a random 32-byte temporary contract ID
      dlcOffer.temporaryContractId = crypto.randomBytes(32);

      dlcOffer.contractFlags = Buffer.from('00', 'hex');
      dlcOffer.chainHash = chainHashFromNetwork(network);
      dlcOffer.contractInfo = contractInfo;
      dlcOffer.fundingPubkey = fundingPubKey;
      dlcOffer.payoutSpk = payoutSPK;
      dlcOffer.payoutSerialId = payoutSerialId;
      dlcOffer.offerCollateral = offerCollateralSatoshis;
      dlcOffer.fundingInputs = fundingInputs;
      dlcOffer.changeSpk = changeSPK;
      dlcOffer.changeSerialId = changeSerialId;
      dlcOffer.fundOutputSerialId = fundOutputSerialId;
      dlcOffer.feeRatePerVb = feeRatePerVb;
      dlcOffer.cetLocktime = cetLocktime;
      dlcOffer.refundLocktime = refundLocktime;

      assert(
        (() => {
          const finalizer = new DualFundingTxFinalizer(
            dlcOffer.fundingInputs,
            dlcOffer.payoutSpk,
            dlcOffer.changeSpk,
            null,
            null,
            null,
            dlcOffer.feeRatePerVb,
          );
          const funding = fundingInputs.reduce((total, input) => {
            return total + input.prevTx.outputs[input.prevTxVout].value.sats;
          }, BigInt(0));

          return funding >= offerCollateralSatoshis + finalizer.offerFees;
        })(),
        'fundingInputs for dlcOffer must be greater than offerCollateralSatoshis plus offerFees',
      );

      dlcOffer.validate();

      dlcOffers.push(dlcOffer);
    }

    return dlcOffers;
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

    const acceptCollateralSatoshis =
      dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateral;

    assert(
      acceptCollateralSatoshis ===
        dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateral,
      'acceptCollaterialSatoshis should equal totalCollateral - offerCollateralSatoshis',
    );

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

    assert(
      Buffer.compare(dlcOffer.fundingPubkey, fundingPubKey) !== 0,
      'DlcOffer and DlcAccept FundingPubKey cannot be the same',
    );

    _fundingInputs.forEach((input) =>
      assert(
        input.type === MessageType.FundingInput,
        'FundingInput must be V0',
      ),
    );

    const fundingInputs: FundingInput[] = _fundingInputs.map(
      (input) => input as FundingInput,
    );

    fundingInputs.sort(
      (a, b) => Number(a.inputSerialId) - Number(b.inputSerialId),
    );

    const dlcAccept = new DlcAccept();

    dlcAccept.temporaryContractId = sha256(dlcOffer.serialize());
    dlcAccept.acceptCollateral = acceptCollateralSatoshis;
    dlcAccept.fundingPubkey = fundingPubKey;
    dlcAccept.payoutSpk = payoutSPK;
    dlcAccept.payoutSerialId = dlcAccept.payoutSerialId = payoutSerialId;
    dlcAccept.fundingInputs = fundingInputs;
    dlcAccept.changeSpk = changeSPK;
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
          dlcOffer.payoutSpk,
          dlcOffer.changeSpk,
          dlcAccept.fundingInputs,
          dlcAccept.payoutSpk,
          dlcAccept.changeSpk,
          dlcOffer.feeRatePerVb,
        );
        const funding = fundingInputs.reduce((total, input) => {
          return total + input.prevTx.outputs[input.prevTxVout].value.sats;
        }, BigInt(0));

        return funding >= acceptCollateralSatoshis + finalizer.acceptFees;
      })(),
      'fundingInputs for dlcAccept must be greater than acceptCollateralSatoshis plus acceptFees',
    );

    const { dlcTransactions, messagesList } = await this.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    const { cetSignatures, refundSignature } =
      await this.CreateCetAdaptorAndRefundSigs(
        dlcOffer,
        dlcAccept,
        dlcTransactions,
        messagesList,
        false,
      );

    const _dlcTransactions = dlcTransactions;

    const contractId = xor(
      _dlcTransactions.fundTx.txId.serialize(),
      dlcAccept.temporaryContractId,
    );
    _dlcTransactions.contractId = contractId;

    dlcAccept.cetAdaptorSignatures = cetSignatures;
    dlcAccept.refundSignature = refundSignature;

    return { dlcAccept, dlcTransactions: _dlcTransactions };
  }

  async batchAcceptDlcOffer(
    _dlcOffers: DlcOffer[],
    fixedInputs?: Input[],
  ): Promise<BatchAcceptDlcOfferResponse> {
    const dlcOffers = _dlcOffers.map((_dlcOffer) => {
      const { dlcOffer } = checkTypes({ _dlcOffer });
      dlcOffer.validate();
      return dlcOffer;
    });

    const acceptCollaterals = dlcOffers.map(
      (dlcOffer) =>
        dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateral,
    );

    const {
      fundingInputs: _fundingInputs,
      changeSPK,
      changeSerialId,
      initializeResponses,
    } = await this.BatchInitialize(
      acceptCollaterals,
      dlcOffers[0].feeRatePerVb,
      fixedInputs,
    );

    // Check that none of the funding pubkeys are the same between the
    // dlcOffers and the dlcAccepts (from initializeResponses)
    dlcOffers.forEach((dlcOffer) => {
      initializeResponses.forEach((initializeResponse) => {
        assert(
          Buffer.compare(
            dlcOffer.fundingPubkey,
            initializeResponse.fundingPubKey,
          ) !== 0,
          'DlcOffer and DlcAccept FundingPubKey cannot be the same',
        );
      });
    });

    _fundingInputs.forEach((input) =>
      assert(
        input.type === MessageType.FundingInput,
        'FundingInput must be V0',
      ),
    );

    const fundingInputs: FundingInput[] = _fundingInputs.map(
      (input) => input as FundingInput,
    );

    fundingInputs.sort(
      (a, b) => Number(a.inputSerialId) - Number(b.inputSerialId),
    );

    const dlcAccepts: DlcAccept[] = [];

    initializeResponses.forEach((initializeResponse, i) => {
      const dlcOffer = dlcOffers[i];
      const dlcAccept = new DlcAccept();

      const { fundingPubKey, payoutSPK, payoutSerialId } = initializeResponse;

      dlcAccept.temporaryContractId = sha256(dlcOffers[i].serialize());
      dlcAccept.acceptCollateral = acceptCollaterals[i];
      dlcAccept.fundingPubkey = fundingPubKey;
      dlcAccept.payoutSpk = payoutSPK;
      dlcAccept.payoutSerialId = payoutSerialId;
      dlcAccept.fundingInputs = fundingInputs;
      dlcAccept.changeSpk = changeSPK;
      dlcAccept.changeSerialId = changeSerialId;

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
            dlcOffer.payoutSpk,
            dlcOffer.changeSpk,
            dlcAccept.fundingInputs,
            dlcAccept.payoutSpk,
            dlcAccept.changeSpk,
            dlcOffer.feeRatePerVb,
          );
          const funding = fundingInputs.reduce((total, input) => {
            return total + input.prevTx.outputs[input.prevTxVout].value.sats;
          }, BigInt(0));

          return funding >= acceptCollaterals[i] + finalizer.acceptFees;
        })(),
        'fundingInputs for dlcAccept must be greater than acceptCollateralSatoshis plus acceptFees',
      );

      dlcAccepts.push(dlcAccept);
    });

    const { dlcTransactionsList, nestedMessagesList } =
      await this.createBatchDlcTxs(dlcOffers, dlcAccepts);

    for (let i = 0; i < dlcAccepts.length; i++) {
      const dlcOffer = dlcOffers[i];
      const dlcAccept = dlcAccepts[i];
      const dlcTransactions = dlcTransactionsList[i];
      const messagesList = nestedMessagesList[i];

      const { cetSignatures, refundSignature } =
        await this.CreateCetAdaptorAndRefundSigs(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          messagesList,
          false,
        );

      const _dlcTransactions = dlcTransactions;

      const contractId = xor(
        _dlcTransactions.fundTx.txId.serialize(),
        dlcAccept.temporaryContractId,
      );
      _dlcTransactions.contractId = contractId;

      dlcAccepts[i].cetAdaptorSignatures = cetSignatures;
      dlcAccepts[i].refundSignature = refundSignature;
    }

    return { dlcAccepts, dlcTransactionsList };
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
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) !== 0,
      'DlcOffer and DlcAccept FundingPubKey cannot be the same',
    );

    const dlcSign = new DlcSign();

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

    const { cetSignatures, refundSignature } =
      await this.CreateCetAdaptorAndRefundSigs(
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

    const dlcTxs = dlcTransactions;

    const contractId = xor(
      dlcTxs.fundTx.txId.serialize(),
      dlcAccept.temporaryContractId,
    );

    assert(
      Buffer.compare(
        contractId,
        xor(dlcTxs.fundTx.txId.serialize(), dlcAccept.temporaryContractId),
      ) === 0,
      'contractId must be the xor of funding txid, fundingOutputIndex and the tempContractId',
    );

    dlcTxs.contractId = contractId;

    dlcSign.contractId = contractId;
    dlcSign.cetAdaptorSignatures = cetSignatures;
    dlcSign.refundSignature = refundSignature;
    dlcSign.fundingSignatures = fundingSignatures;

    return { dlcSign, dlcTransactions: dlcTxs };
  }

  async batchSignDlcAccept(
    _dlcOffers: DlcOffer[],
    _dlcAccepts: DlcAccept[],
  ): Promise<BatchSignDlcAcceptResponse> {
    const dlcOffers = _dlcOffers.map((_dlcOffer) => {
      const { dlcOffer } = checkTypes({ _dlcOffer });
      dlcOffer.validate();
      return dlcOffer;
    });

    const dlcAccepts = _dlcAccepts.map((_dlcAccept) => {
      const { dlcAccept } = checkTypes({ _dlcAccept });
      dlcAccept.validate();
      return dlcAccept;
    });

    const { dlcTransactionsList, nestedMessagesList } =
      await this.createBatchDlcTxs(dlcOffers, dlcAccepts);

    const dlcSigns: DlcSign[] = [];

    const fundingSignatures = await this.CreateFundingSigs(
      dlcOffers[0],
      dlcAccepts[0],
      dlcTransactionsList[0],
      true,
    );

    for (let i = 0; i < dlcAccepts.length; i++) {
      const dlcOffer = dlcOffers[i];
      const dlcAccept = dlcAccepts[i];
      const dlcTransactions = dlcTransactionsList[i];
      const messagesList = nestedMessagesList[i];

      const dlcSign = new DlcSign();

      await this.VerifyCetAdaptorAndRefundSigs(
        dlcOffer,
        dlcAccept,
        dlcSign,
        dlcTransactions,
        messagesList,
        true,
      );

      const { cetSignatures, refundSignature } =
        await this.CreateCetAdaptorAndRefundSigs(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          messagesList,
          true,
        );

      const dlcTxs = dlcTransactions;

      const contractId = xor(
        dlcTxs.fundTx.txId.serialize(),
        dlcAccept.temporaryContractId,
      );

      dlcTxs.contractId = contractId;

      dlcSign.contractId = contractId;
      dlcSign.cetAdaptorSignatures = cetSignatures;
      dlcSign.refundSignature = refundSignature;
      dlcSign.fundingSignatures = fundingSignatures;

      dlcSigns.push(dlcSign);
    }

    return { dlcSigns, dlcTransactionsList };
  }

  /**
   * Finalize Dlc Sign
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @param dlcSign Dlc Sign Message
   * @param dlcTxs Dlc Transactions Message
   * @returns {Promise<Tx>}
   */
  async finalizeDlcSign(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
  ): Promise<Tx> {
    let messagesList: Messages[] = [];

    if (
      dlcOffer.contractInfo.type === MessageType.SingleContractInfo &&
      (dlcOffer.contractInfo as SingleContractInfo).contractDescriptor.type ===
        MessageType.SingleContractInfo
    ) {
      for (const outcome of (
        (dlcOffer.contractInfo as SingleContractInfo)
          .contractDescriptor as EnumeratedDescriptor
      ).outcomes) {
        messagesList.push({ messages: [outcome.outcome] });
      }
    } else {
      const payoutResponses = this.GetPayouts(dlcOffer);
      const { messagesList: oracleEventMessagesList } =
        this.FlattenPayouts(payoutResponses);
      messagesList = oracleEventMessagesList;
    }

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

  async batchFinalizeDlcSign(
    _dlcOffers: DlcOffer[],
    _dlcAccepts: DlcAccept[],
    _dlcSigns: DlcSign[],
    _dlcTxsList: DlcTransactions[],
  ): Promise<Tx> {
    const dlcOffers = _dlcOffers.map((_dlcOffer) => {
      const { dlcOffer } = checkTypes({ _dlcOffer });
      dlcOffer.validate();
      return dlcOffer;
    });

    const dlcAccepts = _dlcAccepts.map((_dlcAccept) => {
      const { dlcAccept } = checkTypes({ _dlcAccept });
      dlcAccept.validate();
      return dlcAccept;
    });

    const dlcSigns = _dlcSigns.map((_dlcSign) => {
      const { dlcSign } = checkTypes({ _dlcSign });
      return dlcSign;
    });

    const dlcTxsList = _dlcTxsList.map((_dlcTxs) => {
      const { dlcTxs } = checkTypes({ _dlcTxs });
      return dlcTxs;
    });

    await this.VerifyFundingSigs(
      dlcOffers[0],
      dlcAccepts[0],
      dlcSigns[0],
      dlcTxsList[0],
      false,
    );

    for (let i = 0; i < dlcOffers.length; i++) {
      const dlcOffer = dlcOffers[i];
      const dlcAccept = dlcAccepts[i];
      const dlcSign = dlcSigns[i];
      const dlcTxs = dlcTxsList[i];

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
    }

    const fundingSignatures = await this.CreateFundingSigs(
      dlcOffers[0],
      dlcAccepts[0],
      dlcTxsList[0],
      false,
    );

    const fundTx = await this.CreateFundingTx(
      dlcOffers[0],
      dlcAccepts[0],
      dlcSigns[0],
      dlcTxsList[0],
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
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    oracleAttestation: OracleAttestation,
    isOfferer?: boolean,
  ): Promise<Tx> {
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
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
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
      localFundPubkey: dlcOffer.fundingPubkey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubkey.toString('hex'),
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
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
        ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
        : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

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
        [BigInt(20000)],
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
    sortedPsbtInputs.forEach((input) => psbt.addInput(input));

    const fundingInputs: FundingInput[] = await Promise.all(
      inputs.map(async (input) => {
        return this.inputToFundingInput(input);
      }),
    );

    const finalizer = new DualClosingTxFinalizer(
      fundingInputs,
      dlcOffer.payoutSpk,
      dlcAccept.payoutSpk,
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
        offerFirst ? dlcOffer.payoutSpk : dlcAccept.payoutSpk,
        network,
      ),
    });

    psbt.addOutput({
      value: Number(offerFirst ? acceptPayoutValue : offerPayoutValue),
      address: address.fromOutputScript(
        offerFirst ? dlcAccept.payoutSpk : dlcOffer.payoutSpk,
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
    psbt.validateSignaturesOfAllInputs(
      (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
        return ecc.verify(msghash, pubkey, signature);
      },
    );

    // Extract close signature from psbt and decode it to only extract r and s values
    const closeSignature = await script.signature.decode(
      psbt.data.inputs[fundingInputIndex].partialSig[0].signature,
    ).signature;

    // Extract funding signatures from psbt
    const inputSigs = psbt.data.inputs
      .filter((input) => input !== fundingInputIndex)
      .map((input) => input.partialSig[0]);

    // create fundingSignatures
    const witnessElements: ScriptWitnessV0[][] = [];
    for (let i = 0; i < inputSigs.length; i++) {
      const sigWitness = new ScriptWitnessV0();
      sigWitness.witness = inputSigs[i].signature;
      const pubKeyWitness = new ScriptWitnessV0();
      pubKeyWitness.witness = inputSigs[i].pubkey;
      witnessElements.push([sigWitness, pubKeyWitness]);
    }
    const fundingSignatures = new FundingSignatures();
    fundingSignatures.witnessElements = witnessElements;

    // Create DlcClose
    const dlcClose = new DlcClose();
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
      dlcOffer.payoutSpk,
      dlcAccept.payoutSpk,
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

      const dlcClose = new DlcClose();
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
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
        ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
        : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

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
    dlcClose.fundingInputs.forEach((input) => {
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
        offerFirst ? dlcOffer.payoutSpk : dlcAccept.payoutSpk,
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
        offerFirst ? dlcAccept.payoutSpk : dlcOffer.payoutSpk,
        network,
      ),
    });

    // add to psbt
    sortedPsbtInputs.forEach((input) => psbt.addInput(input));

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
        pubkey: offerer ? dlcAccept.fundingPubkey : dlcOffer.fundingPubkey,
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

    psbt.validateSignaturesOfAllInputs(
      (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
        return ecc.verify(msghash, pubkey, signature);
      },
    );
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

  async CreateBatchDlcTransactions(
    jsonObject: CreateBatchDlcTransactionsRequest,
  ): Promise<CreateBatchDlcTransactionsResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateBatchDlcTransactions(jsonObject);
  }

  async CreateFundTransaction(
    jsonObject: CreateFundTransactionRequest,
  ): Promise<CreateFundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateFundTransaction(jsonObject);
  }

  async CreateBatchFundTransaction(
    jsonObject: CreateBatchFundTransactionRequest,
  ): Promise<CreateBatchFundTransactionResponse> {
    await this.CfdLoaded();

    return this._cfdDlcJs.CreateBatchFundTransaction(jsonObject);
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
    assert(_input.type === MessageType.FundingInput, 'FundingInput must be V0');
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

export interface BasicInitializeResponse {
  fundingPubKey: Buffer;
  payoutSPK: Buffer;
  payoutSerialId: bigint;
  changeSPK: Buffer;
  changeSerialId: bigint;
}

export interface InitializeResponse extends BasicInitializeResponse {
  fundingInputs: FundingInput[];
}

export interface BatchBaseInitializeResponse {
  fundingPubKey: Buffer;
  payoutSPK: Buffer;
  payoutSerialId: bigint;
}

export interface BatchInitializeResponse {
  initializeResponses: BatchBaseInitializeResponse[];
  fundingInputs: FundingInput[];
  changeSPK: Buffer;
  changeSerialId: bigint;
}

export interface AcceptDlcOfferResponse {
  dlcAccept: DlcAccept;
  dlcTransactions: DlcTransactions;
}

export interface BatchAcceptDlcOfferResponse {
  dlcAccepts: DlcAccept[];
  dlcTransactionsList: DlcTransactions[];
}

export interface SignDlcAcceptResponse {
  dlcSign: DlcSign;
  dlcTransactions: DlcTransactions;
}

export interface BatchSignDlcAcceptResponse {
  dlcSigns: DlcSign[];
  dlcTransactionsList: DlcTransactions[];
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

export interface CreateBatchDlcTxsResponse {
  dlcTransactionsList: DlcTransactions[];
  nestedMessagesList: Messages[][];
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

export interface InputsForDualAmountResponse {
  inputs: Input[];
  fee: number;
}
