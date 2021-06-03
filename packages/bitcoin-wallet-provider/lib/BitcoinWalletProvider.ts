import Provider from '@atomicfinance/provider';
import {
  CreateMultisigResponse,
  finalizePSBTResponse,
  FinanceWalletProvider,
  Input,
  Output,
} from '@atomicfinance/types';
import { BitcoinNetwork } from '@liquality/bitcoin-networks';
import {
  decodeRawTransaction,
  normalizeTransactionObject,
  selectCoins,
} from '@liquality/bitcoin-utils';
import { Address, bitcoin as bT, Transaction } from '@liquality/types';
import assert from 'assert';
import * as bitcoin from 'bitcoinjs-lib';

const FEE_PER_BYTE_FALLBACK = 5;
const ADDRESS_GAP = 20;
const NONCHANGE_ADDRESS = 0;
const CHANGE_ADDRESS = 1;
const NONCHANGE_OR_CHANGE_ADDRESS = 2;

type UnusedAddressesBlacklist = {
  [address: string]: true;
};

export default class BitcoinWalletProvider
  extends Provider
  implements Partial<FinanceWalletProvider> {
  _network: BitcoinNetwork;
  _unusedAddressesBlacklist: UnusedAddressesBlacklist;

  constructor(network: BitcoinNetwork) {
    super();

    this._network = network;
    this._unusedAddressesBlacklist = {};
  }

  async buildSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[],
  ) {
    return this._buildSweepTransaction(
      externalChangeAddress,
      feePerByte,
      _outputs,
      fixedInputs,
    );
  }

  getUnusedAddressesBlacklist(): UnusedAddressesBlacklist {
    return this._unusedAddressesBlacklist;
  }

  setUnusedAddressesBlacklist(
    unusedAddressesBlacklist: UnusedAddressesBlacklist,
  ) {
    this._unusedAddressesBlacklist = unusedAddressesBlacklist;
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
   * @param psbt a base64 encoded psbt string
   * @returns a base64 encoded signed psbt string
   */
  async walletProcessPSBT(psbtString: string): Promise<string> {
    const psbt = bitcoin.Psbt.fromBase64(psbtString);

    await Promise.all(
      psbt.data.inputs.map(async (input, i: number) => {
        const scriptStack = bitcoin.script.decompile(input.witnessScript);
        const pubkeys = scriptStack.filter((data) => Buffer.isBuffer(data));

        await Promise.all(
          pubkeys.map(async (key) => {
            // create address using pubkey
            const { address: addressString } = bitcoin.payments.p2wpkh({
              pubkey: key as Buffer,
              network: this._network,
            });

            // Retrieve address object from wallet using address
            const address: Address = await this.quickFindAddress([
              addressString,
            ]);

            // exit if address doesn't exist in wallet
            if (!address) return;

            // derive keypair
            const keyPair = await this.getMethod('keyPair')(
              address.derivationPath,
            );

            // sign PSBT using keypair
            psbt.signInput(i, keyPair);
          }),
        );
      }),
    );

    psbt.validateSignaturesOfAllInputs(); // ensure all signatures are valid!
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
      psbt.validateSignaturesOfAllInputs(); // ensure all signatures are valid!
      psbt.finalizeAllInputs();
    } catch (error) {
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

  async getUnusedAddress(change = false, numAddressPerCall = 100) {
    const addressType = change ? CHANGE_ADDRESS : NONCHANGE_ADDRESS;
    const key = change ? 'change' : 'nonChange';

    const address = await this._getUsedUnusedAddresses(
      numAddressPerCall,
      addressType,
    ).then(({ unusedAddress }) => unusedAddress[key]);
    this._unusedAddressesBlacklist[address.address] = true;

    return address;
  }

  async _getUsedUnusedAddresses(numAddressPerCall = 100, addressType) {
    const usedAddresses = [];
    const addressCountMap = { change: 0, nonChange: 0 };
    const unusedAddressMap = { change: null, nonChange: null };

    let addrList;
    let addressIndex = 0;
    let changeAddresses: Address[] = [];
    let nonChangeAddresses: Address[] = [];

    /* eslint-disable no-unmodified-loop-condition */
    while (
      (addressType === NONCHANGE_OR_CHANGE_ADDRESS &&
        (addressCountMap.change < ADDRESS_GAP ||
          addressCountMap.nonChange < ADDRESS_GAP)) ||
      (addressType === NONCHANGE_ADDRESS &&
        addressCountMap.nonChange < ADDRESS_GAP) ||
      (addressType === CHANGE_ADDRESS && addressCountMap.change < ADDRESS_GAP)
    ) {
      /* eslint-enable no-unmodified-loop-condition */
      addrList = [];

      if (
        (addressType === NONCHANGE_OR_CHANGE_ADDRESS ||
          addressType === CHANGE_ADDRESS) &&
        addressCountMap.change < ADDRESS_GAP
      ) {
        // Scanning for change addr
        changeAddresses = await this.client.wallet.getAddresses(
          addressIndex,
          numAddressPerCall,
          true,
        );
        addrList = addrList.concat(changeAddresses);
      } else {
        changeAddresses = [];
      }

      if (
        (addressType === NONCHANGE_OR_CHANGE_ADDRESS ||
          addressType === NONCHANGE_ADDRESS) &&
        addressCountMap.nonChange < ADDRESS_GAP
      ) {
        // Scanning for non change addr
        nonChangeAddresses = await this.client.wallet.getAddresses(
          addressIndex,
          numAddressPerCall,
          false,
        );
        addrList = addrList.concat(nonChangeAddresses);
      }

      const transactionCounts = await this.getMethod(
        'getAddressTransactionCounts',
      )(addrList);

      for (const address of addrList) {
        const isUsed =
          transactionCounts[address] > 0 ||
          this._unusedAddressesBlacklist[address.address];
        const isChangeAddress = changeAddresses.find(
          (a) => address.address === a.address,
        );
        const key = isChangeAddress ? 'change' : 'nonChange';

        if (isUsed) {
          usedAddresses.push(address);
          addressCountMap[key] = 0;
          unusedAddressMap[key] = null;
        } else {
          addressCountMap[key]++;

          if (!unusedAddressMap[key]) {
            unusedAddressMap[key] = address;
          }
        }
      }

      addressIndex += numAddressPerCall;
    }

    let firstUnusedAddress;
    const indexNonChange = unusedAddressMap.nonChange
      ? unusedAddressMap.nonChange.index
      : Infinity;
    const indexChange = unusedAddressMap.change
      ? unusedAddressMap.change.index
      : Infinity;

    if (indexNonChange <= indexChange)
      firstUnusedAddress = unusedAddressMap.nonChange;
    else firstUnusedAddress = unusedAddressMap.change;

    return {
      usedAddresses,
      unusedAddress: unusedAddressMap,
      firstUnusedAddress,
    };
  }

  async sendSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[],
  ): Promise<Transaction<bT.Transaction>> {
    const { hex, fee } = await this._buildSweepTransaction(
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

  async _buildSweepTransaction(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[] = [],
    fixedInputs: Input[],
  ) {
    const _feePerByte =
      feePerByte ||
      (await this.getMethod('getFeePerByte')()) ||
      FEE_PER_BYTE_FALLBACK;
    const inputs: Input[] = [];
    const outputs: Output[] = [];
    try {
      const inputsForAmount = await this.getMethod('getInputsForAmount')(
        _outputs,
        _feePerByte,
        fixedInputs,
        100,
        true,
      );
      if (inputsForAmount.change) {
        throw Error('There should not be any change for sweeping transaction');
      }
      inputs.push(...(inputsForAmount.inputs || []));
      outputs.push(...(inputsForAmount.outputs || []));
    } catch (e) {
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
  ) {
    const utxoBalance = fixedInputs.reduce((a, b) => a + (b['value'] || 0), 0);
    const outputBalance = _outputs.reduce((a, b) => a + (b['value'] || 0), 0);
    const amountToSend =
      utxoBalance -
      _feePerByte * ((_outputs.length + 1) * 39 + fixedInputs.length * 153); // todo better calculation

    const targets = _outputs.map((target, i) => ({
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

    const txb = new bitcoin.TransactionBuilder(network);

    for (const output of outputs) {
      const to = output.to; // Allow for OP_RETURN
      txb.addOutput(to, output.value);
    }

    const prevOutScriptType = 'p2wpkh';

    for (let i = 0; i < inputs.length; i++) {
      const wallet = await this.getMethod('getWalletAddress')(
        inputs[i].address,
      );
      const keyPair = await this.getMethod('keyPair')(wallet.derivationPath);
      const paymentVariant = this.getMethod('getPaymentVariantFromPublicKey')(
        keyPair.publicKey,
      );

      txb.addInput(inputs[i].txid, inputs[i].vout, 0, paymentVariant.output);
    }

    for (let i = 0; i < inputs.length; i++) {
      const wallet = await this.getMethod('getWalletAddress')(
        inputs[i].address,
      );
      const keyPair = await this.getMethod('keyPair')(wallet.derivationPath);
      const paymentVariant = this.getMethod('getPaymentVariantFromPublicKey')(
        keyPair.publicKey,
      );
      const needsWitness = true;

      const signParams = {
        prevOutScriptType,
        vin: i,
        keyPair,
        witnessValue: 0,
      };

      if (needsWitness) {
        signParams.witnessValue = inputs[i].value;
      }

      txb.sign(signParams);
    }

    return { hex: txb.build().toHex(), fee };
  }

  async quickFindAddress(addresses: string[]): Promise<Address> {
    const maxAddresses = 500;
    const addressesPerCall = 5;
    let index = 0;
    while (index < maxAddresses) {
      const walletNonChangeAddresses = await this.getMethod('getAddresses')(
        index,
        addressesPerCall,
        true,
      );
      const walletChangeAddresses = await this.getMethod('getAddresses')(
        index,
        addressesPerCall,
        false,
      );
      const walletAddresses = [
        ...walletNonChangeAddresses,
        ...walletChangeAddresses,
      ];
      const walletAddress = walletAddresses.find((walletAddr) =>
        addresses.find((addr) => walletAddr.address === addr),
      );
      if (walletAddress) return walletAddress;
      index += addressesPerCall;
    }
  }
}
