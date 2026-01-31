import Provider from '@atomicfinance/provider';
import {
  DdkInterface,
  DdkOracleInfo,
  DdkTransaction,
  Messages,
  WalletProvider,
} from '@atomicfinance/types';
import { Sequence, Tx } from '@node-dlc/bitcoin';
import { StreamReader } from '@node-dlc/bufio';
import {
  CetAdaptorSignatures,
  ContractDescriptorType,
  ContractInfo,
  ContractInfoType,
  DlcAccept,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  EnumeratedDescriptor,
  EnumEventDescriptor,
  FundingInput,
  FundingSignatures,
  MessageType,
  OracleInfo,
  ScriptWitnessV0,
  SingleContractInfo,
  SingleOracleInfo,
} from '@node-dlc/messaging';
import { chainHashFromNetwork } from 'bitcoin-network';
import { BitcoinNetwork, BitcoinNetworks } from 'bitcoin-network';
import {
  address,
  crypto as bitcoinCrypto,
  payments,
  Psbt,
  Transaction as btTransaction,
} from 'bitcoinjs-lib';

import {
  AddressPurpose,
  BitcoinSatsConnectProviderOptions,
  SatsConnectAddress,
  SatsConnectWalletAddress,
  SignDlcResult,
  WalletInterface,
} from './types';

/**
 * Bitcoin provider that integrates with SatsConnect-compatible wallets
 * (including Fordefi and our local FordefiWalletEmulator).
 *
 * This provider handles DLC operations including:
 * - Creating DLC offers
 * - Signing DLC accepts (funding, refund, and CET adaptor signatures)
 * - CET execution signing
 */
