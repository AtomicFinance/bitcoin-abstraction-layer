import { ChainProvider, SwapProvider, WalletProvider } from '@liquality/types';

import { CfdProvider } from './cfd';
import { DlcProvider } from './dlc';
import { FinanceWalletProvider } from './financewallet';

interface IFinanceClient {
  /**
   * Helper method that returns method from a provider.
   * @param {!string} method - Name of the method to look for in the provider stack
   * @param {object} [requestor] - If provided, it returns method from providers only
   *  above the requestor in the stack.
   * @return {function} Returns method from provider instance associated with the requested method
   */
  getMethod(method: string, requestor?: any): () => any;

  chain: ChainProvider;
  swap: SwapProvider;
  wallet: WalletProvider;
  cfd: CfdProvider;
  dlc: DlcProvider;
  financewallet: FinanceWalletProvider;
}

export * from './cfd';
export * from './common';
export * from './dlc';
export * from './financewallet';
export { default as Amount } from './models/Amount';
export { default as Input } from './models/Input';
export { default as OracleInfo } from './models/OracleInfo';
export { default as Outcome } from './models/Outcome';
export { default as Output } from './models/Output';
export { default as Utxo } from './models/Utxo';
export * from './wallet';
export { IFinanceClient, CfdProvider, DlcProvider, FinanceWalletProvider };
