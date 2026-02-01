import {
  decodeRawTransaction,
  normalizeTransactionObject,
  selectCoins,
} from '@atomicfinance/bitcoin-utils';
import BitcoinWalletProvider from '@atomicfinance/bitcoin-wallet-provider';
import Provider from '@atomicfinance/provider';
import {
  Address,
  bitcoin as bT,
  Input,
  Output,
  Transaction,
} from '@atomicfinance/types';
import * as ecc from '@bitcoin-js/tiny-secp256k1-asmjs';
import { BIP32Interface, fromPrivateKey } from 'bip32';
import { BitcoinNetwork } from 'bitcoin-network';
import {
  Psbt,
  script,
  Transaction as BitcoinJsTransaction,
} from 'bitcoinjs-lib';
import { ECPairFactory, ECPairInterface } from 'ecpair';

const ECPair = ECPairFactory(ecc);
import { signAsync as signBitcoinMessage } from 'bitcoinjs-message';

const FEE_PER_BYTE_FALLBACK = 5;
const DERIVATION_PATH = 'm/0';

type WalletProviderConstructor<T = Provider> = new (...args: unknown[]) => T;

interface BitcoinSingleKeyWalletProviderOptions {
  network: BitcoinNetwork;
  privateKey: string; // Hex format (64 chars) or WIF format
  addressType?: bT.AddressType;
}

// TypeScript has difficulty inferring the complex return type of the mixin pattern
// Using 'any' here is safe as we know the mixin returns the correct enhanced class
const BaseProvider: any = BitcoinWalletProvider(
  Provider as WalletProviderConstructor,
);

/**
 * A wallet provider for a single private key (no HD derivation).
 * Useful for simple use cases where you have one private key and don't need
 * hierarchical deterministic wallet features.
 */
export default class BitcoinSingleKeyWalletProvider extends BaseProvider {
  _keyPair: ECPairInterface;
  _address: Address;

  constructor(options: BitcoinSingleKeyWalletProviderOptions) {
    const {
      network,
      privateKey,
      addressType = bT.AddressType.BECH32,
    } = options;

    // Call parent with minimal required options
    super({
      network,
      baseDerivationPath: DERIVATION_PATH,
      addressType,
      addressIndex: 0,
      changeAddressIndex: 0,
    });

    // Parse private key (hex or WIF format)
    this._keyPair = this._parsePrivateKey(privateKey, network);

    // Pre-compute the single address
    const publicKey = this._keyPair.publicKey;
    const addressString = this.getAddressFromPublicKey(publicKey);
    this._address = new Address({
      address: addressString,
      publicKey: publicKey.toString('hex'),
      derivationPath: DERIVATION_PATH,
    });

    // Cache in derivation cache for compatibility
    this._derivationCache[DERIVATION_PATH] = this._address;
  }

  private _parsePrivateKey(
    privateKey: string,
    network: BitcoinNetwork,
  ): ECPairInterface {
    // Check if WIF format (starts with 5, K, L, c, or 9 and is ~52 chars)
    if (
      privateKey.length >= 51 &&
      privateKey.length <= 52 &&
      /^[5KLc9]/.test(privateKey)
    ) {
      return ECPair.fromWIF(privateKey, network);
    }

    // Otherwise treat as hex (with or without 0x prefix)
    let hexKey = privateKey;
    if (hexKey.startsWith('0x')) {
      hexKey = hexKey.slice(2);
    }

    if (hexKey.length !== 64) {
      throw new Error(
        'Private key must be 64 hex characters or valid WIF format',
      );
    }

    return ECPair.fromPrivateKey(Buffer.from(hexKey, 'hex'), { network });
  }

  /**
   * Returns the ECPair for signing. Derivation path is ignored since we have a single key.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async keyPair(_derivationPath?: string): Promise<ECPairInterface> {
    return this._keyPair;
  }

  /**
   * Required by parent class but not really used for single-key wallet.
   * Returns a BIP32 node created from the private key.
   */
  async baseDerivationNode(): Promise<BIP32Interface> {
    return fromPrivateKey(
      this._keyPair.privateKey,
      Buffer.alloc(32), // chainCode not used
      this._network,
    );
  }