export class BitcoinSatsConnectProvider
  extends Provider
  implements Partial<WalletProvider>
{
  private wallet: WalletInterface;
  private network: BitcoinNetwork;
  private _ddk: DdkInterface;

  constructor(
    options: BitcoinSatsConnectProviderOptions & { ddk: DdkInterface },
  ) {
    super();

    if (!options.wallet) {
      throw new Error(
        'wallet is required - pass a WalletInterface implementation',
      );
    }

    if (!options.ddk) {
      throw new Error('ddk is required - pass a DdkInterface implementation');
    }

    this.wallet = options.wallet;
    this.network = options.network ?? BitcoinNetworks.bitcoin_testnet;
    this._ddk = options.ddk;
  }

  /**
   * Get addresses from the wallet.
   * @return {Promise<Address[]>} Resolves with a list of addresses.
   */
  async getAddresses(): Promise<SatsConnectAddress[]> {
    try {
      const response = await this.wallet.request<{
        addresses: SatsConnectWalletAddress[];
      }>('getAddresses', {
        purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
      });

      if (response.status === 'error') {
        throw new Error(
          `Wallet error: ${response.error?.message || 'Unknown error'}`,
        );
      }

      if (!response.result?.addresses) {
        throw new Error('No addresses returned from wallet');
      }

      // Convert wallet addresses to our Address format
      return response.result.addresses
        .filter(
          (addr: SatsConnectWalletAddress) =>
            addr.purpose === AddressPurpose.Payment ||
            addr.purpose === AddressPurpose.Ordinals,
        )
        .map(
          (addr: SatsConnectWalletAddress): SatsConnectAddress => ({
            address: addr.address,
            publicKey: addr.publicKey,
            derivationPath: addr.derivationPath,
            purpose: addr.purpose,
          }),
        );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get addresses from wallet: ${errorMessage}`);
    }
  }

  /**
   * Get a specific address by purpose
   * @param purpose - The address purpose to filter by
   * @return {Promise<Address | undefined>} Resolves with the address if found
   */
  async getAddressByPurpose(
    purpose: AddressPurpose,
  ): Promise<SatsConnectAddress | undefined> {
    const addresses = await this.getAddresses();
    return addresses.find((addr) => addr.purpose === purpose);
  }

  /**
   * Get payment address (first payment address)
   * @return {Promise<SatsConnectAddress>} Resolves with payment address
   */
  async getPaymentAddress(): Promise<SatsConnectAddress> {
    const addr = await this.getAddressByPurpose(AddressPurpose.Payment);
    if (!addr) {
      throw new Error('No payment address available from wallet');
    }
    return addr;
  }

  /**
   * Get ordinals address (first ordinals address)
   * @return {Promise<SatsConnectAddress>} Resolves with ordinals address
   */
  async getOrdinalsAddress(): Promise<SatsConnectAddress> {
    const addr = await this.getAddressByPurpose(AddressPurpose.Ordinals);
    if (!addr) {
      throw new Error('No ordinals address available from wallet');
    }
    return addr;
  }

  /**
   * Check if the wallet is connected
   * @return {Promise<boolean>} True if the wallet is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      const response = await this.wallet.request(
        'wallet_getAccount',
        undefined,
      );
      return response.status === 'success';
    } catch {
      return false;
    }
  }

  /**
   * Create a DLC Offer
   * @param contractInfo - Contract information from @node-dlc/messaging
   * @param offerCollateralSatoshis - Amount the offerer is putting into the contract
   * @param feeRatePerVb - Fee rate in satoshis per virtual byte
   * @param cetLocktime - The nLockTime to be put on CETs
   * @param refundLocktime - The nLockTime to be put on the refund transaction
   * @param fixedInputs - Optional fixed inputs to use for funding
   * @return {Promise<DlcOffer>} Resolves with a DLC offer object
   */
  async createDlcOffer(
    contractInfo: ContractInfo,
    offerCollateralSatoshis: bigint,
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktime: number,
    fixedInputs?: {
      txid: string;
      vout: number;
      value: number;
      txHex?: string;
    }[],
  ): Promise<DlcOffer> {
    try {
      // Validate contract info
      contractInfo.validate();

      if (offerCollateralSatoshis <= 0n) {
        throw new Error('Offer collateral must be greater than 0');
      }

      if (offerCollateralSatoshis > contractInfo.totalCollateral) {
        throw new Error(
          'Offer collateral cannot exceed total contract collateral',
        );
      }

      // Get payment address from wallet
      const paymentAddress = await this.getPaymentAddress();

      // Create the DLC offer
      const dlcOffer = new DlcOffer();

      // Generate a random temporary contract ID
      dlcOffer.temporaryContractId = Buffer.from(
        this.generateRandomHex(32),
        'hex',
      );
      dlcOffer.contractInfo = contractInfo;
      dlcOffer.fundingPubkey = Buffer.from(paymentAddress.publicKey, 'hex');
      dlcOffer.payoutSpk = address.toOutputScript(
        paymentAddress.address,
        this.network,
      );
      dlcOffer.payoutSerialId = this.generateSerialId();
      dlcOffer.offerCollateral = offerCollateralSatoshis;

      // Get funding inputs - either use provided inputs or get from wallet
      if (!fixedInputs || fixedInputs.length === 0) {
        throw new Error('fixedInputs are required for createDlcOffer');
      }

      // Create funding inputs from provided UTXOs
      dlcOffer.fundingInputs = await Promise.all(
        fixedInputs.map(async (input, index) => {
          // Get txHex if not provided
          let txHex = input.txHex;
          if (!txHex) {
            txHex = await this.getMethod('getRawTransactionByHash')(input.txid);
          }

          const tx = Tx.decode(StreamReader.fromHex(txHex));
          const fundingInput = new FundingInput();
          fundingInput.inputSerialId = BigInt(index + 1);
          fundingInput.prevTx = tx;
          fundingInput.prevTxVout = input.vout;
          fundingInput.sequence = Sequence.default();
          fundingInput.maxWitnessLen = 108; // Standard witness length for P2WPKH
          fundingInput.redeemScript = Buffer.from('', 'hex');
          return fundingInput;
        }),
      );

      dlcOffer.changeSpk = address.toOutputScript(
        paymentAddress.address,
        this.network,
      );
      dlcOffer.changeSerialId = this.generateSerialId();
      dlcOffer.fundOutputSerialId = this.generateSerialId();
      dlcOffer.feeRatePerVb = feeRatePerVb;
      dlcOffer.cetLocktime = cetLocktime;
      dlcOffer.refundLocktime = refundLocktime;
      dlcOffer.contractFlags = Buffer.from('00', 'hex');
      dlcOffer.chainHash = chainHashFromNetwork(this.network);

      return dlcOffer;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create DLC offer: ${errorMessage}`);
    }
  }

  /**
   * Helper function to generate random hex string
   */
  private generateRandomHex(length: number): string {
    const bytes = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes.toString('hex');
  }

  /**
   * Helper function to generate a serial ID
   */
  private generateSerialId(): bigint {
    return BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  }

  /**
   * Convert Tx to DDK Transaction format
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

  /**
   * Get fund output value from DLC transactions
   */
  private getFundOutputValueSats(dlcTxs: DlcTransactions): bigint {
    const fundOutput = dlcTxs.fundTx.outputs[dlcTxs.fundTxVout];
    if (!fundOutput || !fundOutput.value) {
      throw new Error(`Invalid fund output at vout ${dlcTxs.fundTxVout}`);
    }
    return fundOutput.value.sats;
  }

  /**
   * Create 2-of-2 multisig script (not wrapped in P2WSH)
   */
  private createP2MSMultisig(pubkey1: Buffer, pubkey2: Buffer) {
    const orderedPubkeys =
      Buffer.compare(pubkey1, pubkey2) === -1
        ? [pubkey1, pubkey2]
        : [pubkey2, pubkey1];

    return payments.p2ms({
      m: 2,
      pubkeys: orderedPubkeys,
      network: this.network,
    });
  }

  /**
   * Compute tagged attestation message (SHA256 with DLC/attestation tag)
   */
  private computeTaggedAttestationMessage(outcome: string): string {
    const tag = 'DLC/oracle/attestation/v0';
    const tagHash = bitcoinCrypto.sha256(Buffer.from(tag, 'utf8'));
    const message = Buffer.concat([
      tagHash,
      tagHash,
      Buffer.from(outcome, 'utf8'),
    ]);
    return bitcoinCrypto.sha256(message).toString('hex');
  }

  /**
   * Convert messages to DDK format (Buffer[][][])
   */
  private convertMessagesForDdk(messagesList: Messages[]): Buffer[][][] {
    return messagesList.map((message) => [
      message.messages.map((m) => {
        return Buffer.from(this.computeTaggedAttestationMessage(m), 'hex');
      }),
    ]);
  }

  /**
   * Get payouts and messages from enumerated contract descriptor
   *
   * IMPORTANT: Messages must come from the oracle event's outcomes (raw strings),
   * NOT from the contract descriptor's outcomes (which may be hashed).
   * The DDK provider uses GenerateEnumMessages which gets outcomes from
   * oracleEvent.eventDescriptor.outcomes, and we must match that.
   */
  private getPayoutsFromEnumeratedDescriptor(
    _dlcOffer: DlcOffer,
    contractDescriptor: EnumeratedDescriptor,
    oracleInfo: OracleInfo,
    totalCollateral: bigint,
  ): {
    payouts: Array<{ offer: bigint; accept: bigint }>;
    messagesList: Messages[];
  } {
    const payouts: Array<{ offer: bigint; accept: bigint }> = [];
    const messagesList: Messages[] = [];

    // Get raw outcome strings from the oracle event (like DDK provider does)
    // The contract descriptor outcomes may be hashed, but the oracle event has raw strings
    let oracleOutcomes: string[];
    if (oracleInfo.type === MessageType.SingleOracleInfo) {
      const singleOracleInfo = oracleInfo as SingleOracleInfo;
      const eventDescriptor = singleOracleInfo.announcement.oracleEvent
        .eventDescriptor as EnumEventDescriptor;
      oracleOutcomes = eventDescriptor.outcomes;
    } else {
      throw new Error('Only SingleOracleInfo is supported');
    }

    // For each outcome in the contract, create payout and message
    // Use oracle event outcomes for messages (raw strings that DDK will hash)
    for (let i = 0; i < contractDescriptor.outcomes.length; i++) {
      const outcomeInfo = contractDescriptor.outcomes[i];
      const offerPayout = outcomeInfo.localPayout;
      const acceptPayout = totalCollateral - offerPayout;

      payouts.push({ offer: offerPayout, accept: acceptPayout });
      // Use oracle event outcome (raw string) instead of contract descriptor outcome
      messagesList.push({ messages: [oracleOutcomes[i]] });
    }

    return { payouts, messagesList };
  }

  /**
   * Get payouts and messages from contract info
   */
  private getPayoutsFromContractInfo(dlcOffer: DlcOffer): {
    payouts: Array<{ offer: bigint; accept: bigint }>;
    messagesList: Messages[];
  } {
    const contractInfo = dlcOffer.contractInfo;
    const totalCollateral = contractInfo.totalCollateral;

    if (contractInfo.contractInfoType === ContractInfoType.Single) {
      const singleContractInfo = contractInfo as SingleContractInfo;
      const contractDescriptor = singleContractInfo.contractDescriptor;
      const oracleInfo = singleContractInfo.oracleInfo;

      if (
        contractDescriptor.contractDescriptorType ===
        ContractDescriptorType.Enumerated
      ) {
        return this.getPayoutsFromEnumeratedDescriptor(
          dlcOffer,
          contractDescriptor as EnumeratedDescriptor,
          oracleInfo,
          totalCollateral,
        );
      }
    }

    throw new Error(
      'Only SingleContractInfo with EnumeratedDescriptor is supported',
    );
  }

  /**
   * Get oracle info in DDK format
   */
  private getOracleInfoForDdk(dlcOffer: DlcOffer): DdkOracleInfo[] {
    const contractInfo = dlcOffer.contractInfo;

    if (contractInfo.contractInfoType === ContractInfoType.Single) {
      const singleContractInfo = contractInfo as SingleContractInfo;
      const oracleInfo = singleContractInfo.oracleInfo;

      if (oracleInfo.type === MessageType.SingleOracleInfo) {
        const singleOracleInfo = oracleInfo as SingleOracleInfo;
        const announcement = singleOracleInfo.announcement;

        return [
          {
            publicKey: announcement.oraclePublicKey,
            nonces: announcement.oracleEvent.oracleNonces,
          },
        ];
      }
    }

    throw new Error('Only SingleOracleInfo is supported');
  }

  /**
   * Sign DLC Accept using wallet (following DDK signDlcAccept pattern)
   * @param dlcOffer - The DLC offer
   * @param dlcAccept - The DLC accept message (optional, will use acceptDlcOffer response internally)
   * @param dlcTransactions - The DLC transactions (optional, will use acceptDlcOffer response internally)
   * @return {Promise<SignDlcAcceptResponse>} The DLC sign message with transactions
   */
  async signDlcAccept(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTransactions?: DlcTransactions,
  ): Promise<{ dlcSign: DlcSign; dlcTransactions: DlcTransactions }> {
    // If dlcTransactions is not provided, we still need it
    if (!dlcTransactions) {
      throw new Error('dlcTransactions is required for SatsConnectProvider');
    }
    try {
      // Validate inputs
      dlcOffer.validate();
      dlcAccept.validate();

      if (
        Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === 0
      ) {
        throw new Error(
          'DlcOffer and DlcAccept FundingPubKey cannot be the same',
        );
      }

      // Create DLC sign message
      const dlcSign = new DlcSign();

      // Compute contract ID using funding transaction details
      const fundTxId = dlcTransactions.fundTx.txId.serialize();
      const fundOutputIndex = dlcTransactions.fundTxVout;
      const temporaryContractId = dlcOffer.temporaryContractId;

      // Contract ID computation (same as computeContractId in Utils.ts):
      // 1. XOR fund_tx_id with temporary_id, with byte order reversal for fund_tx_id
      // 2. XOR the fund output index into the last two bytes
      const contractId = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        contractId[i] = fundTxId[31 - i] ^ temporaryContractId[i];
      }
      // XOR the fund output index into the last two bytes
      contractId[30] ^= (fundOutputIndex >> 8) & 0xff; // High byte
      contractId[31] ^= fundOutputIndex & 0xff; // Low byte
      dlcSign.contractId = contractId;

      // Create PSBTs for all transactions
      const fundingPsbt = this.createFundingPsbt(
        dlcOffer,
        dlcAccept,
        dlcTransactions,
      );
      const refundPsbt = this.createRefundPsbt(
        dlcOffer,
        dlcAccept,
        dlcTransactions,
      );

      // Create CET PSBTs
      const cetPsbts: Psbt[] = [];
      const numCets = dlcTransactions.cets?.length || 0;
      for (let i = 0; i < numCets; i++) {
        const cetPsbt = this.createCetPsbt(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          i,
        );
        cetPsbts.push(cetPsbt);
      }

      // Get our addresses to determine which inputs we can sign
      const addresses = await this.getAddresses();
      const firstAddress = addresses[0]?.address;

      if (!firstAddress) {
        throw new Error('No wallet address available for signing');
      }

      // Find which inputs belong to our wallet for funding transaction
      const allFundingInputs = [
        ...dlcOffer.fundingInputs,
        ...dlcAccept.fundingInputs,
      ];
      allFundingInputs.sort(
        (a, b) => Number(a.inputSerialId) - Number(b.inputSerialId),
      );

      // Create a set of offerer input serial IDs for quick lookup
      const offererInputSerialIds = new Set(
        dlcOffer.fundingInputs.map((input) => input.inputSerialId.toString()),
      );

      // Find PSBT indexes that correspond to offerer inputs
      const ourFundingInputIndexes: number[] = [];
      allFundingInputs.forEach((input, psbtIndex) => {
        if (offererInputSerialIds.has(input.inputSerialId.toString())) {
          ourFundingInputIndexes.push(psbtIndex);
        }
      });

      // Get DDK params for adaptor signature creation
      const { messagesList } = this.getPayoutsFromContractInfo(dlcOffer);
      const oracleInfo = this.getOracleInfoForDdk(dlcOffer);
      const p2ms = this.createP2MSMultisig(
        dlcOffer.fundingPubkey,
        dlcAccept.fundingPubkey,
      );
      const fundingScriptPubkey = p2ms.output!;
      const fundOutputValue = this.getFundOutputValueSats(dlcTransactions);

      // Convert CETs to DDK format
      const cetsForDdk = dlcTransactions.cets.map((cet) =>
        this.convertTxToDdkTransaction(cet),
      );

      // Convert messages to DDK format
      const messagesForDdk = this.convertMessagesForDdk(messagesList);

      // Create adaptor points for backward compatibility (not used by emulator)
      const adaptorPoints = cetPsbts.map(() => '00'.repeat(33));

      const params = {
        fundingTransaction: {
          psbt: fundingPsbt.toBase64(),
          signInputs:
            ourFundingInputIndexes.length > 0
              ? { [firstAddress]: ourFundingInputIndexes }
              : undefined,
        },
        refundTransaction: {
          psbt: refundPsbt.toBase64(),
          signInputs: { [firstAddress]: [0] },
        },
        cetTransactions: cetPsbts.map((cetPsbt, index) => ({
          psbt: cetPsbt.toBase64(),
          adaptorPoint: adaptorPoints[index],
        })),
        // DDK params for adaptor signature creation
        cets: cetsForDdk,
        oracleInfo: oracleInfo,
        fundingScriptPubkey: fundingScriptPubkey,
        fundOutputValue: fundOutputValue,
        messages: messagesForDdk,
      };

      // Use dlc_signOffer method for unified signing
      const signResponse = await this.wallet.request<SignDlcResult>(
        'dlc_signOffer',
        params,
      );

      if (signResponse.status === 'error') {
        throw new Error(
          `Failed to sign DLC transactions: ${signResponse.error?.message ?? 'Unknown error'}`,
        );
      }

      if (!signResponse.result) {
        throw new Error('No result in sign response');
      }

      const signResult = signResponse.result;

      // Extract funding transaction signatures
      const signedFundingPsbt = Psbt.fromBase64(signResult.fundingTransaction);
      const fundingSignatures = new FundingSignatures();

      const witnessElements: ScriptWitnessV0[][] = [];
      for (const inputIndex of ourFundingInputIndexes) {
        const input = signedFundingPsbt.data.inputs[inputIndex];
        if (input?.partialSig && input.partialSig.length > 0) {
          const partialSig = input.partialSig[0];
          const signature = partialSig.signature;
          const publicKey = partialSig.pubkey;

          // Create ScriptWitnessV0 objects
          const signatureWitness = new ScriptWitnessV0();
          signatureWitness.witness = signature;
          signatureWitness.length = signature.length;

          const publicKeyWitness = new ScriptWitnessV0();
          publicKeyWitness.witness = publicKey;
          publicKeyWitness.length = publicKey.length;

          witnessElements.push([signatureWitness, publicKeyWitness]);
        }
      }

      fundingSignatures.witnessElements = witnessElements as any;
      dlcSign.fundingSignatures = fundingSignatures;

      // Extract refund transaction signature
      const signedRefundPsbt = Psbt.fromBase64(signResult.refundTransaction);
      const refundInput = signedRefundPsbt.data.inputs[0];
      if (refundInput?.partialSig && refundInput.partialSig.length > 0) {
        const partialSig = refundInput.partialSig[0];

        // Convert DER signature to compact format (64 bytes)
        const compactSignature = this.ensureCompactSignature(
          partialSig.signature,
        );

        dlcSign.refundSignature = compactSignature;
      } else {
        throw new Error('No refund signature found in signed PSBT');
      }

      // Extract CET adaptor signatures
      // DDK's createCetAdaptorSigsFromOracleInfo returns:
      // { signature: 162 bytes (full adaptor sig including DLEQ proof), proof: 0 bytes }
      // We store the full 162 bytes in encryptedSig to match DDK provider format
      const cetAdaptorSignatures = new CetAdaptorSignatures();
      const cetSigs: any[] = [];

      for (let i = 0; i < signResult.cetTransactions.length; i++) {
        const base64AdaptorSig = signResult.cetTransactions[i];
        const adaptorSignature = Buffer.from(base64AdaptorSig, 'base64');

        // Store the full adaptor signature in encryptedSig (matching DDK provider format)
        // The 162-byte signature contains both the encrypted sig and DLEQ proof
        cetSigs.push({
          encryptedSig: adaptorSignature, // Full 162 bytes
          dleqProof: Buffer.alloc(0), // Empty, proof is included in encryptedSig
        });
      }

      (cetAdaptorSignatures as any).sigs = cetSigs;
      dlcSign.cetAdaptorSignatures = cetAdaptorSignatures;

      dlcSign.validate();

      return { dlcSign, dlcTransactions };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to sign DLC accept: ${errorMessage}`);
    }
  }

  /**
   * Detect if signature is in DER format and convert to compact format (64 bytes)
   */
  private ensureCompactSignature(signature: Buffer): Buffer {
    if (signature.length === 64) {
      return signature;
    }

    if (signature.length > 6 && signature[0] === 0x30) {
      let derSig = signature;

      // Remove SIGHASH flag if present
      if (signature[signature.length - 1] === 0x01) {
        derSig = signature.slice(0, -1);
      }

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

      // Remove leading zero padding
      while (rBytes.length > 1 && rBytes[0] === 0x00) {
        rBytes = rBytes.slice(1);
      }
      while (sBytes.length > 1 && sBytes[0] === 0x00) {
        sBytes = sBytes.slice(1);
      }

      // Pad to 32 bytes each
      while (rBytes.length < 32) {
        rBytes = Buffer.concat([Buffer.from([0x00]), rBytes]);
      }
      while (sBytes.length < 32) {
        sBytes = Buffer.concat([Buffer.from([0x00]), sBytes]);
      }

      if (rBytes.length !== 32 || sBytes.length !== 32) {
        throw new Error('Invalid signature values: r or s exceeds 32 bytes');
      }

      return Buffer.concat([rBytes, sBytes]);
    }

    throw new Error(
      'Unable to convert signature to compact format: unknown format',
    );
  }

  /**
   * Create refund PSBT for signing
   */
  private createRefundPsbt(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTransactions: DlcTransactions,
  ): Psbt {
    const transaction = btTransaction.fromBuffer(
      dlcTransactions.refundTx.serialize(),
    );
    const refundPsbt = new Psbt({ network: this.network });

    // Create the funding script (2-of-2 multisig)
    const fundingPubKeys =
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
        ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
        : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: fundingPubKeys,
      network: this.network,
    });

    const paymentVariant = payments.p2wsh({
      redeem: p2ms,
      network: this.network,
    });

    // Get the actual funding output value from the funding transaction
    const fundingTransaction = btTransaction.fromBuffer(
      dlcTransactions.fundTx.serialize(),
    );
    const actualFundingOutputValue =
      fundingTransaction.outs[dlcTransactions.fundTxVout].value;

    // Use the input hash directly from the raw refund transaction
    const rawRefundInputHash = transaction.ins[0].hash;
    const rawRefundInputIndex = transaction.ins[0].index;

    // Add the funding input
    refundPsbt.addInput({
      hash: rawRefundInputHash,
      index: rawRefundInputIndex,
      sequence: Number(dlcTransactions.refundTx.inputs[0].sequence),
      witnessUtxo: {
        script: paymentVariant.output!,
        value: actualFundingOutputValue,
      },
      witnessScript: paymentVariant.redeem!.output,
    });

    // Add refund outputs
    for (const output of transaction.outs) {
      refundPsbt.addOutput({
        address: address.fromOutputScript(output.script, this.network),
        value: output.value,
      });
    }

    // Set locktime
    refundPsbt.setLocktime(Number(dlcTransactions.refundTx.locktime));

    return refundPsbt;
  }

  /**
   * Create funding PSBT for signing
   */
  private createFundingPsbt(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTransactions: DlcTransactions,
  ): Psbt {
    const transaction = btTransaction.fromBuffer(
      Buffer.from(dlcTransactions.fundTx.serialize()),
    );
    const fundingPsbt = new Psbt({ network: this.network });

    // Combine all funding inputs from both parties
    const allFundingInputs = [
      ...dlcOffer.fundingInputs,
      ...dlcAccept.fundingInputs,
    ];

    // Sort by inputSerialId to reconstruct proper transaction order
    allFundingInputs.sort(
      (a, b) => Number(a.inputSerialId) - Number(b.inputSerialId),
    );

    // Add all inputs to PSBT with proper witnessUtxo
    for (const fundingInput of allFundingInputs) {
      const prevOut = fundingInput.prevTx.outputs[fundingInput.prevTxVout];

      const witnessUtxo = {
        script: Buffer.from(prevOut.scriptPubKey.serialize().subarray(1)),
        value: Number(prevOut.value.sats),
      };

      // Use sequence from the original transaction
      const originalInput = transaction.ins.find(
        (input) =>
          input.hash.reverse().toString('hex') ===
            fundingInput.prevTx.txId.toString() &&
          input.index === fundingInput.prevTxVout,
      );
      const sequenceValue = originalInput
        ? originalInput.sequence
        : Number(fundingInput.sequence);

      fundingPsbt.addInput({
        hash: fundingInput.prevTx.txId.toString(),
        index: fundingInput.prevTxVout,
        sequence: sequenceValue,
        witnessUtxo,
      });
    }

    // Add all outputs to PSBT
    for (const output of transaction.outs) {
      fundingPsbt.addOutput({
        address: address.fromOutputScript(
          Buffer.from(output.script),
          this.network,
        ),
        value: output.value,
      });
    }

    // Set locktime
    fundingPsbt.setLocktime(transaction.locktime);

    return fundingPsbt;
  }

  /**
   * Create CET PSBT for signing
   */
  private createCetPsbt(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTransactions: DlcTransactions,
    cetIndex: number,
  ): Psbt {
    if (!dlcTransactions.cets || cetIndex >= dlcTransactions.cets.length) {
      throw new Error(`CET at index ${cetIndex} not found in DLC transactions`);
    }

    const cetTransaction = dlcTransactions.cets[cetIndex];
    const transaction = btTransaction.fromBuffer(cetTransaction.serialize());
    const cetPsbt = new Psbt({ network: this.network });

    // Create the funding script (2-of-2 multisig)
    const fundingPubKeys =
      Buffer.compare(dlcOffer.fundingPubkey, dlcAccept.fundingPubkey) === -1
        ? [dlcOffer.fundingPubkey, dlcAccept.fundingPubkey]
        : [dlcAccept.fundingPubkey, dlcOffer.fundingPubkey];

    const p2ms = payments.p2ms({
      m: 2,
      pubkeys: fundingPubKeys,
      network: this.network,
    });

    const paymentVariant = payments.p2wsh({
      redeem: p2ms,
      network: this.network,
    });

    // Get the actual funding output value from the funding transaction
    const fundingTransaction = btTransaction.fromBuffer(
      dlcTransactions.fundTx.serialize(),
    );
    const actualFundingOutputValue =
      fundingTransaction.outs[dlcTransactions.fundTxVout].value;

    // Use the input hash directly from the raw CET transaction
    const rawCetInputHash = transaction.ins[0].hash;
    const rawCetInputIndex = transaction.ins[0].index;

    // Add the funding input
    cetPsbt.addInput({
      hash: rawCetInputHash,
      index: rawCetInputIndex,
      sequence: Number(cetTransaction.inputs[0].sequence),
      witnessUtxo: {
        script: paymentVariant.output!,
        value: actualFundingOutputValue,
      },
      witnessScript: paymentVariant.redeem!.output,
    });

    // Add CET outputs
    for (const output of transaction.outs) {
      cetPsbt.addOutput({
        address: address.fromOutputScript(output.script, this.network),
        value: output.value,
      });
    }

    // Set locktime if present
    if (cetTransaction.locktime) {
      cetPsbt.setLocktime(Number(cetTransaction.locktime));
    }

    return cetPsbt;
  }

  /**
   * Sign a CET for execution
   * Returns the ECDSA signature that can be combined with the decrypted adaptor sig
   */
  async signCetForExecution(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTransactions: DlcTransactions,
    outcomeIndex: number,
  ): Promise<Buffer> {
    // Create CET PSBT
    const cetPsbt = this.createCetPsbt(
      dlcOffer,
      dlcAccept,
      dlcTransactions,
      outcomeIndex,
    );

    // Get payment address for signing
    const paymentAddress = await this.getPaymentAddress();

    // Call wallet signPsbt
    const signResponse = await this.wallet.request<{ psbt: string }>(
      'signPsbt',
      {
        psbt: cetPsbt.toBase64(),
        signInputs: {
          [paymentAddress.address]: [0],
        },
      },
    );

    if (signResponse.status === 'error') {
      throw new Error(
        `Failed to sign CET: ${signResponse.error?.message ?? 'Unknown error'}`,
      );
    }

    if (!signResponse.result?.psbt) {
      throw new Error('No signed PSBT in response');
    }

    // Extract signature from signed PSBT
    const signedPsbt = Psbt.fromBase64(signResponse.result.psbt);
    const input = signedPsbt.data.inputs[0];

    if (!input?.partialSig || input.partialSig.length === 0) {
      throw new Error('No signature found in signed PSBT');
    }

    const signature = input.partialSig[0].signature;

    return signature;
  }
}

export default BitcoinSatsConnectProvider;
