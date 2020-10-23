import Provider from '@atomicfinance/provider';
import {
  normalizeTransactionObject,
  decodeRawTransaction,
} from '@liquality/bitcoin-utils';

export default class BitcoinWalletProvider extends Provider {
  _network: any;

  constructor(network: any) {
    super('BitcoinWalletProvider');

    this._network = network;
  }

  async buildSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[]
  ) {
    return this._buildSweepTransaction(
      externalChangeAddress,
      feePerByte,
      _outputs,
      fixedInputs
    );
  }

  async sendSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[]
  ) {
    const { hex, fee } = await this._buildSweepTransaction(
      externalChangeAddress,
      feePerByte,
      _outputs,
      fixedInputs
    );
    await this.client.getMethod('sendRawTransaction')(hex);
    return normalizeTransactionObject(
      decodeRawTransaction(hex, this._network),
      fee
    );
  }

  async _buildSweepTransaction(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[] = [],
    fixedInputs: Input[]
  ) {
    let _feePerByte = feePerByte || false;
    if (_feePerByte === false)
      _feePerByte = await this.client.getMethod('getFeePerByte')();
    const { inputs, outputs, change } = await this.client.getMethod(
      'getInputsForAmount'
    )(_outputs, _feePerByte, fixedInputs, 100, true);
    if (change) {
      throw Error('There should not be any change for sweeping transaction');
    }
    _outputs.forEach((output) => {
      const spliceIndex = outputs.findIndex(
        (sweepOutput: Output) => output.value === sweepOutput.value
      );
      outputs.splice(spliceIndex, 1);
    });
    _outputs.push({
      to: externalChangeAddress,
      value: outputs[0].value,
    });
    return this.client.getMethod('_buildTransaction')(
      _outputs,
      feePerByte,
      inputs
    );
  }
}

interface Input {
  txid: string;
  vout: number;
  address: string;
  label: string;
  scriptPubKey: string;
  amount: number;
  confirmations: number;
  spendable: boolean;
  solvable: boolean;
  safe: boolean;
  satoshis: number;
  value: number;
  derivationPath: string;
}

interface Output {
  to: string;
  value: number;
}
