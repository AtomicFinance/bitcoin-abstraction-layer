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
  CreateMultisigResponse,
  finalizePSBTResponse,
  Input,
  Output,
  Transaction,
} from '@atomicfinance/types';
import assert from 'assert';
import { BIP32Interface, fromSeed } from 'bip32';
import { mnemonicToSeed } from 'bip39';
import { BitcoinNetwork } from 'bitcoin-networks';
import * as bitcoin from 'bitcoinjs-lib';
import {
  Psbt,
  script,
  Transaction as BitcoinJsTransaction,
} from 'bitcoinjs-lib';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);
import { signAsync as signBitcoinMessage } from 'bitcoinjs-message';
import secp256k1 from 'secp256k1';

const FEE_PER_BYTE_FALLBACK = 5;

type WalletProviderConstructor<T = Provider> = new (...args: unknown[]) => T;

interface BitcoinJsWalletProviderOptions {
  network: BitcoinNetwork;
  mnemonic: string;
  baseDerivationPath: string;
  addressType?: bT.AddressType;
  addressIndex?: number;
  changeAddressIndex?: number;
}

// TypeScript has difficulty inferring the complex return type of the mixin pattern
// Using 'any' here is safe as we know the mixin returns the correct enhanced class
const BaseProvider: any = BitcoinWalletProvider(
  Provider as WalletProviderConstructor,
);

export default class BitcoinJsWalletProvider extends BaseProvider {
  _mnemonic: string;
  _seedNode: BIP32Interface;
  _baseDerivationNode: BIP32Interface;

  constructor(options: BitcoinJsWalletProviderOptions) {
    const {
      network,
      mnemonic,
      baseDerivationPath,
      addressType = bT.AddressType.BECH32,
      addressIndex = 0,
      changeAddressIndex = 0,
    } = options;
    super({
      network,
      baseDerivationPath,
      addressType,
      addressIndex,
      changeAddressIndex,
    });

    if (!mnemonic) throw new Error('Mnemonic should not be empty');

    this._mnemonic = mnemonic;
  }

  async seedNode() {
    if (this._seedNode) return this._seedNode;

    const seed = await mnemonicToSeed(this._mnemonic);
    this._seedNode = fromSeed(seed, this._network);

    return this._seedNode;
  }

  async baseDerivationNode() {
    if (this._baseDerivationNode) return this._baseDerivationNode;

    const baseNode = await this.seedNode();
    this._baseDerivationNode = baseNode.derivePath(this._baseDerivationPath);

    return this._baseDerivationNode;
  }

  async keyPair(derivationPath: string): Promise<ECPairInterface> {
    const wif = await this._toWIF(derivationPath);
    return ECPair.fromWIF(wif, this._network);
  }

  private async _toWIF(derivationPath: string): Promise<string> {
    const node = await this.seedNode();
    return node.derivePath(derivationPath).toWIF();
  }

  async exportPrivateKey() {
    return this._toWIF(this._baseDerivationPath);
  }

  async signMessage(message: string, from: string) {
    const address = await this.getWalletAddress(from);
    const keyPair = await this.keyPair(address.derivationPath);
    const signature = await signBitcoinMessage(
      message,
      keyPair.privateKey,
      keyPair.compressed,
    );
    return signature.toString('hex');
  }

  _createMultisigPayment(m: number, pubkeys: string[]): bitcoin.Payment {
    if (m > pubkeys.length) {
      throw new Error(
        `not enough keys supplied (got ${pubkeys.length} keys, but need at least ${m} to redeem)`,
      );
    }
    // Create m-of-n multisig
    const p2ms = bitcoin.payments.p2ms({
      m: m,
      pubkeys: pubkeys.map((key: string) => Buffer.from(key, 'hex')),
      network: this._network,
    });

    // Create p2wsh for multisig
    const p2wsh = bitcoin.payments.p2wsh({
      redeem: p2ms,
      network: this._network,
    });

    return p2wsh;
  }

