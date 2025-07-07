import {
  DuplicateProviderError,
  InvalidProviderError,
  InvalidProviderResponseError,
  NoProviderError,
  UnimplementedMethodError,
  UnsupportedMethodError,
} from '@atomicfinance/errors';
import Provider from '@atomicfinance/provider';
import { Block, IClient, Transaction } from '@atomicfinance/types';
import Ajv from 'ajv';
import { find, findLast, findLastIndex, isFunction } from 'lodash';

import Cfd from './Cfd';
import Chain from './Chain';
import Dlc from './Dlc';
import {
  Block as BlockSchema,
  Transaction as TransactionSchema,
} from './schema';
import Wallet from './Wallet';

export default class Client implements IClient {
  _providers: Provider[];
  version: string;

  validateTransaction: Ajv.ValidateFunction;
  validateBlock: Ajv.ValidateFunction;

  _dlc: Dlc;
  _cfd: Cfd;
  _wallet: Wallet;
  _chain: Chain;
  identifier: string;

  /**
   * Client
   */
  constructor(provider?: Provider, version?: string) {
    /**
     * @type {Array}
     */
    this._providers = [];

    /**
     * @type {string}
     */
    this.version = version;

    if (provider) {
      this.addProvider(provider);
    }

    const ajv = new Ajv();
    this.validateTransaction = ajv.compile(TransactionSchema);
    this.validateBlock = ajv.compile(BlockSchema);

    this._chain = new Chain(this);
    this._dlc = new Dlc(this);
    this._cfd = new Cfd(this);
    this._wallet = new Wallet(this);

    this.identifier = 'Client';
  }

  /**
   * Add a provider
   * @param {!Provider} provider - The provider instance or RPC connection string
   * @return {Client} Returns instance of Client
   * @throws {InvalidProviderError} When invalid provider is provider
   * @throws {DuplicateProviderError} When same provider is added again
   */
  addProvider(provider: Provider) {
    if (!isFunction(provider.setClient)) {
      throw new InvalidProviderError('Provider should have "setClient" method');
    }

    const duplicate = find(
      this._providers,
      (_provider) => provider.constructor === _provider.constructor,
    );

    if (duplicate) {
      throw new DuplicateProviderError('Duplicate provider');
    }

    provider.setClient(this);
    this._providers.push(provider);

    return this;
  }

  /**
   * Check the availability of a method.
   * @param {!string} method - Name of the method to look for in the provider stack
   * @param {boolean|object} [requestor=false] - If provided, it returns providers only
   *  above the requestor in the stack.
   * @return {Provider} Returns a provider instance associated with the requested method
   * @throws {NoProviderError} When no provider is available in the stack.
   * @throws {UnimplementedMethodError} When the requested method is not provided
   *  by any provider above requestor in the provider stack
   * @throws {UnsupportedMethodError} When requested method is not supported by
   *  version specified
   */
  getProviderForMethod(method: string, requestor = false) {
    if (this._providers.length === 0) {
      throw new NoProviderError(
        'No provider provided. Add a provider to the client',
      );
    }

    let indexOfRequestor = requestor
      ? findLastIndex(
          this._providers,
          (provider) => requestor.constructor === provider.constructor,
        )
      : this._providers.length;

    if (indexOfRequestor === -1) indexOfRequestor = 0;

    const provider = findLast(
      this._providers,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (provider) => isFunction((<any>provider)[method]),
      indexOfRequestor - 1,
    );

    if (provider == null) {
      throw new UnimplementedMethodError(`Unimplemented method "${method}"`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isFunction((<any>provider)._checkMethodVersionSupport)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(<any>provider)._checkMethodVersionSupport(method, this.version)) {
        throw new UnsupportedMethodError(
          `Method "${method}" is not supported by version "${this.version}"`,
        );
      }
    }

    return provider;
  }

  /**
   * Helper method that returns method from a provider.
   * @param {!string} method - Name of the method to look for in the provider stack
   * @param {object} [requestor] - If provided, it returns method from providers only
   *  above the requestor in the stack.
   * @return {function} Returns method from provider instance associated with the requested method
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMethod(method: string, requestor?: any): (...args: any[]) => any {
    const provider = this.getProviderForMethod(method, requestor);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any>provider)[method].bind(provider);
  }

  assertValidTransaction(transaction: Transaction) {
    if (!this.validateTransaction(transaction)) {
      const { errors } = this.validateTransaction;
      throw new InvalidProviderResponseError(
        `Provider returned an invalid transaction, "${errors[0].dataPath}" ${errors[0].message}`,
      );
    }
  }

  assertValidBlock(block: Block) {
    if (!this.validateBlock(block)) {
      const { errors } = this.validateBlock;
      throw new InvalidProviderResponseError(
        `Provider returned an invalid block, "${errors[0].dataPath}" ${errors[0].message}`,
      );
    }
  }

  get chain() {
    return this._chain;
  }

  get dlc() {
    return this._dlc;
  }

  get cfd() {
    return this._cfd;
  }

  get wallet() {
    return this._wallet;
  }
}
