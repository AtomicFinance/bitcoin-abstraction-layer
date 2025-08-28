import Provider from '@atomicfinance/provider';
import {
  AdaptorSignature,
  Address,
  Amount,
  CalculateEcSignatureRequest,
  CreateRawTransactionRequest,
  CreateSignatureHashRequest,
  DdkDlcInputInfo,
  DdkDlcTransactions,
  DdkInterface,
  DdkOracleInfo,
  DdkTransaction,
  DlcInputInfo,
  DlcInputInfoRequest,
  Input,
  InputSupplementationMode,
  Messages,
  PartyParams,
  Payout,
  PayoutRequest,
  Utxo,
  VerifySignatureRequest,
} from '@atomicfinance/types';
import { sleep } from '@atomicfinance/utils';
import { Script, Sequence, Tx } from '@node-dlc/bitcoin';
import { StreamReader } from '@node-dlc/bufio';
import { BatchDlcTxBuilder } from '@node-dlc/core';
import {
  DualClosingTxFinalizer,
  DualFundingTxFinalizer,
  groupByIgnoringDigits,
  HyperbolaPayoutCurve,
  PolynomialPayoutCurve,
  roundPayout,
} from '@node-dlc/core';
import { hash160, sha256 } from '@node-dlc/crypto';
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
  DlcInput,
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
import {
  address,
  networks,
  payments,
  Psbt,
  script,
  Transaction as btTransaction,
} from 'bitcoinjs-lib';
import crypto from 'crypto';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

import { checkTypes, generateSerialId, outputsToPayouts } from './utils/Utils';

const ECPair = ECPairFactory(ecc);

export default class BitcoinDdkProvider extends Provider {
  private _network: BitcoinNetwork;
  private _ddk: DdkInterface;

  constructor(network: BitcoinNetwork, ddkLib: DdkInterface) {
    super();
    this._network = network;
    this._ddk = ddkLib;
  }

  public async DdkLoaded() {
    while (!this._ddk) {
      await sleep(10);
    }
  }

  /**
   * Helper function to ensure we have a Buffer object
   * Handles cases where Buffer objects have been serialized/deserialized
   */
  private ensureBuffer(
    bufferLike: Buffer | { type: string; data: number[] } | any,
  ): Buffer {
    if (Buffer.isBuffer(bufferLike)) {
      return bufferLike;
    }
    if (bufferLike && bufferLike.type === 'Buffer' && bufferLike.data) {
      return Buffer.from(bufferLike.data);
    }
    return bufferLike;
  }

  /**
   * Detect if signature is in compact format (64 bytes) or DER format
   * and convert compact to DER if needed, adding SIGHASH_ALL flag
   */
  private ensureDerSignature(signature: Buffer): Buffer {
    // If signature is 64 bytes, it's likely compact format (32-byte r + 32-byte s)
    if (signature.length === 64) {
      // Convert compact signature to DER format
      const r = signature.slice(0, 32);
      const s = signature.slice(32, 64);

      // Create DER encoding manually
      // DER format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S]

      // Remove leading zeros from r and s, but keep at least one byte
      let rBytes = r;
      while (
        rBytes.length > 1 &&
        rBytes[0] === 0x00 &&
        (rBytes[1] & 0x80) === 0
      ) {
        rBytes = rBytes.slice(1);
      }

      let sBytes = s;
      while (
        sBytes.length > 1 &&
        sBytes[0] === 0x00 &&
        (sBytes[1] & 0x80) === 0
      ) {
        sBytes = sBytes.slice(1);
      }

      // Add padding byte if high bit is set (to keep numbers positive)
      if ((rBytes[0] & 0x80) !== 0) {
        rBytes = Buffer.concat([Buffer.from([0x00]), rBytes]);
      }
      if ((sBytes[0] & 0x80) !== 0) {
        sBytes = Buffer.concat([Buffer.from([0x00]), sBytes]);
      }

      const totalLength = 2 + rBytes.length + 2 + sBytes.length;

      const derSignature = Buffer.concat([
        Buffer.from([0x30, totalLength]), // SEQUENCE tag and total length
        Buffer.from([0x02, rBytes.length]), // INTEGER tag and R length
        rBytes,
        Buffer.from([0x02, sBytes.length]), // INTEGER tag and S length
        sBytes,
        Buffer.from([0x01]), // SIGHASH_ALL flag
      ]);

      return derSignature;
    }

    // If it's already DER format, check if it has SIGHASH flag
    if (signature.length > 0 && signature[0] === 0x30) {
      // Check if it already has a SIGHASH flag (last byte should be 0x01 for SIGHASH_ALL)
      if (signature[signature.length - 1] !== 0x01) {
        // Add SIGHASH_ALL flag
        return Buffer.concat([signature, Buffer.from([0x01])]);
      }
      return signature;
    }

    // For other formats, return as-is
    return signature;
  }

  /**
   * Detect if signature is in DER format and convert to compact format (64 bytes)
   * by extracting r and s values, removing SIGHASH flag if present
   */
  private ensureCompactSignature(signature: Buffer): Buffer {
    // If signature is already 64 bytes, it's likely already compact format
    if (signature.length === 64) {
      return signature;
    }

    // Check if it's DER format (starts with 0x30)
    if (signature.length > 6 && signature[0] === 0x30) {
      let derSig = signature;

      // Remove SIGHASH flag if present (last byte is typically 0x01 for SIGHASH_ALL)
      if (signature[signature.length - 1] === 0x01) {
        derSig = signature.slice(0, -1);
      }

      // Parse DER format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S]
      if (derSig[0] !== 0x30) {
        throw new Error('Invalid DER signature: missing SEQUENCE tag');
      }

      const totalLength = derSig[1];
      if (derSig.length < totalLength + 2) {
        throw new Error('Invalid DER signature: length mismatch');
      }

      let offset = 2;

      // Parse R value
      if (derSig[offset] !== 0x02) {
        throw new Error('Invalid DER signature: missing INTEGER tag for R');
      }
      offset++;

      const rLength = derSig[offset];
      offset++;

      if (offset + rLength > derSig.length) {
        throw new Error(
          'Invalid DER signature: R length exceeds signature length',
        );
      }

      let rBytes = derSig.slice(offset, offset + rLength);
      offset += rLength;

      // Parse S value
      if (derSig[offset] !== 0x02) {
        throw new Error('Invalid DER signature: missing INTEGER tag for S');
      }
      offset++;

      const sLength = derSig[offset];
      offset++;

      if (offset + sLength > derSig.length) {
        throw new Error(
          'Invalid DER signature: S length exceeds signature length',
        );
      }

      let sBytes = derSig.slice(offset, offset + sLength);

      // Remove leading zero padding from r and s (DER may pad to prevent negative interpretation)
      while (rBytes.length > 1 && rBytes[0] === 0x00) {
        rBytes = rBytes.slice(1);
      }
      while (sBytes.length > 1 && sBytes[0] === 0x00) {
        sBytes = sBytes.slice(1);
      }

      // Pad to 32 bytes each (compact format requires exactly 32 bytes for r and s)
      while (rBytes.length < 32) {
        rBytes = Buffer.concat([Buffer.from([0x00]), rBytes]);
      }
      while (sBytes.length < 32) {
        sBytes = Buffer.concat([Buffer.from([0x00]), sBytes]);
      }

      if (rBytes.length !== 32 || sBytes.length !== 32) {
        throw new Error('Invalid signature values: r or s exceeds 32 bytes');
      }

      // Combine r and s into 64-byte compact format
      return Buffer.concat([rBytes, sBytes]);
    }

    // For other formats, throw error as we can't convert
    throw new Error(
      'Unable to convert signature to compact format: unknown format',
    );
  }

  /**
   * Compute contract ID from fund transaction ID, output index, and temporary contract ID
   * Matches the Rust implementation in rust-dlc
   */
  private computeContractId(
    fundTxId: Buffer,
    fundOutputIndex: number,
    temporaryContractId: Buffer,
  ): Buffer {
    if (fundTxId.length !== 32) {
      throw new Error('Fund transaction ID must be 32 bytes');
    }
    if (temporaryContractId.length !== 32) {
      throw new Error('Temporary contract ID must be 32 bytes');
    }
    if (fundOutputIndex > 0xffff) {
      throw new Error('Fund output index must fit in 16 bits');
    }

    const result = Buffer.alloc(32);

    // XOR fund_tx_id with temporary_id, with byte order reversal for fund_tx_id
    for (let i = 0; i < 32; i++) {
      result[i] = fundTxId[31 - i] ^ temporaryContractId[i];
    }

    // XOR the fund output index into the last two bytes
    result[30] ^= (fundOutputIndex >> 8) & 0xff; // High byte
    result[31] ^= fundOutputIndex & 0xff; // Low byte

    return result;
  }