  /**
   * Creates a native-segwit multi-signature address (P2MS in P2WSH) with n signatures of m required keys
   * https://developer.bitcoin.org/reference/rpc/createmultisig.html
   * @param m the number of required signatures
   * @param pubkeys n possible pubkeys in total
   * @returns a json object containing the `address` and `redeemScript`
   */
  createMultisig(m: number, pubkeys: string[]): CreateMultisigResponse {
    const p2wsh = this._createMultisigPayment(m, pubkeys);
    return {
      address: p2wsh.address,
      redeemScript: p2wsh.redeem?.output?.toString('hex'),
    };
  }

  /**
   * Creates a PSBT of a native-segwit multi-signature address (P2MS in P2WSH) with n signatures of m required keys
   * https://developer.bitcoin.org/reference/rpc/createmultisig.html
   * https://developer.bitcoin.org/reference/rpc/createpsbt.html
   * @param m the number of required signatures
   * @param pubkeys n possible pubkeys in total
   * @param inputs the Inputs to the PSBT
   * @param ouputs the Outputs to the PSBT
   * @returns a base64 encoded psbt string
   */
  buildMultisigPSBT(
    m: number,
    pubkeys: string[],
    inputs: Input[],
    outputs: Output[],
  ): string {
    assert(inputs.length > 0, 'no inputs found');
    assert(outputs.length > 0, 'no outputs found');

    const p2wsh = this._createMultisigPayment(m, pubkeys);

    // Verify pubkeyhash for all inputs matches the p2wsh hash
    assert(
      inputs.every(
        (input: Input) => p2wsh.output.toString('hex') === input.scriptPubKey,
      ),
      'address pubkeyhash does not match input scriptPubKey',
    );

    // creator
    const psbt = new bitcoin.Psbt({ network: this._network });

    // updater
    inputs.forEach((input: Input) => {
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        witnessUtxo: { script: p2wsh.output, value: input.value },
        witnessScript: p2wsh.redeem.output,
      });
    });

    outputs.forEach((output: Output) => {
      psbt.addOutput({
        address: output.to,
        value: output.value,
      });
    });

    return psbt.toBase64();
  }

  /**
   * Update a PSBT with input information from our wallet and then sign inputs that we can sign for
   * https://developer.bitcoin.org/reference/rpc/walletprocesspsbt.html
   * @param psbt a base64 encoded psbt string (P2WSH only)
   * @returns a base64 encoded signed psbt string
   */
  async walletProcessPSBT(psbtString: string): Promise<string> {
    const psbt = bitcoin.Psbt.fromBase64(psbtString);

    await Promise.all(
      psbt.data.inputs.map(async (input, i: number) => {
        assert(
          psbt.getInputType(i).slice(0, 5) === 'p2wsh',
          'only accepts P2WSH inputs',
        );

        const scriptStack = bitcoin.script.decompile(input.witnessScript);
        const pubkeys = scriptStack.filter(
          (data) => Buffer.isBuffer(data) && secp256k1.publicKeyVerify(data),
        );

        await Promise.all(
          pubkeys.map(async (key) => {
            // create address using pubkey
            const { address: addressString } = bitcoin.payments.p2wpkh({
              pubkey: key as Buffer,
              network: this._network,
            });

            // Retrieve address object from wallet using address
            const address: Address = await this.findAddress([addressString]);

            // exit if address doesn't exist in wallet
            if (!address) return;

            // derive keypair
            const keyPair = await this.keyPair(address.derivationPath);

            // sign PSBT using keypair
            psbt.signInput(i, keyPair);
          }),
        );
      }),
    );

    psbt.validateSignaturesOfAllInputs(
      (pubkey: Buffer, msghash: Buffer, signature: Buffer) =>
        ecc.verify(msghash, pubkey, signature),
    ); // ensure all signatures are valid!
    return psbt.toBase64();
  }

  /**
   * Finalize the inputs of a PSBT. If the transaction is fully signed, it will
   * produce a network serialized transaction which can be broadcast with sendrawtransaction
   * https://developer.bitcoin.org/reference/rpc/finalizepsbt.html
   * @param psbt a base64 encoded psbt string
   * @returns a json object containing `psbt` in base64, `hex` for transaction and `complete` for if
   * the transaction has a complete set of signatures
   */
  finalizePSBT(psbtString: string): finalizePSBTResponse {
    const psbt = bitcoin.Psbt.fromBase64(psbtString);

    try {
      psbt.validateSignaturesOfAllInputs(
        (pubkey: Buffer, msghash: Buffer, signature: Buffer) =>
          ecc.verify(msghash, pubkey, signature),
      ); // ensure all signatures are valid!
      psbt.finalizeAllInputs();
    } catch {
      return {
        psbt: psbt.toBase64(),
        complete: false,
      };
    }
    return {
      psbt: psbt.toBase64(),
      hex: psbt.extractTransaction().toHex(),
      complete: true,
    };
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
  ): Promise<{
    hex: string;
    fee: number;
  }> {
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
  ): Promise<{
    hex: string;
    fee: number;
  }> {
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

      const inputsForAmount = await this._getInputForAmountWithoutUtxoCheck(
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
      _feePerByte * ((_outputs.length + 1) * 39 + fixedInputs.length * 153); // todo better calculation

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
  ) {
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
      const wallet = await this.getWalletAddress(inputs[i].address);
      const keyPair = await this.keyPair(wallet.derivationPath);
      const paymentVariant = this.getPaymentVariantFromPublicKey(
        keyPair.publicKey,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const wallet = await this.getWalletAddress(inputs[i].address);
      const keyPair = await this.keyPair(wallet.derivationPath);
      psbt.signInput(i, keyPair);
      psbt.validateSignaturesOfInput(
        i,
        (pubkey: Buffer, msghash: Buffer, signature: Buffer) =>
          ecc.verify(msghash, pubkey, signature),
      );
    }

    psbt.finalizeAllInputs();

    return { hex: psbt.extractTransaction().toHex(), fee };
  }

  async _buildTransaction(
    targets: bT.OutputTarget[],
    feePerByte?: number,
    fixedInputs?: bT.Input[],
  ) {
    const network = this._network;

    const unusedAddress = await this.getUnusedAddress(true);
    const { inputs, change, fee } = await this.getInputsForAmount(
      targets,
      feePerByte,
      fixedInputs,
    );

    if (change) {
      targets.push({
        address: unusedAddress.address,
        value: change.value,
      });
    }

    const psbt = new Psbt({ network });

    const needsWitness = [
      bT.AddressType.BECH32,
      bT.AddressType.P2SH_SEGWIT,
    ].includes(this._addressType);

    for (let i = 0; i < inputs.length; i++) {
      const wallet = await this.getWalletAddress(inputs[i].address);
      const keyPair = await this.keyPair(wallet.derivationPath);
      const paymentVariant = this.getPaymentVariantFromPublicKey(
        keyPair.publicKey,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const wallet = await this.getWalletAddress(inputs[i].address);
      const keyPair = await this.keyPair(wallet.derivationPath);
      psbt.signInput(i, keyPair);
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
  ) {
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

  async signPSBT(data: string, inputs: bT.PsbtInputTarget[]) {
    const psbt = Psbt.fromBase64(data, { network: this._network });
    for (const input of inputs) {
      const keyPair = await this.keyPair(input.derivationPath);
      psbt.signInput(input.index, keyPair);
    }
    return psbt.toBase64();
  }

  async signBatchP2SHTransaction(
    inputs: [
      {
        inputTxHex: string;
        index: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vout: any;
        outputScript: Buffer;
        txInputIndex?: number;
      },
    ],
    addresses: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    _lockTime?: number,
    segwit?: boolean,
  ): Promise<Buffer[]> {
    const keyPairs = [];
    for (const address of addresses) {
      const wallet = await this.getWalletAddress(address);
      const keyPair = await this.keyPair(wallet.derivationPath);
      keyPairs.push(keyPair);
    }

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
        keyPairs[i].sign(sigHash),
        BitcoinJsTransaction.SIGHASH_ALL,
      );
      sigs.push(sig);
    }

    return sigs;
  }

  getScriptType() {
    if (this._addressType === bT.AddressType.LEGACY) return 'p2pkh';
    else if (this._addressType === bT.AddressType.P2SH_SEGWIT)
      return 'p2sh-p2wpkh';
    else if (this._addressType === bT.AddressType.BECH32) return 'p2wpkh';
  }

  async getConnectedNetwork() {
    return this._network;
  }

  async isWalletAvailable() {
    return true;
  }
}
