import { chainHashFromNetwork } from '@atomicfinance/bitcoin-networks';
import Provider from '@atomicfinance/provider';
import {
  AdaptorPair,
  AddSignaturesToRefundTxRequest,
  AddSignaturesToRefundTxResponse,
  AddSignatureToFundTransactionRequest,
  AddSignatureToFundTransactionResponse,
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
  CreateRefundTransactionRequest,
  CreateRefundTransactionResponse,
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
} from '@atomicfinance/types';
import { BitcoinNetwork } from '@liquality/bitcoin-networks';
import { Address, bitcoin } from '@liquality/types';
import { sleep } from '@liquality/utils';
import {
  CoveredCall,
  DualClosingTxFinalizer,
  DualFundingTxFinalizer,
  groupByIgnoringDigits,
  HyperbolaPayoutCurve,
  roundPayout,
} from '@node-dlc/core';
import {
  CetAdaptorSignaturesV0,
  ContractDescriptor,
  ContractDescriptorV1,
  ContractInfo,
  ContractInfoV0,
  ContractInfoV1,
  DigitDecompositionEventDescriptorV0,
  DlcAccept,
  DlcAcceptV0,
  DlcOffer,
  DlcOfferV0,
  DlcSign,
  DlcSignV0,
  DlcTransactions,
  DlcTransactionsV0,
  FundingInput,
  FundingInputV0,
  FundingSignaturesV0,
  HyperbolaPayoutCurvePiece,
  MessageType,
  NegotiationFieldsV0,
  OracleAttestationV0,
  OracleEventV0,
  OracleInfoV0,
  PayoutFunctionV0,
  ScriptWitnessV0,
} from '@node-dlc/messaging';
import { Script, Sequence, Tx } from '@node-lightning/bitcoin';
import { StreamReader } from '@node-lightning/bufio';
import { hash160, sha256, xor } from '@node-lightning/crypto';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { address, ECPairInterface, payments, Psbt } from 'bitcoinjs-lib';
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
      const keyPair = await this.getMethod('keyPair')(input.derivationPath);
      const privKey = Buffer.from(keyPair.__D).toString('hex');
      privKeys.push(privKey);
    }

    return privKeys;
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
    contractDescriptor: ContractDescriptorV1,
    oracleInfo: OracleInfoV0,
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
    const payoutCurvePiece = payoutFunction.pieces[0]
      .payoutCurvePiece as HyperbolaPayoutCurvePiece;
    if (payoutCurvePiece.type !== MessageType.HyperbolaPayoutCurvePiece)
      throw Error('Must be HyperbolaPayoutCurvePiece');
    if (payoutCurvePiece.b !== BigInt(0) || payoutCurvePiece.c !== BigInt(0))
      throw Error('b and c HyperbolaPayoutCurvePiece values must be 0');
    const eventDescriptor = oracleInfo.announcement.oracleEvent
      .eventDescriptor as DigitDecompositionEventDescriptorV0;
    if (
      eventDescriptor.type !== MessageType.DigitDecompositionEventDescriptorV0
    )
      throw Error('Only DigitDecomposition Oracle Events supported');

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
      dlcOffer.offerCollateralSatoshis,
      dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateralSatoshis,
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
    oracleInfo: OracleInfoV0,
    totalCollateral: bigint,
  ) {
    switch (contractDescriptor.type) {
      case MessageType.ContractDescriptorV0:
        throw Error('ContractDescriptorV0 not yet supported');
      case MessageType.ContractDescriptorV1:
        // eslint-disable-next-line no-case-declarations
        return this.GetPayoutsFromPayoutFunction(
          dlcOffer,
          contractDescriptor as ContractDescriptorV1,
          oracleInfo,
          totalCollateral,
        );
      default:
        throw Error('ContractDescriptor must be V0 or V1');
    }
  }

  private async CreateDlcTxs(
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
      localCollateralAmount: dlcOffer.offerCollateralSatoshis,
      remoteInputAmount,
      remoteCollateralAmount: dlcAccept.acceptCollateralSatoshis,
      refundLocktime: dlcOffer.refundLocktime,
      localInputs,
      remoteInputs,
      localChangeScriptPubkey,
      remoteChangeScriptPubkey,
      feeRate: Number(dlcOffer.feeRatePerVb),
      cetLockTime: dlcOffer.cetLocktime,
    };

    const dlcTxs = await this.CreateDlcTransactions(dlcTxRequest);

    const dlcTransactions = new DlcTransactionsV0();
    dlcTransactions.fundTx = Tx.decode(StreamReader.fromHex(dlcTxs.fundTxHex));
    dlcTransactions.fundTxVout = 0;
    dlcTransactions.refundTx = Tx.decode(
      StreamReader.fromHex(dlcTxs.refundTxHex),
    );
    dlcTransactions.cets = dlcTxs.cetsHex.map((cetHex) => {
      return Tx.decode(StreamReader.fromHex(cetHex));
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

  private GenerateMessages(oracleInfo: OracleInfoV0): Messages[] {
    const oracleEvent = oracleInfo.announcement.oracleEvent;

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
  ): { contractDescriptor: ContractDescriptor; oracleInfo: OracleInfoV0 }[] {
    switch (_contractInfo.type) {
      case MessageType.ContractInfoV0: {
        const contractInfo = _contractInfo as ContractInfoV0;
        return [
          {
            contractDescriptor: contractInfo.contractDescriptor,
            oracleInfo: contractInfo.oracleInfo,
          },
        ];
      }
      case MessageType.ContractInfoV1: {
        return (_contractInfo as ContractInfoV1).contractOraclePairs;
      }
      default:
        throw Error('ContractInfo must be V0 or V1');
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

    const { derivationPath } = await this.getMethod('findAddress')([
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
      const oracleAnnouncement = oracleInfo.announcement;

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
      localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
      fundInputAmount: dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats,
    };

    const refundSignature = Buffer.from(
      (await this.GetRawRefundTxSignature(refundSignRequest)).hex,
      'hex',
    );

    const cetSignatures = new CetAdaptorSignaturesV0();
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
      const oracleAnnouncement = oracleInfo.announcement;

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
  ): Promise<FundingSignaturesV0> {
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

    const fundingSignatures = new FundingSignaturesV0();
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

    const fundTx = Tx.decode(StreamReader.fromHex(fundTxHex));

    return fundTx;
  }

  async FindOutcomeIndexFromHyperbolaPayoutCurvePiece(
    _dlcOffer: DlcOffer,
    contractDescriptor: ContractDescriptorV1,
    contractOraclePairIndex: number,
    hyperbolaPayoutCurvePiece: HyperbolaPayoutCurvePiece,
    oracleAttestation: OracleAttestationV0,
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
    oracleAttestation: OracleAttestationV0,
  ): Promise<FindOutcomeResponse> {
    const { dlcOffer } = checkTypes({ _dlcOffer });

    const contractOraclePairs = this.GetContractOraclePairs(
      dlcOffer.contractInfo,
    );

    const contractOraclePairIndex = contractOraclePairs.findIndex(
      ({ oracleInfo }) =>
        oracleInfo.announcement.oracleEvent.eventId ===
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
      _contractDescriptor.type === MessageType.ContractDescriptorV1,
      'ContractDescriptor must be V1',
    );

    const contractDescriptor = _contractDescriptor as ContractDescriptorV1;
    const _payoutFunction = contractDescriptor.payoutFunction;

    assert(
      _payoutFunction.type === MessageType.PayoutFunctionV0,
      'PayoutFunction must be V0',
    );

    const eventDescriptor = oracleInfo.announcement.oracleEvent
      .eventDescriptor as DigitDecompositionEventDescriptorV0;
    const payoutFunction = _payoutFunction as PayoutFunctionV0;

    const base = eventDescriptor.base;

    const outcome: number = [...oracleAttestation.outcomes]
      .reverse()
      .reduce((acc, val, i) => acc + Number(val) * base ** i, 0);

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
    oracleAttestation: OracleAttestationV0,
  ): void {
    const { dlcOffer } = checkTypes({
      _dlcOffer,
    });

    switch (dlcOffer.contractInfo.type) {
      case MessageType.ContractInfoV0: {
        const contractInfo = dlcOffer.contractInfo as ContractInfoV0;
        switch (contractInfo.contractDescriptor.type) {
          case MessageType.ContractDescriptorV0:
            throw Error('ContractDescriptorV0 not yet supported');
          case MessageType.ContractDescriptorV1: {
            const oracleInfo = contractInfo.oracleInfo;
            if (
              oracleInfo.announcement.oracleEvent.eventId !==
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
      case MessageType.ContractInfoV1: {
        const contractInfo = dlcOffer.contractInfo as ContractInfoV1;
        const attestedOracleEvent = contractInfo.contractOraclePairs.find(
          ({ oracleInfo }) => {
            oracleInfo.announcement.oracleEvent.eventId ===
              oracleAttestation.eventId;
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
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcSign: DlcSign,
    _dlcTxs: DlcTransactions,
    oracleAttestation: OracleAttestationV0,
    isOfferer: boolean,
  ): Promise<Tx> {
    const { dlcOffer, dlcAccept, dlcSign, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcSign,
      _dlcTxs,
    });

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

  async BuildCloseTx(
    dlcOffer: DlcOfferV0,
    dlcAccept: DlcAcceptV0,
    dlcTxs: DlcTransactionsV0,
    initiatorPayoutSatoshis: bigint,
    isOfferer: boolean,
    inputs?: Input[],
  ): Promise<Psbt> {
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

    psbt.addInput({
      hash: dlcTxs.fundTx.txId.serialize(),
      index: 0,
      sequence: 0,
      witnessUtxo: {
        script: paymentVariant.output,
        value: Number(dlcTxs.fundTx.outputs[dlcTxs.fundTxVout].value.sats),
      },
      witnessScript: paymentVariant.redeem.output,
    });

    const pubkeys: Buffer[] = await Promise.all(
      inputs.map(async (input) => {
        const address: Address = await this.getMethod('getWalletAddress')(
          input.address,
        );
        return Buffer.from(address.publicKey, 'hex');
      }),
    );

    inputs.forEach((input, i) => {
      const paymentVariant = payments.p2wpkh({ pubkey: pubkeys[i], network });

      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        sequence: 0,
        witnessUtxo: {
          script: paymentVariant.output,
          value: input.value,
        },
      });
    });

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

    psbt.addOutput({
      value: Number(offerPayoutValue),
      address: address.fromOutputScript(dlcOffer.payoutSPK, network),
    });

    psbt.addOutput({
      value: Number(acceptPayoutValue),
      address: address.fromOutputScript(dlcAccept.payoutSPK, network),
    });

    return psbt;
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

    let walletAddress: Address = await this.getMethod('findAddress')([
      offerFundingAddress,
    ]);
    if (walletAddress) return true;
    walletAddress = await this.getMethod('findAddress')([acceptFundingAddress]);
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

    _fundingInputs.forEach((input) =>
      assert(
        input.type === MessageType.FundingInputV0,
        'FundingInput must be V0',
      ),
    );

    const fundingInputs: FundingInputV0[] = _fundingInputs.map(
      (input) => input as FundingInputV0,
    );

    const fundOutputSerialId = generateSerialId();

    assert(
      changeSerialId !== fundOutputSerialId,
      'changeSerialId cannot equal the fundOutputSerialId',
    );

    dlcOffer.contractFlags = Buffer.from('00', 'hex');
    dlcOffer.chainHash = chainHashFromNetwork(network);
    dlcOffer.contractInfo = contractInfo;
    dlcOffer.fundingPubKey = fundingPubKey;
    dlcOffer.payoutSPK = payoutSPK;
    dlcOffer.payoutSerialId = payoutSerialId;
    dlcOffer.offerCollateralSatoshis = offerCollateralSatoshis;
    dlcOffer.fundingInputs = fundingInputs;
    dlcOffer.changeSPK = changeSPK;
    dlcOffer.changeSerialId = changeSerialId;
    dlcOffer.fundOutputSerialId = fundOutputSerialId;
    dlcOffer.feeRatePerVb = feeRatePerVb;
    dlcOffer.cetLocktime = cetLocktime;
    dlcOffer.refundLocktime = refundLocktime;

    assert(
      (() => {
        const finalizer = new DualFundingTxFinalizer(
          dlcOffer.fundingInputs,
          dlcOffer.payoutSPK,
          dlcOffer.changeSPK,
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
      dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateralSatoshis;

    assert(
      acceptCollateralSatoshis ===
        dlcOffer.contractInfo.totalCollateral -
          dlcOffer.offerCollateralSatoshis,
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
      Buffer.compare(dlcOffer.fundingPubKey, fundingPubKey) !== 0,
      'DlcOffer and DlcAccept FundingPubKey cannot be the same',
    );

    _fundingInputs.forEach((input) =>
      assert(
        input.type === MessageType.FundingInputV0,
        'FundingInput must be V0',
      ),
    );

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

        return funding >= acceptCollateralSatoshis + finalizer.acceptFees;
      })(),
      'fundingInputs for dlcAccept must be greater than acceptCollateralSatoshis plus acceptFees',
    );

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

    assert(
      dlcTransactions.type === MessageType.DlcTransactionsV0,
      'DlcTransactions must be V0',
    );
    const _dlcTransactions = dlcTransactions as DlcTransactionsV0;

    const contractId = xor(
      _dlcTransactions.fundTx.txId.serialize(),
      dlcAccept.tempContractId,
    );
    _dlcTransactions.contractId = contractId;

    dlcAccept.cetSignatures = cetSignatures;
    dlcAccept.refundSignature = refundSignature;
    dlcAccept.negotiationFields = new NegotiationFieldsV0();

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

    assert(
      Buffer.compare(
        contractId,
        xor(dlcTxs.fundTx.txId.serialize(), dlcAccept.tempContractId),
      ) === 0,
      'contractId must be the xor of funding txid, fundingOutputIndex and the tempContractId',
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
    oracleAttestation: OracleAttestationV0,
    isOfferer: boolean,
  ): Promise<Tx> {
    const { dlcOffer, dlcAccept, dlcSign, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcSign,
      _dlcTxs,
    });

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
      localFundPubkey: dlcOffer.fundingPubKey.toString('hex'),
      remoteFundPubkey: dlcAccept.fundingPubKey.toString('hex'),
    };

    const refundHex = (
      await this.AddSignaturesToRefundTx(addSigsToRefundTxRequest)
    ).hex;

    return Tx.decode(StreamReader.fromHex(refundHex));
  }

  /**
   * Generate PSBT for closing DLC with Mutual Consent
   * If no PSBT provided, assume initiator
   * If PSBT provided, assume reciprocator
   * @param _dlcOffer DlcOffer TLV (V0)
   * @param _dlcAccept DlcAccept TLV (V0)
   * @param _dlcTxs DlcTransactions TLV (V0)
   * @param initiatorPayoutSatoshis Amount initiator expects as a payout
   * @param isOfferer Whether offerer or not
   * @param _psbt Partially Signed Bitcoin Transaction
   * @param _inputs Optionally specified closing inputs
   * @returns {Promise<Psbt>}
   */
  async close(
    _dlcOffer: DlcOffer,
    _dlcAccept: DlcAccept,
    _dlcTxs: DlcTransactions,
    initiatorPayoutSatoshis: bigint,
    isOfferer: boolean,
    _psbt?: Psbt,
    _inputs?: Input[],
  ): Promise<Psbt> {
    const { dlcOffer, dlcAccept, dlcTxs } = checkTypes({
      _dlcOffer,
      _dlcAccept,
      _dlcTxs,
    });

    const fundPrivateKeyPair = await this.GetFundKeyPair(
      dlcOffer,
      dlcAccept,
      isOfferer,
    );

    let psbt: Psbt;
    if (_psbt) {
      // Reciprocate if PSBT passed in
      psbt = _psbt.clone();

      psbt.signInput(0, fundPrivateKeyPair);
      psbt.validateSignaturesOfInput(0);
      psbt.finalizeAllInputs();
    } else {
      // Initiate and build PSBT
      let inputs: Input[] = _inputs;
      if ((_inputs && _inputs.length === 0) || !_inputs) {
        inputs = await this.GetInputsForAmount(
          BigInt(20000),
          dlcOffer.feeRatePerVb,
          _inputs,
        );
      }

      psbt = await this.BuildCloseTx(
        dlcOffer,
        dlcAccept,
        dlcTxs,
        initiatorPayoutSatoshis,
        isOfferer,
        inputs,
      );

      psbt.signInput(0, fundPrivateKeyPair);
      psbt.validateSignaturesOfInput(0);

      for (let i = 1; i < inputs.length + 1; i++) {
        const wallet: Address = await this.getMethod('getWalletAddress')(
          inputs[i - 1].address,
        );
        const keyPair = await this.getMethod('keyPair')(wallet.derivationPath);
        psbt.signInput(i, keyPair);
        psbt.validateSignaturesOfInput(i);
      }
    }

    return psbt;
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
    assert(
      _input.type === MessageType.FundingInputV0,
      'FundingInput must be V0',
    );
    const network = await this.getConnectedNetwork();
    const input = _input as FundingInputV0;
    const prevTx = input.prevTx;
    const prevTxOut = prevTx.outputs[input.prevTxVout];
    const scriptPubKey = prevTxOut.scriptPubKey.serialize().slice(1);
    const _address = address.fromOutputScript(scriptPubKey, network);
    let derivationPath: string;

    if (findDerivationPath) {
      const inputAddress: Address = await this.client.financewallet.quickFindAddress(
        [_address],
      );
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
    const fundingInput = new FundingInputV0();
    fundingInput.prevTxVout = input.vout;

    const txRaw = await this.getMethod('getRawTransactionByHash')(input.txid);
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
  cetSignatures: CetAdaptorSignaturesV0;
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
