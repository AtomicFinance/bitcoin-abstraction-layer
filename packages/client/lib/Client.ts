import * as _ from 'lodash';
const { find, findLast, findLastIndex, isFunction } = _;

import Dlc from './Dlc';
import Cfd from './Cfd';
import Wallet from './Wallet';

import {
  DuplicateProviderError,
  InvalidProviderError,
  NoProviderError,
  UnimplementedMethodError,
} from '@liquality/errors';

export default class Client extends Dlc {
  _providers: Array<Client>;
  version: string;
  _dlc: Dlc;
  _cfd: Cfd;
  _wallet: Wallet;
  client: Client;
  identifier: string;

  /**
   * Client
   */
  constructor(client?: Client) {
    super(client);

    this.client = client;
    /**
     * @type {Array}
     */
    this._providers = [];

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
  addProvider(provider: any) {
    if (!isFunction(provider.setClient)) {
      throw new (InvalidProviderError(
        'Provider should have "setClient" method',
      ) as any)();
    }

    const duplicate = find(
      this._providers,
      (_provider) => provider.constructor === _provider.constructor,
    );

    if (duplicate) {
      throw new (DuplicateProviderError('Duplicate provider') as any)();
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
  getProviderForMethod(method: any, requestor: any = false): Client {
    if (this._providers.concat(this.client._providers).length === 0) {
      throw new (NoProviderError(
        'No provider provided. Add a provider to the client',
      ) as any)();
    }

    let indexOfRequestor = requestor
      ? findLastIndex(
          this._providers.concat(this.client._providers),
          function (provider) {
            return (
              requestor.constructor === provider.constructor ||
              (provider.getIdentifier &&
                requestor.getIdentifier() === provider.getIdentifier())
            );
          },
        )
      : this._providers.concat(this.client._providers).length;

    if (indexOfRequestor === -1) indexOfRequestor = 0;

    const provider = findLast(
      this._providers.concat(this.client._providers),
      function (provider) {
        try {
          return isFunction((provider as any)[method]);
        } catch (e) {
          try {
            return isFunction(provider.getMethod(method));
          } catch (e) {
            return false;
          }
        }
      },
      indexOfRequestor - 1,
    );

    if (provider == null) {
      throw new (UnimplementedMethodError(
        `Unimplemented method "${method}"`,
      ) as any)();
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
  getMethod(method: any, requestor?: any): any {
    try {
      const provider = this.getProviderForMethod(method, requestor);
      return (provider as any)[method].bind(provider);
    } catch (e) {
      try {
        return this.client.getMethod(method);
      } catch (e) {
        return (this.client as any)[method];
      }
    }
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

  getIdentifier() {
    return this.identifier;
  }
}