  /**
   * Returns the single address. Parameters are ignored.
   */
  async getAddresses(
    _startingIndex = 0, // eslint-disable-line @typescript-eslint/no-unused-vars
    _numAddresses = 1, // eslint-disable-line @typescript-eslint/no-unused-vars
    _change = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Address[]> {
    return [this._address];
  }

  /**
   * Returns the single address.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getUnusedAddress(_change = false): Promise<Address> {
    return this._address;
  }

  /**
   * Checks if the requested address matches our single address.
   */
  async findAddress(
    addresses: string[],
    _change: boolean | null = null, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Address | undefined> {
    if (addresses.includes(this._address.address)) {
      return this._address;
    }
    return undefined;
  }

  /**
   * Returns the single address if it's used, empty array otherwise.
   */
  async getUsedAddresses(): Promise<Address[]> {
    const transactionCounts = await this.getMethod(
      'getAddressTransactionCounts',
    )([this._address]);
    if (transactionCounts[this._address.address] > 0) {
      return [this._address];
    }
    return [];
  }

  /**
   * Returns the wallet address if it matches.
   */
  async getWalletAddress(address: string): Promise<Address> {
    if (address === this._address.address) {
      return this._address;
    }
    throw new Error('Wallet does not contain address');
  }

  async exportPrivateKey(): Promise<string> {
    return this._keyPair.toWIF();
  }

  async signMessage(message: string, from: string): Promise<string> {
    if (from !== this._address.address) {
      throw new Error('Address does not match wallet address');
    }
    const signature = await signBitcoinMessage(
      message,
      this._keyPair.privateKey,
      this._keyPair.compressed,
    );
    return signature.toString('hex');
  }

  async _buildTransaction(
    targets: bT.OutputTarget[],
    feePerByte?: number,
    fixedInputs?: bT.Input[],
  ): Promise<{ hex: string; fee: number }> {
    const network = this._network;

    const { inputs, change, fee } = await this.getInputsForAmount(
      targets,
      feePerByte,
      fixedInputs,
    );

    if (change) {
      targets.push({
        address: this._address.address,
        value: change.value,
      });
    }

    const psbt = new Psbt({ network });

    const needsWitness = [
      bT.AddressType.BECH32,
      bT.AddressType.P2SH_SEGWIT,
    ].includes(this._addressType);

    for (let i = 0; i < inputs.length; i++) {
      const paymentVariant = this.getPaymentVariantFromPublicKey(
        this._keyPair.publicKey,
      );

      const psbtInput: any = {
        hash: inputs[i].txid,
        index: inputs[i].vout,
        sequence: 0,
      };

      if (needsWitness) {
        psbtInput.witnessUtxo = {
          script: paymentVariant.output,
          value: inputs[i].value,
        };
      } else {
        const inputTxRaw = await this.getMethod('getRawTransactionByHash')(
          inputs[i].txid,
        );
        psbtInput.nonWitnessUtxo = Buffer.from(inputTxRaw, 'hex');
      }

      if (this._addressType === bT.AddressType.P2SH_SEGWIT) {
        psbtInput.redeemScript = paymentVariant.redeem.output;
      }

      psbt.addInput(psbtInput);
    }

    for (const output of targets) {
      if (output.script) {
        psbt.addOutput({
          value: output.value,
          script: output.script,
        });
      } else {
        psbt.addOutput({
          value: output.value,
          address: output.address,
        });
      }
    }

    for (let i = 0; i < inputs.length; i++) {
      psbt.signInput(i, this._keyPair);
      psbt.validateSignaturesOfInput(
        i,
        (pubkey: Buffer, msghash: Buffer, signature: Buffer) =>
          ecc.verify(msghash, pubkey, signature),
      );
    }

    psbt.finalizeAllInputs();

    return { hex: psbt.extractTransaction().toHex(), fee };
  }

  async _buildSweepTransaction(
    externalChangeAddress: string,
    feePerByte: number,
  ): Promise<{ hex: string; fee: number }> {
    let _feePerByte = feePerByte || null;
    if (!_feePerByte) _feePerByte = await this.getMethod('getFeePerByte')();

    const { inputs, outputs, change } = await this.getInputsForAmount(
      [],
      _feePerByte,
      [],
      100,
      true,
    );

    if (change) {
      throw new Error(
        'There should not be any change for sweeping transaction',
      );
    }

    const _outputs = [
      {
        address: externalChangeAddress,
        value: outputs[0].value,
      },
    ];

    return this._buildTransaction(
      _outputs,
      feePerByte,
      inputs as unknown as bT.Input[],
    );
  }

  async signPSBT(data: string, inputs: bT.PsbtInputTarget[]): Promise<string> {
    const psbt = Psbt.fromBase64(data, { network: this._network });
    for (const input of inputs) {
      // Ignore derivationPath, use our single key
      psbt.signInput(input.index, this._keyPair);
    }
    return psbt.toBase64();
  }

  async signBatchP2SHTransaction(
    inputs: [
      {
        inputTxHex: string;
        index: number;
        vout: any;
        outputScript: Buffer;
        txInputIndex?: number;
      },
    ],
    _addresses: string,
    tx: any,
    _lockTime?: number,
    segwit?: boolean,
  ): Promise<Buffer[]> {
    const sigs: Buffer[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const index = inputs[i].txInputIndex
        ? inputs[i].txInputIndex
        : inputs[i].index;
      let sigHash;
      if (segwit) {
        sigHash = tx.hashForWitnessV0(
          index,
          inputs[i].outputScript,
          inputs[i].vout.vSat,
          BitcoinJsTransaction.SIGHASH_ALL,
        );
      } else {
        sigHash = tx.hashForSignature(
          index,
          inputs[i].outputScript,
          BitcoinJsTransaction.SIGHASH_ALL,
        );
      }

      const sig = script.signature.encode(
        this._keyPair.sign(sigHash),
        BitcoinJsTransaction.SIGHASH_ALL,
      );
      sigs.push(sig);
    }

    return sigs;
  }

  async sendSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[],
  ): Promise<Transaction<bT.Transaction>> {
    const { hex, fee } = await this._buildSweepTransactionWithSetOutputs(
      externalChangeAddress,
      feePerByte,
      _outputs,
      fixedInputs,
    );
    await this.getMethod('sendRawTransaction')(hex);
    return normalizeTransactionObject(
      decodeRawTransaction(hex, this._network),
      fee,
    );
  }

  async buildSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[],
  ): Promise<{ hex: string; fee: number }> {
    return this._buildSweepTransactionWithSetOutputs(
      externalChangeAddress,
      feePerByte,
      _outputs,
      fixedInputs,
    );
  }

