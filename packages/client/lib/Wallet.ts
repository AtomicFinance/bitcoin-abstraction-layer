import { Input, Output } from '@atomicfinance/types';

export default class Wallet {
  client: any;

  constructor(client: any) {
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