  /**
   * Create refund signature using PSBT method instead of DDK
   */
  private async createRefundSignaturePSBT(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTxs: DlcTransactions,
    isOfferer: boolean,
  ): Promise<Buffer> {
    const network = await this.getConnectedNetwork();
    const psbt = new Psbt({ network });

    // Verify refund transaction locktime matches expected
    if (Number(dlcTxs.refundTx.locktime) !== dlcOffer.refundLocktime) {
      throw new Error(
        `Refund transaction locktime ${dlcTxs.refundTx.locktime} does not match expected ${dlcOffer.refundLocktime}`,
      );
    }

    // Create the same funding script as createDlcClose
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

    // Add the funding input with sequence from refund transaction
    psbt.addInput({
      hash: dlcTxs.fundTx.txId.serialize(),
      index: dlcTxs.fundTxVout,
      sequence: Number(dlcTxs.refundTx.inputs[0].sequence),
      witnessUtxo: {
        script: paymentVariant.output,
        value: Number(this.getFundOutputValueSats(dlcTxs)),
      },
      witnessScript: paymentVariant.redeem.output,
    });

    // Add the refund outputs - refund transaction should have 2 outputs (offerer and accepter)
    dlcTxs.refundTx.outputs.forEach((refundOutput) => {
      psbt.addOutput({
        address: address.fromOutputScript(
          refundOutput.scriptPubKey.serialize().subarray(1),
          network,
        ),
        value: Number(refundOutput.value.sats),
      });
    });

    // Set the locktime to match the refund transaction
    psbt.setLocktime(Number(dlcTxs.refundTx.locktime));

    // Generate our keypair to sign the refund input
    const fundPrivateKeyPair = await this.GetFundKeyPair(
      dlcOffer,
      dlcAccept,
      isOfferer,
    );

    // Sign the input
    psbt.signInput(0, fundPrivateKeyPair);

    // Validate the signature
    psbt.validateSignaturesOfInput(
      0,
      (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
        return ecc.verify(msghash, pubkey, signature);
      },
    );

    // Extract our signature and decode it to only extract r and s values (compact format)
    const partialSig = psbt.data.inputs[0].partialSig[0];
    const derSignature = partialSig.signature;

    // Convert DER signature to compact format
    return this.ensureCompactSignature(derSignature);
  }

  /**
   * Find private key for DLC funding pubkey by deriving wallet addresses
   */
  private async findDlcFundingPrivateKey(
    localFundPubkey: string,
    remoteFundPubkey: string,
  ): Promise<string> {
    const targetPubkeys = [localFundPubkey, remoteFundPubkey];

    // First check existing wallet addresses
    const addresses = await this.getMethod('getAddresses')();

    for (const addressInfo of addresses) {
      if (addressInfo.derivationPath) {
        try {
          const keyPair = await this.getMethod('keyPair')(
            addressInfo.derivationPath,
          );
          const pubkey = Buffer.from(keyPair.publicKey);
          const pubkeyHex = pubkey.toString('hex');

          if (targetPubkeys.includes(pubkeyHex)) {
            return Buffer.from(keyPair.privateKey).toString('hex');
          }
        } catch {
          continue;
        }
      }
    }

    // If not found in existing addresses, do comprehensive search
    // For DLC splicing, funding pubkeys can be at much higher derivation paths
    console.log('Searching extensively for DLC funding private key...');

    for (const isChange of [false, true]) {
      for (let i = 0; i < 1000; i++) {
        // Search up to 1000 addresses for DLC keys
        try {
          const address = await this.client.wallet.getAddresses(i, 1, isChange);
          if (address && address.length > 0) {
            const addressInfo = address[0];

            if (addressInfo.derivationPath) {
              const keyPair = await this.getMethod('keyPair')(
                addressInfo.derivationPath,
              );
              const pubkey = Buffer.from(keyPair.publicKey);
              const pubkeyHex = pubkey.toString('hex');

              if (targetPubkeys.includes(pubkeyHex)) {
                console.log(
                  `Found DLC funding key at derivation path: ${addressInfo.derivationPath}`,
                );
                return Buffer.from(keyPair.privateKey).toString('hex');
              }
            }
          }
        } catch {
          continue;
        }
      }
    }

    throw new Error(
      `Could not find private key for DLC funding pubkeys: local=${localFundPubkey}, remote=${remoteFundPubkey}`,
    );
  }

