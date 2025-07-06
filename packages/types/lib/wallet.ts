import { Address } from './address';
import Input from './models/Input';
import Output from './models/Output';

export interface finalizePSBTResponse {
  psbt: string;
  hex?: string;
  complete: boolean;
}

export interface WalletProvider {
  /**
   * Get addresses/accounts of the user.
   * @param {number} [startingIndex] - Index to start
   * @param {number} [numAddresses] - Number of addresses to retrieve
   * @param {boolean} [change] - True for change addresses
   * @return {Promise<Address[], InvalidProviderResponseError>} Resolves with a list
   *  of addresses.
   *  Rejects with InvalidProviderResponseError if provider's response is invalid.
   */
  getAddresses(
    startingIndex?: number,
    numAddresses?: number,
    change?: boolean,
  ): Promise<Address[]>;

  /**
   * Get used addresses/accounts of the user.
   * @param {number} [numAddressPerCall] - Number of addresses to retrieve per call
   * @return {Promise<Address[], InvalidProviderResponseError>} Resolves with a list
   *  of addresses.
   *  Rejects with InvalidProviderResponseError if provider's response is invalid.
   */
  getUsedAddresses(numAddressPerCall?: number): Promise<Address[]>;

  /**
   * findAddress is an optimized version of upstream CAL's findAddress.
   *
   * It searches through both change and non-change addresses (if change arg is not provided) each iteration.
   *
   * This is in contrast to the original findAddress function which searches
   * through all non-change addresses before moving on to change addresses.
   *
   * @param addresses
   * @returns {Promise<Address>}
   */
  findAddress(addresses: string[]): Promise<Address>;

  /**
   * Get unused address/account of the user.
   * @param {boolean} [change] - True for change addresses
   * @param {number} [numAddressPerCall] - Number of addresses to retrieve per call
   * @return {Promise<Address, InvalidProviderResponseError>} Resolves with a address
   *  object.
   *  Rejects with InvalidProviderResponseError if provider's response is invalid.
   */
  getUnusedAddress(
    change?: boolean,
    numAddressPerCall?: number,
  ): Promise<Address>;

  /**
   * Sign a message.
   * @param {!string} message - Message to be signed.
   * @param {!string} from - The address from which the message is signed.
   * @return {Promise<string>} Resolves with a signed message.
   */
  signMessage(message: string, from: string): Promise<string>;

  /**
   * Retrieve the network connected to by the wallet
   * @return {Promise<any>} Resolves with the network object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getConnectedNetwork(): Promise<any>;

  /**
   * Retrieve the availability status of the wallet
   * @return {Promise<Boolean>} True if the wallet is available to use
   */
  isWalletAvailable(): Promise<boolean>;

  /**
   * Flag indicating if the wallet allows apps to update transaction fees
   * @return {Promise<Boolean>} True if wallet accepts fee updating
   */
  canUpdateFee?: boolean | (() => boolean);

  /**
   * Exports the private key for the account
   * for BTC, https://en.bitcoin.it/wiki/Wallet_import_format
   * for ETH, the privateKey
   * for NEAR, the secretKey
   * @return {Promise<string>} Resolves with the key as a string
   */
  exportPrivateKey?: () => Promise<string>;

  buildSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[],
  );

  getUnusedAddressesBlacklist();

  setUnusedAddressesBlacklist(unusedAddressesBlacklist);

  sendSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[],
  );
}
