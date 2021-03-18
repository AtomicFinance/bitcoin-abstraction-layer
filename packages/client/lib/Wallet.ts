import Client from './Client';

export default class Wallet {
  client: Client;

  constructor(client?: Client) {
    this.client = client;
  }

  async buildSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    outputs: Output[],
    fixedInputs: Input[],
  ) {
    return this.client.getMethod('buildSweepTransactionWithSetOutputs')(
      externalChangeAddress,
      feePerByte,
      outputs,
      fixedInputs,
    );
  }

  async sendSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    outputs: Output[],
    fixedInputs: Input[],
  ) {
    return this.client.getMethod('sendSweepTransactionWithSetOutputs')(
      externalChangeAddress,
      feePerByte,
      outputs,
      fixedInputs,
    );
  }

  async getUnusedAddress(change = false, numAddressPerCall = 100) {
    return this.client.getMethod('getUnusedAddress')(change, numAddressPerCall);
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