  private async GetPrivKeysForInputs(inputs: Input[]): Promise<string[]> {
    const privKeys: string[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      if (input.isDlcInput()) {
        // Handle DLC input - use the dedicated method to find the funding private key
        const dlcInput = input.dlcInput!;
        const foundPrivKey = await this.findDlcFundingPrivateKey(
          dlcInput.localFundPubkey,
          dlcInput.remoteFundPubkey,
        );
        privKeys.push(foundPrivKey);
      } else {
        // Handle regular input
        let derivationPath = input.derivationPath;

        if (!derivationPath) {
          try {
            derivationPath = (
              await this.getMethod('getWalletAddress')(input.address)
            ).derivationPath;
          } catch (error) {
            throw new Error(
              `Unable to find address ${input.address} in wallet. ` +
                `This may happen when using derivation paths outside the normal range. ` +
                `Error: ${error.message}`,
            );
          }
        }

        const keyPair = await this.getMethod('keyPair')(derivationPath);
        const privKey = Buffer.from(keyPair.__D).toString('hex');
        privKeys.push(privKey);
      }
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

  /**
   * Get inputs for amount with explicit supplementation control
   */
  async GetInputsForAmountWithMode(
    amounts: bigint[],
    feeRatePerVb: bigint,
    fixedInputs: Input[] = [],
    supplementation: InputSupplementationMode = InputSupplementationMode.Required,
  ): Promise<Input[]> {
    if (amounts.length === 0) return [];

    // For "none" mode, use exactly the provided inputs
    if (supplementation === InputSupplementationMode.None) {
      return fixedInputs;
    }

    // For "required" and "optional" modes, attempt supplementation
    const fixedUtxos = fixedInputs.map((input) => input.toUtxo());

    try {
      const inputsForAmount: InputsForDualAmountResponse = await this.getMethod(
        'getInputsForDualFunding',
      )(amounts, feeRatePerVb, fixedUtxos);

      // Convert UTXO objects to Input class instances
      return inputsForAmount.inputs.map((utxo) => Input.fromUTXO(utxo));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';

      if (supplementation === InputSupplementationMode.Required) {
        throw Error(
          `Not enough balance GetInputsForAmountWithMode. Error: ${errorMessage}`,
        );
      } else {
        // Optional mode: fallback to provided inputs
        return fixedInputs;
      }
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

      // Convert UTXO objects to Input class instances
      inputs = inputsForAmount.inputs.map((utxo) => Input.fromUTXO(utxo));
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
    inputSupplementationMode: InputSupplementationMode = InputSupplementationMode.Required,
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

    const inputs: Input[] = await this.GetInputsForAmountWithMode(
      [collateral],
      feeRatePerVb,
      fixedInputs,
      inputSupplementationMode,
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

  /**
   * Converts a @node-dlc/bitcoin Tx to a DDK Transaction
   * @param tx The @node-dlc/bitcoin transaction
   * @returns DDK Transaction object
   */
  private convertTxToDdkTransaction(tx: Tx): DdkTransaction {
    return {
      version: tx.version,
      lockTime: tx.locktime.value,
      inputs: tx.inputs.map((input) => ({
        txid: input.outpoint.txid.toString(),
        vout: input.outpoint.outputIndex,
        scriptSig: Buffer.from(''),
        sequence: input.sequence.value,
        witness: input.witness.map((witness) => witness.serialize()),
      })),
      outputs: tx.outputs.map((output) => ({
        value: BigInt(output.value.sats),
        scriptPubkey: output.scriptPubKey.serialize(),
      })),
      rawBytes: tx.serialize(),
    };
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

    // Separate regular inputs from DLC inputs (only from offeror side)
    const localRegularInputs: Utxo[] = [];
    const localDlcInputs: DdkDlcInputInfo[] = [];

    for (const fundingInput of dlcOffer.fundingInputs) {
      if (fundingInput.dlcInput) {
        // This is a DLC input for splicing
        // The pubkeys should be from the original DLC to correctly spend its funding output
        localDlcInputs.push({
          fundTx: this.convertTxToDdkTransaction(fundingInput.prevTx),
          fundVout: fundingInput.prevTxVout,
          localFundPubkey: fundingInput.dlcInput.localFundPubkey,
          remoteFundPubkey: fundingInput.dlcInput.remoteFundPubkey,
          fundAmount:
            fundingInput.prevTx.outputs[fundingInput.prevTxVout].value.sats,
          maxWitnessLen: fundingInput.maxWitnessLen,
          inputSerialId: fundingInput.inputSerialId,
          contractId: fundingInput.dlcInput.contractId,
        });
      } else {
        // Regular input
        const input = await this.fundingInputToInput(fundingInput, false);
        localRegularInputs.push(input.toUtxo());
      }
    }

    // Process remote inputs (no DLC inputs from acceptor side)
    const remoteInputs: Utxo[] = await Promise.all(
      dlcAccept.fundingInputs.map(async (fundingInput) => {
        const input = await this.fundingInputToInput(fundingInput, false);
        return input.toUtxo();
      }),
    );

    // Calculate input amounts
    const localInputAmount = localRegularInputs.reduce<number>(
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

    const outcomes: Payout[] = payouts.map((payout) => ({
      offer: BigInt(payout.local),
      accept: BigInt(payout.remote),
    }));

    const localParams: PartyParams = {
      fundPubkey: Buffer.from(localFundPubkey, 'hex'),
      changeScriptPubkey: Buffer.from(localChangeScriptPubkey, 'hex'),
      changeSerialId: BigInt(dlcOffer.changeSerialId),
      payoutScriptPubkey: Buffer.from(localFinalScriptPubkey, 'hex'),
      payoutSerialId: BigInt(dlcOffer.payoutSerialId),
      inputs: localRegularInputs.map((input) => input.toTxInputInfo()),
      inputAmount: BigInt(localInputAmount),
      collateral: BigInt(dlcOffer.offerCollateral),
      dlcInputs: localDlcInputs,
    };

    const remoteParams: PartyParams = {
      fundPubkey: Buffer.from(remoteFundPubkey, 'hex'),
      changeScriptPubkey: Buffer.from(remoteChangeScriptPubkey, 'hex'),
      changeSerialId: BigInt(dlcAccept.changeSerialId),
      payoutScriptPubkey: Buffer.from(remoteFinalScriptPubkey, 'hex'),
      payoutSerialId: BigInt(dlcAccept.payoutSerialId),
      inputs: remoteInputs.map((input) => input.toTxInputInfo()),
      inputAmount: BigInt(remoteInputAmount),
      collateral: BigInt(dlcAccept.acceptCollateral),
      dlcInputs: [],
    };

    // Determine whether to use regular or spliced DLC transactions
    const hasDlcInputs = localDlcInputs.length > 0;

    let dlcTxs: DdkDlcTransactions;

    if (hasDlcInputs) {
      // Use spliced DLC transactions when DLC inputs are present
      dlcTxs = await this._ddk.createSplicedDlcTransactions(
        outcomes,
        localParams,
        remoteParams,
        dlcOffer.refundLocktime,
        BigInt(dlcOffer.feeRatePerVb),
        0,
        dlcOffer.cetLocktime,
        dlcOffer.fundOutputSerialId,
      );
    } else {
      // Use regular DLC transactions when no DLC inputs
      dlcTxs = this._ddk.createDlcTransactions(
        outcomes,
        localParams,
        remoteParams,
        dlcOffer.refundLocktime,
        BigInt(dlcOffer.feeRatePerVb),
        0,
        dlcOffer.cetLocktime,
        BigInt(dlcOffer.fundOutputSerialId),
      );
    }

    const dlcTransactions = new DlcTransactions();
    dlcTransactions.fundTx = Tx.decode(
      StreamReader.fromBuffer(dlcTxs.fund.rawBytes),
    );

    // Build serial IDs based on actual outputs in the transaction
    const actualOutputs = dlcTransactions.fundTx.outputs;
    const serialIds: bigint[] = [];

    // Always include the funding output serial ID
    serialIds.push(BigInt(dlcOffer.fundOutputSerialId));

    // Only include change serial IDs if there are actually change outputs
    // For exact amount DLCs with no change, there will be only 1 output (the funding output)
    if (actualOutputs.length > 1) {
      // Multiple outputs means there are change outputs
      if (dlcOffer.offerCollateral > 0n) {
        serialIds.push(BigInt(dlcOffer.changeSerialId));
      }
      if (dlcAccept.acceptCollateral > 0n) {
        serialIds.push(BigInt(dlcAccept.changeSerialId));
      }
    }

    dlcTransactions.fundTxVout = serialIds
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .findIndex((i) => BigInt(i) === BigInt(dlcOffer.fundOutputSerialId));

    // Validate that the calculated fundTxVout is valid
    if (
      dlcTransactions.fundTxVout < 0 ||
      dlcTransactions.fundTxVout >= dlcTransactions.fundTx.outputs.length
    ) {
      throw new Error(
        `Invalid fundTxVout calculation: calculated=${dlcTransactions.fundTxVout}, ` +
          `fundTx.outputs.length=${dlcTransactions.fundTx.outputs.length}, ` +
          `fundOutputSerialId=${dlcOffer.fundOutputSerialId}, ` +
          `serialIds=[${serialIds.join(', ')}], ` +
          `offerCollateral=${dlcOffer.offerCollateral}, ` +
          `acceptCollateral=${dlcAccept.acceptCollateral}`,
      );
    }

    dlcTransactions.cets = dlcTxs.cets.map((cetTx) =>
      Tx.decode(StreamReader.fromBuffer(cetTx.rawBytes)),
    );
    dlcTransactions.refundTx = Tx.decode(
      StreamReader.fromBuffer(dlcTxs.refund.rawBytes),
    );

    return { dlcTransactions, messagesList };
  }

  /**
   * Computes DLC-spec compliant tagged attestation message digest
   * This matches what the oracle should sign according to the DLC specification
   */
  private computeTaggedAttestationMessage(outcome: string): string {
    // DLC spec: H(H("DLC/oracle/attestation/v0") || H("DLC/oracle/attestation/v0") || H(outcome))
    const tag = Buffer.from('DLC/oracle/attestation/v0', 'utf8');
    const tagHash = sha256(tag);
    const outcomeBuffer = Buffer.from(outcome, 'utf8');

    // Compute H(tagHash || tagHash || outcomeHash)
    const message = sha256(Buffer.concat([tagHash, tagHash, outcomeBuffer]));
    return message.toString('hex');
  }

  /**
   * Convert message lists to the format expected by DDK FFI
   * DDK expects 32-byte message digests (tagged attestation messages)
   */
  private convertMessagesForDdk(tempMessagesList: Messages[]): Buffer[][][] {
    return tempMessagesList.map((message) => [
      message.messages.map((m) => {
        // Convert outcome string to tagged attestation message (32-byte hash)
        return Buffer.from(this.computeTaggedAttestationMessage(m), 'hex');
      }),
    ]);
  }

  private GenerateEnumMessages(oracleEvent: OracleEvent): Messages[] {
    const eventDescriptor = oracleEvent.eventDescriptor as EnumEventDescriptor;

    // For enum events, each oracle has one nonce and can attest to one of the possible outcomes
    const messagesList: Messages[] = [];

    // Pass raw outcome strings to dlcdevkit - it will handle the tagged hashing internally
    // dlcdevkit expects raw strings and calls tagged_attestation_msg() internally
    const messages = eventDescriptor.outcomes;
    messagesList.push({ messages });

    return messagesList;
  }

  private convertToJsonSerializable(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'bigint') {
      return Number(obj);
    }

    if (Buffer.isBuffer(obj)) {
      return obj.toString('hex');
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertToJsonSerializable(item));
    }

    if (typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.convertToJsonSerializable(value);
      }
      return result;
    }

    return obj;
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

  private getFundOutputValueSats(dlcTxs: DlcTransactions): bigint {
    const fundOutput = dlcTxs.fundTx.outputs[dlcTxs.fundTxVout];
    if (!fundOutput || !fundOutput.value) {
      throw new Error(
        `Invalid fund output at vout ${dlcTxs.fundTxVout}: ` +
          `outputs.length=${dlcTxs.fundTx.outputs.length}, ` +
          `output exists=${!!fundOutput}, ` +
          `output.value exists=${!!(fundOutput && fundOutput.value)}`,
      );
    }
    return fundOutput.value.sats;
  }

  private async CreateCetAdaptorAndRefundSigs(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTxs: DlcTransactions,
    messagesList: Messages[],
    isOfferer: boolean,
  ): Promise<CreateCetAdaptorAndRefundSigsResponse> {
    const network = await this.getConnectedNetwork();

    const cetsHex = dlcTxs.cets.map((cet) => cet.serialize().toString('hex'));

    // Create the correct P2WSH multisig funding script
    const fundingPubKeys =
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
        ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
        : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: fundingPubKeys,
      network,
    });

    // We need the redeem script (multisig), not the P2WSH output
    const fundingSPK = p2ms.output!;

    // For finding the private key, we still need the individual P2WPKH address
    const individualFundingSPK = Script.p2wpkhLock(
      hash160(isOfferer ? dlcOffer.fundingPubkey : dlcAccept.fundingPubkey),
    )
      .serialize()
      .slice(1);

    const fundingAddress: string = address.fromOutputScript(
      individualFundingSPK,
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

        const adaptorSigRequestPromises: Promise<AdaptorSignature[]>[] = [];

        const tempMessagesList = messagesList;
        const tempCetsHex = cetsHex;

        const ddkOracleInfo: DdkOracleInfo = {
          publicKey: oracleAnnouncement.oraclePubkey,
          nonces: oracleAnnouncement.oracleEvent.oracleNonces,
        };

        adaptorSigRequestPromises.push(
          (async () => {
            const cetsForDdk = tempCetsHex.map((cetHex) =>
              this.convertTxToDdkTransaction(
                Tx.decode(StreamReader.fromHex(cetHex)),
              ),
            );
            const messagesForDdk = this.convertMessagesForDdk(tempMessagesList);

            const response = this._ddk.createCetAdaptorSigsFromOracleInfo(
              cetsForDdk,
              [ddkOracleInfo],
              Buffer.from(fundPrivateKey, 'hex'),
              fundingSPK,
              this.getFundOutputValueSats(dlcTxs),
              messagesForDdk,
            );
            return response;
          })(),
        );

        const adaptorPairs: AdaptorSignature[] = (
          await Promise.all(adaptorSigRequestPromises)
        ).flat();

        sigs.push(
          adaptorPairs.map((adaptorPair) => {
            return {
              encryptedSig: adaptorPair.signature,
              dleqProof: adaptorPair.proof,
            };
          }),
        );
      }
    } else {
      const indices = this.GetIndicesFromPayouts(this.GetPayouts(dlcOffer));

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
        const adaptorSigRequestPromises: Promise<AdaptorSignature[]>[] = [];

        for (let i = 0, j = oracleEventMessagesList.length; i < j; i += chunk) {
          const tempMessagesList = oracleEventMessagesList.slice(i, i + chunk);
          const tempCetsHex = oracleEventCetsHex.slice(i, i + chunk);

          const ddkOracleInfo: DdkOracleInfo = {
            publicKey: oracleAnnouncement.oraclePubkey,
            nonces: oracleAnnouncement.oracleEvent.oracleNonces,
          };

          const messagesForDdk = this.convertMessagesForDdk(tempMessagesList);

          adaptorSigRequestPromises.push(
            (async () => {
              const response = this._ddk.createCetAdaptorSigsFromOracleInfo(
                tempCetsHex.map((cetHex) =>
                  this.convertTxToDdkTransaction(
                    Tx.decode(StreamReader.fromHex(cetHex)),
                  ),
                ),
                [ddkOracleInfo],
                Buffer.from(fundPrivateKey, 'hex'),
                fundingSPK,
                this.getFundOutputValueSats(dlcTxs),
                messagesForDdk,
              );
              return response;
            })(),
          );
        }

        const adaptorPairs: AdaptorSignature[] = (
          await Promise.all(adaptorSigRequestPromises)
        ).flat();

        sigs.push(
          adaptorPairs.map((adaptorPair) => {
            return {
              encryptedSig: adaptorPair.signature,
              dleqProof: adaptorPair.proof,
            };
          }),
        );
      }
    }

    const refundSignature = await this.createRefundSignaturePSBT(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      isOfferer,
    );

    const cetSignatures = new CetAdaptorSignatures();
    cetSignatures.sigs = sigs.flat();

    return { cetSignatures, refundSignature };
  }