  async _buildSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[] = [],
    fixedInputs: Input[],
  ): Promise<{ hex: string; fee: number }> {
    const _feePerByte =
      feePerByte ||
      (await this.getMethod('getFeePerByte')()) ||
      FEE_PER_BYTE_FALLBACK;
    const inputs: Input[] = [];
    const outputs: Output[] = [];

    try {
      const inputsForAmount = await this.getInputsForAmount(
        _outputs,
        _feePerByte,
        fixedInputs as unknown as bT.Input[],
        100,
        true,
      );
      if (inputsForAmount.change) {
        throw Error('There should not be any change for sweeping transaction');
      }
      inputs.push(...((inputsForAmount.inputs as Input[]) || []));
      outputs.push(...(inputsForAmount.outputs || []));
    } catch {
      if (fixedInputs.length === 0) {
        throw Error(
          `Inputs for amount doesn't exist and no fixedInputs provided`,
        );
      }

      const inputsForAmount = this._getInputForAmountWithoutUtxoCheck(
        _outputs,
        _feePerByte,
        fixedInputs,
      );
      inputs.push(
        ...(inputsForAmount.inputs.map((utxo) => Input.fromUTXO(utxo)) || []),
      );
      outputs.push(...(inputsForAmount.outputs || []));
    }

    _outputs.forEach((output) => {
      const spliceIndex = outputs.findIndex(
        (sweepOutput: Output) => output.value === sweepOutput.value,
      );
      outputs.splice(spliceIndex, 1);
    });

    _outputs.push({
      to: externalChangeAddress,
      value: outputs[0].value,
    });

    return this._buildTransactionWithoutUtxoCheck(
      _outputs,
      _feePerByte,
      inputs,
    );
  }

  _getInputForAmountWithoutUtxoCheck(
    _outputs: Output[],
    _feePerByte: number,
    fixedInputs: Input[],
  ): {
    inputs: bT.UTXO[];
    outputs: { value: number; id?: string }[];
    fee: number;
    change: { value: number; id?: string };
  } {
    const utxoBalance = fixedInputs.reduce((a, b) => a + (b['value'] || 0), 0);
    const outputBalance = _outputs.reduce((a, b) => a + (b['value'] || 0), 0);
    const amountToSend =
      utxoBalance -
      _feePerByte * ((_outputs.length + 1) * 39 + fixedInputs.length * 153);

    const targets = _outputs.map((target) => ({
      id: 'main',
      value: target.value,
    }));
    if (amountToSend - outputBalance > 0) {
      targets.push({ id: 'main', value: amountToSend - outputBalance });
    }

    return selectCoins(
      fixedInputs,
      targets,
      Math.ceil(_feePerByte),
      fixedInputs,
    );
  }

  async _buildTransactionWithoutUtxoCheck(
    outputs: Output[],
    feePerByte: number,
    fixedInputs: Input[],
  ): Promise<{ hex: string; fee: number }> {
    const network = this._network;

    const { fee } = this._getInputForAmountWithoutUtxoCheck(
      outputs,
      feePerByte,
      fixedInputs,
    );
    const inputs = fixedInputs;

    const psbt = new Psbt({ network });

    const needsWitness = [
      bT.AddressType.BECH32,
      bT.AddressType.P2SH_SEGWIT,
    ].includes(this._addressType);

    for (let i = 0; i < inputs.length; i++) {
      const paymentVariant = this.getPaymentVariantFromPublicKey(
        this._keyPair.publicKey,
      );

      const psbtInput: any = {
        hash: inputs[i].txid,
        index: inputs[i].vout,
        sequence: 0,
      };

      if (needsWitness) {
        psbtInput.witnessUtxo = {
          script: paymentVariant.output,
          value: inputs[i].value,
        };
      } else {
        const inputTxRaw = await this.getMethod('getRawTransactionByHash')(
          inputs[i].txid,
        );
        psbtInput.nonWitnessUtxo = Buffer.from(inputTxRaw, 'hex');
      }

      if (this._addressType === bT.AddressType.P2SH_SEGWIT) {
        psbtInput.redeemScript = paymentVariant.redeem.output;
      }

      psbt.addInput(psbtInput);
    }

    for (const output of outputs) {
      psbt.addOutput({
        value: output.value,
        address: output.to,
      });
    }

    for (let i = 0; i < inputs.length; i++) {
      psbt.signInput(i, this._keyPair);
      psbt.validateSignaturesOfInput(
        i,
        (pubkey: Buffer, msghash: Buffer, signature: Buffer) =>
          ecc.verify(msghash, pubkey, signature),
      );
    }

    psbt.finalizeAllInputs();

    return { hex: psbt.extractTransaction().toHex(), fee };
  }

  getScriptType(): string {
    if (this._addressType === bT.AddressType.LEGACY) return 'p2pkh';
    else if (this._addressType === bT.AddressType.P2SH_SEGWIT)
      return 'p2sh-p2wpkh';
    else if (this._addressType === bT.AddressType.BECH32) return 'p2wpkh';
  }

  async getConnectedNetwork(): Promise<BitcoinNetwork> {
    return this._network;
  }

  async isWalletAvailable(): Promise<boolean> {
    return true;
  }
}
