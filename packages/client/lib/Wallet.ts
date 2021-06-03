import { CreateMultisigResponse, Input, Output } from '@atomicfinance/types';
import { Transaction } from 'bitcoinjs-lib';

export default class Wallet {
  client: any;

  constructor(client: any) {
    this.client = client;
  }

  createMultisig(m: number, pubkeys: string[]): CreateMultisigResponse {
    return this.client.getMethod('createMultisig')(m, pubkeys);
  }

  buildMultisigPSBT(
    m: number,
    pubkeys: string[],
    inputs: Input[],
    outputs: Output[],
  ): string {
    return this.client.getMethod('buildMultisigPSBT')(
      m,
      pubkeys,
      inputs,
      outputs,
    );
  }

  walletProcessPSBT(psbtString: string): string {
    return this.client.getMethod('walletProcessPSBT')(psbtString);
  }

  finalizePSBT(psbtString: string): Transaction {
    return this.client.getMethod('finalizePSBT')(psbtString);
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

  async quickFindAddress(addresses: string[]) {
    return this.client.getMethod('quickFindAddress')(addresses);
  }
}