  private async VerifyCetAdaptorAndRefundSigs(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    messagesList: Messages[],
    isOfferer: boolean,
  ): Promise<void> {
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

        const oracleEventSigs = isOfferer
          ? dlcAccept.cetAdaptorSignatures.sigs
          : dlcSign.cetAdaptorSignatures.sigs;

        const sigsValidity: Promise<boolean>[] = [];

        const tempMessagesList = messagesList;
        const tempSigs = oracleEventSigs;
        const tempAdaptorPairs = tempSigs.map((sig) => {
          return {
            signature: Buffer.concat([sig.encryptedSig, sig.dleqProof]),
            proof: Buffer.from(''),
          };
        });

        // Create the correct P2WSH multisig funding script for verification
        const network = await this.getConnectedNetwork();
        const verifyFundingPubKeys =
          Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
            ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
            : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

        const verifyP2ms = payments.p2ms({
          m: 2,
          pubkeys: verifyFundingPubKeys,
          network,
        });

        // We need the redeem script (multisig), not the P2WSH output
        const fundingSPK = verifyP2ms.output!;

        const ddkOracleInfo: DdkOracleInfo = {
          publicKey: oracleAnnouncement.oraclePubkey,
          nonces: oracleAnnouncement.oracleEvent.oracleNonces,
        };

        const pubkey = isOfferer
          ? dlcAccept.fundingPubkey
          : dlcOffer.fundingPubkey;

        const messagesForDdk = this.convertMessagesForDdk(tempMessagesList);

        sigsValidity.push(
          (async () => {
            const response = this._ddk.verifyCetAdaptorSigsFromOracleInfo(
              tempAdaptorPairs,
              dlcTxs.cets.map((cet) => this.convertTxToDdkTransaction(cet)),
              [ddkOracleInfo],
              pubkey,
              fundingSPK,
              this.getFundOutputValueSats(dlcTxs),
              messagesForDdk,
            );
            return response;
          })(),
        );

        let areSigsValid = (await Promise.all(sigsValidity)).every((b) => b);

        await this.VerifyRefundSignatureAlt(
          dlcOffer,
          dlcAccept,
          dlcSign,
          dlcTxs,
          isOfferer,
        );

        if (!areSigsValid) {
          throw new Error('Invalid signatures received');
        }
      }
    } else {
      const chunk = 100;

      const indices = this.GetIndicesFromPayouts(this.GetPayouts(dlcOffer));

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
              signature: sig.encryptedSig,
              proof: sig.dleqProof,
            };
          });

          // Create the correct P2WSH multisig funding script
          const network = await this.getConnectedNetwork();
          const nonEnumFundingPubKeys =
            Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) ===
            -1
              ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
              : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

          const nonEnumP2ms = payments.p2ms({
            m: 2,
            pubkeys: nonEnumFundingPubKeys,
            network,
          });

          // We need the redeem script (multisig), not the P2WSH output
          const fundingSPK = nonEnumP2ms.output!;

          const ddkOracleInfo: DdkOracleInfo = {
            publicKey: oracleAnnouncement.oraclePubkey,
            nonces: oracleAnnouncement.oracleEvent.oracleNonces,
          };

          const pubkey = isOfferer
            ? dlcAccept.fundingPubkey
            : dlcOffer.fundingPubkey;

          const messagesForDdk = this.convertMessagesForDdk(tempMessagesList);

          sigsValidity.push(
            (async () => {
              const response = this._ddk.verifyCetAdaptorSigsFromOracleInfo(
                tempAdaptorPairs,
                tempCetsHex.map((cet) =>
                  this.convertTxToDdkTransaction(
                    Tx.decode(StreamReader.fromHex(cet)),
                  ),
                ),
                [ddkOracleInfo],
                pubkey,
                fundingSPK,
                this.getFundOutputValueSats(dlcTxs),
                messagesForDdk,
              );
              return response;
            })(),
          );
        }

        let areSigsValid = (await Promise.all(sigsValidity)).every((b) => b);

        // Verify refund signature using PSBT approach
        await this.VerifyRefundSignatureAlt(
          dlcOffer,
          dlcAccept,
          dlcSign,
          dlcTxs,
          isOfferer,
        );

        if (!areSigsValid) {
          throw new Error('Invalid CET adaptor signatures received');
        }
      }
    }
  }

  private async CreateFundingSigsAlt(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTxs: DlcTransactions,
    isOfferer: boolean,
  ): Promise<FundingSignatures> {
    const transaction = btTransaction.fromBuffer(dlcTxs.fundTx.serialize());
    const network = await this.getConnectedNetwork();
    const psbt = new Psbt({ network });

    // Combine all funding inputs from both parties
    const allFundingInputs = [
      ...dlcOffer.fundingInputs,
      ...dlcAccept.fundingInputs,
    ];

    // Sort by inputSerialId to reconstruct proper transaction order
    allFundingInputs.sort((a, b) => Number(a.inputSerialId - b.inputSerialId));

    // Add all inputs to PSBT with proper witnessUtxo
    for (const fundingInput of allFundingInputs) {
      const prevOut = fundingInput.prevTx.outputs[fundingInput.prevTxVout];

      // Use the same pattern as existing code - slice(1) to remove length prefix
      const witnessUtxo = {
        script: prevOut.scriptPubKey.serialize().subarray(1),
        value: Number(prevOut.value.sats),
      };

      // Use sequence from the original transaction to ensure consistency
      const originalInput = transaction.ins.find(
        (input) =>
          input.hash.reverse().toString('hex') ===
            fundingInput.prevTx.txId.toString() &&
          input.index === fundingInput.prevTxVout,
      );
      const sequenceValue = originalInput
        ? originalInput.sequence
        : Number(fundingInput.sequence);

      psbt.addInput({
        hash: fundingInput.prevTx.txId.toString(),
        index: fundingInput.prevTxVout,
        sequence: sequenceValue,
        witnessUtxo,
      });
    }

    // Add all outputs to PSBT (maintains transaction structure)
    for (const output of transaction.outs) {
      psbt.addOutput({
        address: address.fromOutputScript(output.script, network),
        value: output.value,
      });
    }

    // Determine which inputs belong to this party
    const partyFundingInputs = isOfferer
      ? dlcOffer.fundingInputs
      : dlcAccept.fundingInputs;

    // Convert party's funding inputs to Input objects and get private keys
    const partyInputs: Input[] = await Promise.all(
      partyFundingInputs.map(async (fundingInput) => {
        return this.fundingInputToInput(fundingInput);
      }),
    );

    const inputPrivKeys = await this.GetPrivKeysForInputs(partyInputs);

    // Create map of this party's inputs for efficient lookup
    const partyInputMap = new Map<string, { input: Input; privKey: string }>();
    partyInputs.forEach((input, index) => {
      const key = `${input.txid}:${input.vout}`;
      partyInputMap.set(key, { input, privKey: inputPrivKeys[index] });
    });

    // Initialize witness elements array to match all inputs
    const witnessElements: ScriptWitnessV0[][] = [];

    // Sign only this party's inputs
    for (
      let inputIndex = 0;
      inputIndex < allFundingInputs.length;
      inputIndex++
    ) {
      const fundingInput = allFundingInputs[inputIndex];
      const inputKey = `${fundingInput.prevTx.txId.toString()}:${fundingInput.prevTxVout}`;

      if (partyInputMap.has(inputKey)) {
        // This input belongs to this party - sign it
        const { privKey } = partyInputMap.get(inputKey)!;
        const keyPair = ECPair.fromPrivateKey(Buffer.from(privKey, 'hex'));

        // Check if this is a DLC input (2-of-2 multisig from previous DLC)
        if (fundingInput.dlcInput) {
          // For DLC inputs, we'll need to handle 2-of-2 multisig signing differently
          // For now, throw an error as this requires implementing multisig support
          throw new Error(
            'DLC input signing not yet implemented in CreateFundingSigsAlt',
          );
        } else {
          // For P2WPKH inputs, use PSBT signing
          psbt.signInput(inputIndex, keyPair);

          // Extract signature from partial signatures (more reliable than finalization)
          const inputData = psbt.data.inputs[inputIndex];
          const partialSigs = inputData.partialSig;
          if (!partialSigs || partialSigs.length === 0) {
            throw new Error(
              `No signatures found for input ${inputIndex} after signing`,
            );
          }

          // For P2WPKH, create witness manually: [signature, publicKey]
          const sigWitness = new ScriptWitnessV0();
          sigWitness.witness = this.ensureCompactSignature(
            this.ensureBuffer(partialSigs[0].signature),
          );
          const pubKeyWitness = new ScriptWitnessV0();
          pubKeyWitness.witness = keyPair.publicKey;

          witnessElements.push([sigWitness, pubKeyWitness]);
        }
      }
      // Note: We don't add anything to witnessElements for other party's inputs
    }

    const fundingSignatures = new FundingSignatures();
    fundingSignatures.witnessElements = witnessElements;

    return fundingSignatures;
  }

  private async VerifyFundingSigsAlt(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    isOfferer: boolean,
  ): Promise<void> {
    const network = await this.getConnectedNetwork();
    const transaction = btTransaction.fromBuffer(dlcTxs.fundTx.serialize());

    // Get the party whose signatures we're verifying
    // If we're the offerer, we verify accepter's signatures (from dlcSign)
    // If we're the accepter, we verify offerer's signatures (from dlcSign)
    const signingPartyInputs = isOfferer
      ? dlcAccept.fundingInputs
      : dlcOffer.fundingInputs;

    // Combine all inputs to get the correct ordering
    const allFundingInputs = [
      ...dlcOffer.fundingInputs,
      ...dlcAccept.fundingInputs,
    ];
    allFundingInputs.sort((a, b) => Number(a.inputSerialId - b.inputSerialId));

    // Compare transaction IDs
    const dlcFundTxId = dlcTxs.fundTx.txId.toString();
    const psbtBuilderTxId = transaction.getId();

    assert(dlcFundTxId === psbtBuilderTxId, 'Transaction IDs do not match');

    // Create a PSBT for signature verification
    const psbt = new Psbt({ network });

    // Add all inputs (needed for proper sighash calculation)
    for (const input of allFundingInputs) {
      const prevOutput = input.prevTx.outputs[input.prevTxVout];
      psbt.addInput({
        hash: input.prevTx.txId.toString(),
        index: input.prevTxVout,
        sequence: 0,
        witnessUtxo: {
          script: prevOutput.scriptPubKey.serialize().subarray(1),
          value: Number(prevOutput.value.sats),
        },
      });
    }

    // Add all outputs
    for (const output of transaction.outs) {
      psbt.addOutput({
        address: address.fromOutputScript(output.script, network),
        value: output.value,
      });
    }

    if (
      psbt.inputCount !== transaction.ins.length ||
      psbt.txOutputs.length !== transaction.outs.length
    ) {
      throw new Error(`PSBT structure doesn't match original transaction`);
    }

    // Add the funding signatures to the PSBT as partial signatures
    let witnessIndex = 0;
    for (const fundingInput of signingPartyInputs) {
      // Skip DLC inputs for now (same as CreateFundingSigsAlt)
      if (fundingInput.dlcInput) {
        continue;
      }

      if (witnessIndex >= dlcSign.fundingSignatures.witnessElements.length) {
        throw new Error(
          `Not enough witness elements: expected at least ${witnessIndex + 1}, got ${dlcSign.fundingSignatures.witnessElements.length}`,
        );
      }

      const witnessElement =
        dlcSign.fundingSignatures.witnessElements[witnessIndex];
      const signature = witnessElement[0].witness;
      const publicKey = witnessElement[1].witness;

      // Find this input's index in the sorted transaction
      const inputIndex = allFundingInputs.findIndex(
        (input) =>
          input.prevTx.txId.toString() ===
            fundingInput.prevTx.txId.toString() &&
          input.prevTxVout === fundingInput.prevTxVout,
      );

      if (inputIndex === -1) {
        throw new Error(
          `Input not found in transaction: ${fundingInput.prevTx.txId.toString()}:${fundingInput.prevTxVout}`,
        );
      }

      psbt.updateInput(inputIndex, {
        partialSig: [
          { pubkey: publicKey, signature: this.ensureDerSignature(signature) },
        ],
      });

      psbt.validateSignaturesOfInput(
        inputIndex,
        (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
          return ecc.verify(msghash, pubkey, signature);
        },
      );

      witnessIndex++;
    }
  }

  private async VerifyRefundSignatureAlt(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    isOfferer: boolean,
  ): Promise<void> {
    const network = await this.getConnectedNetwork();

    // Get the refund signature we need to verify
    // If we're the offerer, we verify accepter's refund signature (from dlcAccept)
    // If we're the accepter, we verify offerer's refund signature (from dlcSign)
    const rawRefundSignature = isOfferer
      ? dlcAccept.refundSignature
      : dlcSign.refundSignature;

    // Ensure signature is in DER format (convert from compact if needed)
    const refundSignature = this.ensureDerSignature(rawRefundSignature);

    const signingPubkey = isOfferer
      ? dlcAccept.fundingPubkey
      : dlcOffer.fundingPubkey;

    // Verify refund transaction locktime matches expected
    if (Number(dlcTxs.refundTx.locktime) !== dlcOffer.refundLocktime) {
      throw new Error(
        `Refund transaction locktime ${dlcTxs.refundTx.locktime} does not match expected ${dlcOffer.refundLocktime}`,
      );
    }

    // Create a PSBT for the refund transaction verification using same approach as createDlcClose
    const psbt = new Psbt({ network });

    // Create the same funding script as createDlcClose
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

    // Add the funding input with sequence from refund transaction
    psbt.addInput({
      hash: dlcTxs.fundTx.txId.serialize(),
      index: dlcTxs.fundTxVout,
      sequence: Number(dlcTxs.refundTx.inputs[0].sequence),
      witnessUtxo: {
        script: paymentVariant.output,
        value: Number(this.getFundOutputValueSats(dlcTxs)),
      },
      witnessScript: paymentVariant.redeem.output,
    });

    // Add all refund outputs - refund transaction should have 2 outputs (offerer and accepter)
    dlcTxs.refundTx.outputs.forEach((refundOutput) => {
      psbt.addOutput({
        address: address.fromOutputScript(
          refundOutput.scriptPubKey.serialize().subarray(1),
          network,
        ),
        value: Number(refundOutput.value.sats),
      });
    });

    // Set the locktime to match the refund transaction
    psbt.setLocktime(Number(dlcTxs.refundTx.locktime));

    // Add the refund signature as a partial signature
    psbt.updateInput(0, {
      partialSig: [{ pubkey: signingPubkey, signature: refundSignature }],
    });

    // Validate the refund signature
    try {
      psbt.validateSignaturesOfInput(
        0,
        (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
          return ecc.verify(msghash, pubkey, signature);
        },
      );
    } catch (error) {
      throw new Error(
        `Refund signature validation failed for ${isOfferer ? 'accepter' : 'offerer'}: ${error.message}`,
      );
    }
  }

  private CreateFundingScript(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
  ): Buffer {
    const network = this.getBitcoinJsNetwork();

    // Sort funding pubkeys in lexicographical order as per DLC spec
    const fundingPubKeys =
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
        ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
        : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

    // Create 2-of-2 multisig script
    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: fundingPubKeys,
      network,
    });

    const paymentVariant = payments.p2wsh({
      redeem: p2ms,
      network,
    });

    return paymentVariant.redeem!.output!;
  }

  private async CreateFundingTx(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    fundingSignatures: FundingSignatures,
  ): Promise<Tx> {
    const network = await this.getConnectedNetwork();
    const psbt = new Psbt({ network });

    // Combine and sort all funding inputs by serial ID (same as CreateFundingSigsAlt)
    const allFundingInputs = [
      ...dlcOffer.fundingInputs,
      ...dlcAccept.fundingInputs,
    ];
    allFundingInputs.sort((a, b) => Number(a.inputSerialId - b.inputSerialId));

    // Create a map of input txid:vout to witness elements
    const witnessMap = new Map<string, ScriptWitnessV0[]>();

    // Map witness elements correctly - CreateFundingSigsAlt only creates witness elements
    // for the party's own inputs, so we need to map them correctly

    // For dlcSign (offerer's signatures), map to offerer's inputs only
    let offererWitnessIndex = 0;
    dlcOffer.fundingInputs.forEach((fundingInput) => {
      // Skip DLC inputs for now as in CreateFundingSigsAlt
      if (fundingInput.dlcInput) {
        return;
      }

      if (
        offererWitnessIndex < dlcSign.fundingSignatures.witnessElements.length
      ) {
        const key = `${fundingInput.prevTx.txId.toString()}:${fundingInput.prevTxVout}`;
        witnessMap.set(
          key,
          dlcSign.fundingSignatures.witnessElements[offererWitnessIndex],
        );
        offererWitnessIndex++;
      }
    });

    // For fundingSignatures (accepter's signatures), map to accepter's inputs only
    let accepterWitnessIndex = 0;
    dlcAccept.fundingInputs.forEach((fundingInput) => {
      // Skip DLC inputs for now as in CreateFundingSigsAlt
      if (fundingInput.dlcInput) {
        return;
      }

      if (accepterWitnessIndex < fundingSignatures.witnessElements.length) {
        const key = `${fundingInput.prevTx.txId.toString()}:${fundingInput.prevTxVout}`;
        witnessMap.set(
          key,
          fundingSignatures.witnessElements[accepterWitnessIndex],
        );
        accepterWitnessIndex++;
      }
    });

    // Add all inputs to PSBT with proper sequence values
    const originalTransaction = btTransaction.fromBuffer(
      dlcTxs.fundTx.serialize(),
    );

    for (const fundingInput of allFundingInputs) {
      const prevOut = fundingInput.prevTx.outputs[fundingInput.prevTxVout];

      // Use same script handling as CreateFundingSigsAlt
      const witnessUtxo = {
        script: prevOut.scriptPubKey.serialize().subarray(1),
        value: Number(prevOut.value.sats),
      };

      // Use sequence from the original transaction (same as CreateFundingSigsAlt)
      const originalInput = originalTransaction.ins.find(
        (input) =>
          input.hash.reverse().toString('hex') ===
            fundingInput.prevTx.txId.toString() &&
          input.index === fundingInput.prevTxVout,
      );
      const sequenceValue = originalInput
        ? originalInput.sequence
        : Number(fundingInput.sequence);

      psbt.addInput({
        hash: fundingInput.prevTx.txId.toString(),
        index: fundingInput.prevTxVout,
        sequence: sequenceValue,
        witnessUtxo,
      });
    }

    // Add all outputs from the funding transaction
    for (const output of originalTransaction.outs) {
      psbt.addOutput({
        address: address.fromOutputScript(output.script, network),
        value: output.value,
      });
    }

    // Finalize inputs with their witness data
    for (
      let inputIndex = 0;
      inputIndex < allFundingInputs.length;
      inputIndex++
    ) {
      const fundingInput = allFundingInputs[inputIndex];
      const inputKey = `${fundingInput.prevTx.txId.toString()}:${fundingInput.prevTxVout}`;

      const witnessElements = witnessMap.get(inputKey);
      if (witnessElements && witnessElements.length === 2) {
        // Skip DLC inputs for now as requested
        if (fundingInput.dlcInput) {
          continue;
        }

        // For P2WPKH inputs, finalize the input with witness data
        const signature = this.ensureDerSignature(witnessElements[0].witness);
        const publicKey = witnessElements[1].witness;

        // Try a simpler approach - let bitcoinjs-lib handle witness construction
        psbt.finalizeInput(inputIndex, () => ({
          finalScriptSig: Buffer.alloc(0),
          finalScriptWitness: Buffer.concat([
            Buffer.from([0x02]), // witness stack count
            Buffer.from([signature.length]),
            signature,
            Buffer.from([publicKey.length]),
            publicKey,
          ]),
        }));
      }
    }

    // Extract the final transaction
    const finalTx = psbt.extractTransaction();

    // Convert back to the expected Tx format
    return Tx.decode(StreamReader.fromBuffer(finalTx.toBuffer()));
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

    let finalCet: string;

    if (
      dlcOffer.contractInfo.contractInfoType === ContractInfoType.Single &&
      (dlcOffer.contractInfo as SingleContractInfo).contractDescriptor
        .contractDescriptorType === ContractDescriptorType.Enumerated
    ) {
      const contractDescriptor = (dlcOffer.contractInfo as SingleContractInfo)
        .contractDescriptor as EnumeratedDescriptor;

      // Handle different contract descriptor outcome formats
      const attestedOutcome = oracleAttestation.outcomes[0];

      const outcomeIndex = contractDescriptor.outcomes.findIndex((outcome) => {
        // Try direct string match first (for DDK2 test: '1', '2', '3')
        if (outcome.outcome === attestedOutcome) {
          return true;
        }

        // Try sha256 hash match (for other tests with hashed outcomes)
        const attestedOutcomeHash = sha256(
          Buffer.from(attestedOutcome, 'utf8'),
        ).toString('hex');
        return outcome.outcome === attestedOutcomeHash;
      });

      finalCet = this._ddk
        .signCet(
          this.convertTxToDdkTransaction(dlcTxs.cets[outcomeIndex]),
          isOfferer
            ? dlcAccept.cetAdaptorSignatures.sigs[outcomeIndex].encryptedSig
            : dlcSign.cetAdaptorSignatures.sigs[outcomeIndex].encryptedSig,
          oracleAttestation.signatures,
          Buffer.from(fundPrivateKey, 'hex'),
          isOfferer ? dlcAccept.fundingPubkey : dlcOffer.fundingPubkey,
          isOfferer ? dlcOffer.fundingPubkey : dlcAccept.fundingPubkey,
          this.getFundOutputValueSats(dlcTxs),
        )
        .rawBytes.toString('hex');
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

      finalCet = this._ddk
        .signCet(
          this.convertTxToDdkTransaction(dlcTxs.cets[outcomeIndex]),
          isOfferer
            ? dlcAccept.cetAdaptorSignatures.sigs[outcomeIndex].encryptedSig
            : dlcSign.cetAdaptorSignatures.sigs[outcomeIndex].encryptedSig,
          oracleSignatures,
          Buffer.from(fundPrivateKey, 'hex'),
          isOfferer ? dlcAccept.fundingPubkey : dlcOffer.fundingPubkey,
          isOfferer ? dlcOffer.fundingPubkey : dlcAccept.fundingPubkey,
          this.getFundOutputValueSats(dlcTxs),
        )
        .rawBytes.toString('hex');
    }

    // const finalCet = (await this.SignCet(signCetRequest)).hex;

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
          amount: Number(this.getFundOutputValueSats(dlcTxs)),
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
          amount: Number(this.getFundOutputValueSats(dlcTxs)),
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
   * @param fixedInputs Optional fixed inputs - can be Input[] for regular inputs or FundingInput[] for DLC inputs
   * @returns {Promise<DlcOffer>}
   */
  async createDlcOffer(
    contractInfo: ContractInfo,
    offerCollateralSatoshis: bigint,
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktime: number,
    fixedInputs?: Input[] | FundingInput[],
    inputSupplementationMode?: InputSupplementationMode,
  ): Promise<DlcOffer> {
    contractInfo.validate();
    const network = await this.getConnectedNetwork();

    const dlcOffer = new DlcOffer();

    // Generate a random 32-byte temporary contract ID
    dlcOffer.temporaryContractId = crypto.randomBytes(32);

    // Check if we have FundingInput[] (DLC inputs) or Input[] (regular inputs)
    const hasFundingInputs =
      fixedInputs && fixedInputs.length > 0 && 'prevTx' in fixedInputs[0]; // FundingInput has prevTx, Input doesn't

    let fundingPubKey: Buffer;
    let payoutSPK: Buffer;
    let payoutSerialId: bigint;
    let _fundingInputs: FundingInput[];
    let changeSPK: Buffer;
    let changeSerialId: bigint;

    if (hasFundingInputs) {
      // Handle FundingInput[] directly (for DLC inputs)
      const fundingInputs = fixedInputs as FundingInput[];

      // Generate addresses directly since we're bypassing Initialize()
      const payoutAddress: Address =
        await this.client.wallet.getUnusedAddress(false);
      payoutSPK = address.toOutputScript(payoutAddress.address, network);

      const changeAddress: Address =
        await this.client.wallet.getUnusedAddress(true);
      changeSPK = address.toOutputScript(changeAddress.address, network);

      const fundingAddress: Address =
        await this.client.wallet.getUnusedAddress(false);
      fundingPubKey = Buffer.from(fundingAddress.publicKey, 'hex');

      if (fundingAddress.address === payoutAddress.address)
        throw Error('Address reuse');

      payoutSerialId = generateSerialId();
      changeSerialId = generateSerialId();
      _fundingInputs = fundingInputs;
    } else {
      // Handle Input[] through existing Initialize() flow
      const initResult = await this.Initialize(
        offerCollateralSatoshis,
        feeRatePerVb,
        fixedInputs as Input[],
        inputSupplementationMode || InputSupplementationMode.Required,
      );

      fundingPubKey = initResult.fundingPubKey;
      payoutSPK = initResult.payoutSPK;
      payoutSerialId = initResult.payoutSerialId;
      _fundingInputs = initResult.fundingInputs;
      changeSPK = initResult.changeSPK;
      changeSerialId = initResult.changeSerialId;
    }

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

    if (offerCollateralSatoshis === dlcOffer.contractInfo.totalCollateral) {
      dlcOffer.markAsSingleFunded();
    }

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

  /**
   * Accept DLC Offer (supports single-funded DLCs when accept collateral is 0)
   * @param _dlcOffer Dlc Offer Message
   * @param fixedInputs Optional inputs to use for Funding Inputs
   * @returns {Promise<AcceptDlcOfferResponse}
   */
  async acceptDlcOffer(
    _dlcOffer: DlcOffer,
    fixedInputs?: Input[] | FundingInput[],
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

    let fundingPubKey: Buffer;
    let payoutSPK: Buffer;
    let payoutSerialId: bigint;
    let fundingInputs: FundingInput[];
    let changeSPK: Buffer;
    let changeSerialId: bigint;

    if (acceptCollateralSatoshis === BigInt(0)) {
      // Single-funded DLC: accept side provides no funding
      const network = await this.getConnectedNetwork();

      // Still need payout address for receiving DLC outcomes
      const payoutAddress: Address =
        await this.client.wallet.getUnusedAddress(false);
      payoutSPK = address.toOutputScript(payoutAddress.address, network);

      // Generate funding pubkey for DLC contract construction
      const fundingAddress: Address =
        await this.client.wallet.getUnusedAddress(false);
      fundingPubKey = Buffer.from(fundingAddress.publicKey, 'hex');

      // Generate change address (even though not used)
      const changeAddress: Address =
        await this.client.wallet.getUnusedAddress(true);
      changeSPK = address.toOutputScript(changeAddress.address, network);

      if (fundingAddress.address === payoutAddress.address)
        throw Error('Address reuse');

      // Generate serial IDs
      payoutSerialId = generateSerialId();
      changeSerialId = generateSerialId();

      // No funding inputs for single-funded DLC
      fundingInputs = [];
    } else {
      // Standard DLC: accept side provides funding

      // Check if we have FundingInput[] (DLC inputs) or Input[] (regular inputs)
      const hasFundingInputs =
        fixedInputs && fixedInputs.length > 0 && 'prevTx' in fixedInputs[0]; // FundingInput has prevTx, Input doesn't

      let initResult: InitializeResponse;

      if (hasFundingInputs) {
        // Handle FundingInput[] directly (for DLC inputs)
        const fundingInputs = fixedInputs as FundingInput[];
        const network = await this.getConnectedNetwork();

        // Generate addresses directly since we're bypassing Initialize()
        const payoutAddress: Address =
          await this.client.wallet.getUnusedAddress(false);
        const payoutSPK = address.toOutputScript(
          payoutAddress.address,
          network,
        );

        const changeAddress: Address =
          await this.client.wallet.getUnusedAddress(true);
        const changeSPK = address.toOutputScript(
          changeAddress.address,
          network,
        );

        const fundingAddress: Address =
          await this.client.wallet.getUnusedAddress(false);
        const fundingPubKey = Buffer.from(fundingAddress.publicKey, 'hex');

        if (fundingAddress.address === payoutAddress.address)
          throw Error('Address reuse');

        const payoutSerialId = generateSerialId();
        const changeSerialId = generateSerialId();

        initResult = {
          fundingPubKey,
          payoutSPK,
          payoutSerialId,
          fundingInputs,
          changeSPK,
          changeSerialId,
        };
      } else {
        // Handle Input[] through existing Initialize() flow
        // Use InputSupplementationMode.None when fixed inputs are provided
        // to avoid wallet lookup issues with unusual addresses
        const supplementationMode =
          fixedInputs && fixedInputs.length > 0
            ? InputSupplementationMode.None
            : InputSupplementationMode.Required;

        initResult = await this.Initialize(
          acceptCollateralSatoshis,
          dlcOffer.feeRatePerVb,
          fixedInputs as Input[],
          supplementationMode,
        );
      }

      fundingPubKey = initResult.fundingPubKey;
      payoutSPK = initResult.payoutSPK;
      payoutSerialId = initResult.payoutSerialId;
      changeSPK = initResult.changeSPK;
      changeSerialId = initResult.changeSerialId;

      const _fundingInputs = initResult.fundingInputs;

      _fundingInputs.forEach((input) =>
        assert(
          input.type === MessageType.FundingInput,
          'FundingInput must be V0',
        ),
      );

      fundingInputs = _fundingInputs.map((input) => input as FundingInput);

      fundingInputs.sort(
        (a, b) => Number(a.inputSerialId) - Number(b.inputSerialId),
      );
    }

    assert(
      Buffer.compare(dlcOffer.fundingPubkey, fundingPubKey) !== 0,
      'DlcOffer and DlcAccept FundingPubKey cannot be the same',
    );

    const dlcAccept = new DlcAccept();

    dlcAccept.temporaryContractId = sha256(dlcOffer.serialize());
    dlcAccept.acceptCollateral = acceptCollateralSatoshis;
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

    if (dlcOffer.singleFunded) dlcAccept.markAsSingleFunded();

    dlcAccept.validate();

    // Only validate funding requirements if accept side is providing collateral
    if (acceptCollateralSatoshis > BigInt(0)) {
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
    }

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

    const contractId = this.computeContractId(
      _dlcTransactions.fundTx.txId.serialize(),
      _dlcTransactions.fundTxVout,
      dlcAccept.temporaryContractId,
    );
    _dlcTransactions.contractId = contractId;

    dlcAccept.cetAdaptorSignatures = cetSignatures;
    dlcAccept.refundSignature = refundSignature;

    return { dlcAccept, dlcTransactions: _dlcTransactions };
  }

  /**
   * Sign Dlc Accept Message
   * @param _dlcOffer Dlc Offer Message
   * @param _dlcAccept Dlc Accept Message
   * @returns {Promise<SignDlcAcceptResponse}
   */
  async signDlcAccept(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
  ): Promise<SignDlcAcceptResponse> {
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

    const fundingSignatures = await this.CreateFundingSigsAlt(
      dlcOffer,
      dlcAccept,
      dlcTransactions,
      true,
    );

    const dlcTxs = dlcTransactions;

    const contractId = this.computeContractId(
      dlcTxs.fundTx.txId.serialize(),
      dlcTxs.fundTxVout,
      dlcAccept.temporaryContractId,
    );

    assert(
      Buffer.compare(
        contractId,
        this.computeContractId(
          dlcTxs.fundTx.txId.serialize(),
          dlcTxs.fundTxVout,
          dlcAccept.temporaryContractId,
        ),
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

    await this.VerifyFundingSigsAlt(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
      false,
    );

    const fundingSignatures = await this.CreateFundingSigsAlt(
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
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @param dlcSign Dlc Sign Message
   * @param dlcTxs Dlc Transactions message
   * @returns {Promise<Tx>}
   */
  async refund(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
  ): Promise<Tx> {
    const network = await this.getConnectedNetwork();
    const psbt = new Psbt({ network });

    // Verify refund transaction locktime matches expected
    if (Number(dlcTxs.refundTx.locktime) !== dlcOffer.refundLocktime) {
      throw new Error(
        `Refund transaction locktime ${dlcTxs.refundTx.locktime} does not match expected ${dlcOffer.refundLocktime}`,
      );
    }

    // Create the same funding script as createDlcClose
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

    // Add the funding input with sequence from refund transaction
    psbt.addInput({
      hash: dlcTxs.fundTx.txId.serialize(),
      index: dlcTxs.fundTxVout,
      sequence: Number(dlcTxs.refundTx.inputs[0].sequence),
      witnessUtxo: {
        script: paymentVariant.output,
        value: Number(this.getFundOutputValueSats(dlcTxs)),
      },
      witnessScript: paymentVariant.redeem.output,
    });

    // Add all refund outputs - refund transaction should have 2 outputs (offerer and accepter)
    dlcTxs.refundTx.outputs.forEach((refundOutput) => {
      psbt.addOutput({
        address: address.fromOutputScript(
          refundOutput.scriptPubKey.serialize().subarray(1),
          network,
        ),
        value: Number(refundOutput.value.sats),
      });
    });

    // Set the locktime to match the refund transaction
    psbt.setLocktime(Number(dlcTxs.refundTx.locktime));

    // Add both refund signatures as partial signatures
    // Map signatures to their correct pubkeys based on sorted order
    const partialSigs = [];

    // Determine which signature belongs to which pubkey
    for (const pubkey of fundingPubKeys) {
      if (Buffer.compare(pubkey, dlcOffer.fundingPubkey) === 0) {
        // This is the offerer's pubkey, use dlcSign.refundSignature
        partialSigs.push({
          pubkey: pubkey,
          signature: this.ensureDerSignature(dlcSign.refundSignature),
        });
      } else if (Buffer.compare(pubkey, dlcAccept.fundingPubkey) === 0) {
        // This is the accepter's pubkey, use dlcAccept.refundSignature
        partialSigs.push({
          pubkey: pubkey,
          signature: this.ensureDerSignature(dlcAccept.refundSignature),
        });
      }
    }

    psbt.updateInput(0, {
      partialSig: partialSigs,
    });

    // Validate all signatures
    psbt.validateSignaturesOfInput(
      0,
      (pubkey: Buffer, msghash: Buffer, signature: Buffer) => {
        return ecc.verify(msghash, pubkey, signature);
      },
    );

    // Finalize the input - this will create the final witness script
    psbt.finalizeInput(0);

    // Extract the final transaction
    const finalTx = psbt.extractTransaction();

    // Verify that our PSBT matches the expected refund transaction
    const expectedRefundTxId = dlcTxs.refundTx.txId.serialize().toString('hex');
    const psbtTxId = finalTx.getHash().toString('hex');
    if (psbtTxId !== expectedRefundTxId) {
      throw new Error(
        `PSBT transaction ID ${psbtTxId} does not match expected refund transaction ID ${expectedRefundTxId}`,
      );
    }

    // Convert to the expected Tx format
    return Tx.decode(StreamReader.fromBuffer(finalTx.toBuffer()));
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
      const tempInputs = await this.GetInputsForAmountWithMode(
        [BigInt(20000)],
        dlcOffer.feeRatePerVb,
        _inputs || [],
        InputSupplementationMode.Required,
      );
      _inputs = tempInputs;
    }
    // Ensure all inputs have derivation paths by fetching from wallet
    const inputsWithPaths: { input: Input; address: Address }[] =
      await Promise.all(
        _inputs.map(async (input) => {
          const address: Address = await this.getMethod('getWalletAddress')(
            input.address,
          );
          const inputWithPath = new Input(
            input.txid,
            input.vout,
            input.address,
            input.amount,
            input.value,
            input.derivationPath || address.derivationPath, // Use derivationPath from wallet if not set
            input.maxWitnessLength,
            input.redeemScript,
            input.inputSerialId || generateSerialId(),
            input.scriptPubKey,
            input.label,
            input.confirmations,
            input.spendable,
            input.solvable,
            input.safe,
            input.dlcInput,
          );
          return { input: inputWithPath, address };
        }),
      );

    inputs = inputsWithPaths.map((item) => item.input);
    const pubkeys: Buffer[] = inputsWithPaths.map((item) =>
      Buffer.from(item.address.publicKey, 'hex'),
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
        value: Number(this.getFundOutputValueSats(dlcTxs)),
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
        if (!input.derivationPath) {
          throw new Error(`Missing derivation path for input ${i}`);
        }
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
      this.ensureBuffer(
        psbt.data.inputs[fundingInputIndex].partialSig[0].signature,
      ),
    ).signature;

    // Extract funding signatures from psbt
    const inputSigs = psbt.data.inputs
      .filter((input) => input !== fundingInputIndex)
      .map((input) => input.partialSig[0]);

    // create fundingSignatures
    const witnessElements: ScriptWitnessV0[][] = [];
    for (let i = 0; i < inputSigs.length; i++) {
      const sigWitness = new ScriptWitnessV0();
      sigWitness.witness = this.ensureBuffer(inputSigs[i].signature);
      const pubKeyWitness = new ScriptWitnessV0();
      pubKeyWitness.witness = this.ensureBuffer(inputSigs[i].pubkey);
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
        value: Number(this.getFundOutputValueSats(dlcTxs)),
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
        signature: script.signature.encode(dlcClose.closeSignature, 1), // encode using SIGHASH_ALL
      },
    ];
    psbt.updateInput(fundingInputIndex, { partialSig });

    for (let i = 0; i < psbt.data.inputs.length; ++i) {
      if (i === fundingInputIndex) continue;
      if (!psbt.data.inputs[i].partialSig) psbt.data.inputs[i].partialSig = [];

      const witnessI = dlcClose.fundingSignatures.witnessElements.findIndex(
        (el) =>
          Buffer.compare(
            Script.p2wpkhLock(hash160(el[1].witness)).serialize().subarray(1),
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

  async fundingInputToInput(
    _input: FundingInput,
    findDerivationPath = true,
  ): Promise<Input> {
    assert(_input.type === MessageType.FundingInput, 'FundingInput must be V0');
    const network = await this.getConnectedNetwork();
    const input = _input as FundingInput;
    const prevTx = input.prevTx;
    const prevTxOut = prevTx.outputs[input.prevTxVout];
    const scriptPubKey = prevTxOut.scriptPubKey.serialize().subarray(1);
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

    // Check if this FundingInput has DLC input information to preserve
    const dlcInputMessage = input.dlcInput;

    let dlcInputInfo: DlcInputInfo | undefined;
    if (dlcInputMessage) {
      dlcInputInfo = {
        localFundPubkey: dlcInputMessage.localFundPubkey.toString('hex'),
        remoteFundPubkey: dlcInputMessage.remoteFundPubkey.toString('hex'),
        contractId: dlcInputMessage.contractId.toString('hex'),
      };
    }

    return new Input(
      prevTx.txId.toString(),
      input.prevTxVout,
      _address,
      prevTxOut.value.bitcoin,
      Number(prevTxOut.value.sats),
      derivationPath,
      input.maxWitnessLen,
      input.redeemScript ? input.redeemScript.toString('hex') : '',
      input.inputSerialId,
      scriptPubKey.toString('hex'),
      undefined, // label
      undefined, // confirmations
      undefined, // spendable
      undefined, // solvable
      undefined, // safe
      dlcInputInfo, // Preserve DLC input information if present
    );
  }

  async inputToFundingInput(input: Input): Promise<FundingInput> {
    const fundingInput = new FundingInput();
    fundingInput.prevTxVout = input.vout;

    let txRaw = '';
    try {
      txRaw = await this.getMethod('getRawTransactionByHash')(input.txid);
    } catch {
      try {
        txRaw = (await this.getMethod('jsonrpc')('gettransaction', input.txid))
          .hex;
      } catch {
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

    // Preserve DLC input information if present
    if (input.isDlcInput()) {
      const dlcInputInfo = input.dlcInput!;
      const dlcInput = new DlcInput();
      dlcInput.localFundPubkey = Buffer.from(
        dlcInputInfo.localFundPubkey,
        'hex',
      );
      dlcInput.remoteFundPubkey = Buffer.from(
        dlcInputInfo.remoteFundPubkey,
        'hex',
      );
      dlcInput.contractId = Buffer.alloc(32); // Placeholder contract ID

      fundingInput.dlcInput = dlcInput;
    }

    return fundingInput;
  }

  async getConnectedNetwork(): Promise<BitcoinNetwork> {
    return this._network;
  }

  /**
   * Convert BitcoinNetwork to bitcoinjs-lib network format
   */
  private getBitcoinJsNetwork(): any {
    const network = this._network;
    if (network.name === 'bitcoin') {
      return networks.bitcoin;
    } else if (network.name === 'testnet') {
      return networks.testnet;
    } else if (network.name === 'regtest') {
      return networks.regtest;
    } else {
      // Default to mainnet if unknown
      return networks.bitcoin;
    }
  }

  /**
   * Calculate the maximum collateral possible with given inputs
   * @param inputs Array of Input objects to use for funding
   * @param feeRatePerVb Fee rate in satoshis per virtual byte
   * @param contractCount Number of DLC contracts (default: 1)
   * @returns Maximum collateral amount in satoshis
   */
  async calculateMaxCollateral(
    inputs: Input[],
    feeRatePerVb: bigint,
    contractCount: number = 1,
  ): Promise<bigint> {
    if (inputs.length === 0) {
      return BigInt(0);
    }

    try {
      // Convert Input[] to FundingInput[]
      const fundingInputs = await Promise.all(
        inputs.map((input) => this.inputToFundingInput(input)),
      );

      // Use node-dlc's calculateMaxCollateral function
      // For single-funded DLC, pass only offerer inputs and fee rate
      return BatchDlcTxBuilder.calculateMaxCollateral(
        fundingInputs,
        feeRatePerVb,
        contractCount,
      );
    } catch (error) {
      // If calculation fails, return 0 to indicate insufficient funds
      console.warn('calculateMaxCollateral failed:', error);
      return BigInt(0);
    }
  }

  /**
   * Create a funding input with DLC input information for splicing
   * @param dlcInputInfo DLC input information
   * @param fundingTxHex Raw transaction hex of the funding transaction
   */
  async createDlcFundingInput(
    dlcInputInfo: DlcInputInfoRequest,
    fundingTxHex: string,
  ): Promise<FundingInput> {
    const fundingInput = new FundingInput();
    const tx = Tx.decode(StreamReader.fromHex(fundingTxHex));

    fundingInput.prevTx = tx;
    fundingInput.prevTxVout = dlcInputInfo.fundVout;
    fundingInput.sequence = Sequence.default();
    fundingInput.maxWitnessLen = dlcInputInfo.maxWitnessLength || 220;
    fundingInput.redeemScript = Buffer.from('', 'hex'); // Empty for P2WSH
    fundingInput.inputSerialId = BigInt(
      dlcInputInfo.inputSerialId || generateSerialId(),
    );

    // Create the DLC multisig script for address generation
    const localPubkey = Buffer.from(dlcInputInfo.localFundPubkey, 'hex');
    const remotePubkey = Buffer.from(dlcInputInfo.remoteFundPubkey, 'hex');

    // Use the same deterministic ordering as cfd-dlc-js: lexicographic by hex
    // This matches GetOrderedPubkeys() in cfddlc_transactions.cpp
    const orderedPubkeys =
      dlcInputInfo.localFundPubkey < dlcInputInfo.remoteFundPubkey
        ? [localPubkey, remotePubkey]
        : [remotePubkey, localPubkey];

    const network = await this.getConnectedNetwork();

    // Create 2-of-2 multisig payment using deterministic ordering
    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: orderedPubkeys,
      network,
    });

    const paymentVariant = payments.p2wsh({
      redeem: p2ms,
      network,
    });

    const multisigAddress = paymentVariant.address!;

    // Verify this matches the actual funding output address
    const actualFundingOutput = tx.outputs[dlcInputInfo.fundVout];
    const actualFundingAddress = address.fromOutputScript(
      actualFundingOutput.scriptPubKey.serialize().subarray(1),
      network,
    );

    if (actualFundingAddress !== multisigAddress) {
      throw new Error(
        `DLC funding address mismatch. ` +
          `Expected: ${actualFundingAddress}, ` +
          `Constructed: ${multisigAddress}`,
      );
    }

    // Add toUtxo method that's expected by GetInputsForAmount
    (fundingInput as FundingInput & { toUtxo: () => Utxo }).toUtxo = () => {
      return new Utxo(
        dlcInputInfo.fundTxid,
        dlcInputInfo.fundVout,
        Amount.FromSatoshis(Number(dlcInputInfo.fundAmount)),
        multisigAddress,
        dlcInputInfo.maxWitnessLength || 220,
        undefined, // DLC inputs don't have derivation paths
        fundingInput.inputSerialId,
      );
    };

    // Create proper DlcInput object for splicing detection and signing
    const dlcInput = new DlcInput();
    dlcInput.localFundPubkey = Buffer.from(dlcInputInfo.localFundPubkey, 'hex');
    dlcInput.remoteFundPubkey = Buffer.from(
      dlcInputInfo.remoteFundPubkey,
      'hex',
    );
    dlcInput.contractId = Buffer.from(dlcInputInfo.contractId, 'hex');

    fundingInput.dlcInput = dlcInput;

    return fundingInput;
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
