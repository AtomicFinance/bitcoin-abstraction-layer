import FinanceProvider from '@atomicfinance/provider';
import { Client } from '@liquality/client';
import { Provider } from '@liquality/provider';

import Cfd from './Cfd';
import Dlc from './Dlc';
import Wallet from './Wallet';

export default class FinanceClient extends Client {
  version: string;
  _dlc: Dlc;
  _cfd: Cfd;
  _financewallet: Wallet;
  identifier: string;

  /**
   * Client
   */
  constructor(provider?: Provider | FinanceProvider, version?: string) {
    super(provider, version);

    /**
     * @type {Array}
     */
    this._providers = [];

    this._dlc = new Dlc(this);
    this._cfd = new Cfd(this);
    this._financewallet = new Wallet(this);

    this.identifier = 'Client';
  }

  get dlc() {
    return this._dlc;
  }

  get cfd() {
    return this._cfd;
  }

  get financewallet() {
    return this._financewallet;
  }
}
