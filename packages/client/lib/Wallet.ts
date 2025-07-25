import { CoinSelectTarget } from '@atomicfinance/bitcoin-utils';
import {
  InvalidProviderResponseError,
  UnimplementedMethodError,
} from '@atomicfinance/errors';
import {
  Address,
  bitcoin as bT,
  CreateMultisigResponse,
  Input,
  Output,
  Transaction as Tx,
  WalletProvider,
} from '@atomicfinance/types';
import { Transaction } from 'bitcoinjs-lib';
import { isArray } from 'lodash';

export default class Wallet implements WalletProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any) {
    this.client = client;
  }

  /**
   * Get addresses/accounts of the user.
   * @param {number} [startingIndex] - Index to start
   * @param {number} [numAddresses] - Number of addresses to retrieve
   * @param {boolean} [change] - True for change addresses
   * @return {Promise<Address[], InvalidProviderResponseError>} Resolves with a list
   *  of addresses.
   *  Rejects with InvalidProviderResponseError if provider's response is invalid.
   */
  async getAddresses(
    startingIndex?: number,
    numAddresses?: number,
    change?: boolean,
  ): Promise<Address[]> {
    const addresses = await this.client.getMethod('getAddresses')(
      startingIndex,
      numAddresses,
      change,
    );

    if (!isArray(addresses)) {
      throw new InvalidProviderResponseError(
        'Provider returned an invalid response',
      );
    }

    return addresses;
  }

  /**
   * Get used addresses/accounts of the user.
   * @param {number} [numAddressPerCall] - Number of addresses to retrieve per call
   * @return {Promise<Address[], InvalidProviderResponseError>} Resolves with a list
   *  of addresses.
   *  Rejects with InvalidProviderResponseError if provider's response is invalid.
   */
  async getUsedAddresses(numAddressPerCall?: number): Promise<Address[]> {
    return this.client.getMethod('getUsedAddresses')(numAddressPerCall);
  }

  /**
   * Get unused address/account of the user.
   * @param {boolean} [change] - True for change addresses
   * @param {number} [numAddressPerCall] - Number of addresses to retrieve per call
   * @return {Promise<Address, InvalidProviderResponseError>} Resolves with a address
   *  object.
   *  Rejects with InvalidProviderResponseError if provider's response is invalid.
   */
  async getUnusedAddress(
    change?: boolean,
    numAddressPerCall?: number,
  ): Promise<Address> {
    return this.client.getMethod('getUnusedAddress')(change, numAddressPerCall);
  }

  /**
   * Sign a message.
   * @param {!string} message - Message to be signed.
   * @param {!string} from - The address from which the message is signed.
   * @return {Promise<string>} Resolves with a signed message.
   */
  async signMessage(message: string, from: string): Promise<string> {
    return this.client.getMethod('signMessage')(message, from);
  }

  /**
   * Retrieve the network connected to by the wallet
   * @return {Promise<any>} Resolves with the network object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getConnectedNetwork(): Promise<any> {
    return this.client.getMethod('getConnectedNetwork')();
  }

  /**
   * Retrieve the availability status of the wallet
   * @return {Promise<Boolean>} True if the wallet is available to use
   */
  async isWalletAvailable(): Promise<boolean> {
    return this.client.getMethod('isWalletAvailable')();
  }

  /**
   * Flag indicating if the wallet allows apps to update transaction fees
   * @return {Promise<Boolean>} True if wallet accepts fee updating
   */
  get canUpdateFee(): boolean {
    try {
      return this.client.getMethod('canUpdateFee')();
    } catch (e) {
      if (!(e instanceof UnimplementedMethodError)) throw e;
    }
    return true;
  }

  /**
   * Retrieve the private key for the account
   * @return {Promise<string>} Resolves with the key as a string
   */
  exportPrivateKey(): Promise<string> {
    return this.client.getMethod('exportPrivateKey')();
  }

  async findAddress(
    addresses: string[],
    change: boolean | null = null,
  ): Promise<Address> {
    return this.client.getMethod('findAddress')(addresses, change);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setUnusedAddressesBlacklist(unusedAddressesBlacklist: any) {
    return this.client.getMethod('setUnusedAddressesBlacklist')(
      unusedAddressesBlacklist,
    );
  }

  getUnusedAddressesBlacklist() {
    return this.client.getMethod('getUnusedAddressesBlacklist')();
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

  walletProcessPSBT(psbtString: string): Promise<string> {
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
  ): Promise<{
    hex: string;
    fee: number;
  }> {
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
  ): Promise<Tx<bT.Transaction>> {
    return this.client.getMethod('sendSweepTransactionWithSetOutputs')(
      externalChangeAddress,
      feePerByte,
      outputs,
      fixedInputs,
    );
  }

  async getInputsForAmount(
    _targets: bT.OutputTarget[],
    feePerByte?: number,
    fixedInputs: bT.Input[] = [],
    numAddressPerCall = 100,
    sweep = false,
  ): Promise<{
    inputs: bT.UTXO[];
    change: CoinSelectTarget;
    outputs: CoinSelectTarget[];
    fee: number;
  }> {
    return this.client.getMethod('getInputsForAmount')(
      _targets,
      feePerByte,
      fixedInputs,
      numAddressPerCall,
      sweep,
    );
  }

  async getInputsForDualFunding(
    collaterals: number[],
    feePerByte?: number,
    fixedInputs: bT.Input[] = [],
    numAddressPerCall = 100,
  ): Promise<{
    inputs: bT.UTXO[];
    fee: bigint;
  }> {
    return this.client.getMethod('getInputsForDualFunding')(
      collaterals,
      feePerByte,
      fixedInputs,
      numAddressPerCall,
    );
  }
}
