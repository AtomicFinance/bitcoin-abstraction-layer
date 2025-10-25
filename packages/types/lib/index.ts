import BigNumber from 'bignumber.js';

import { Address } from './address';
import * as bitcoin from './bitcoin';
import { Block } from './block';
import { CfdProvider } from './cfd';
import { ChainProvider, SendOptions } from './chain';
import { DlcProvider } from './dlc';
import { FeeDetail, FeeDetails, FeeProvider } from './fees';
import * as BitcoinJsonRpcTypes from './jsonrpc';
import { Network } from './network';
import { Transaction, TxStatus } from './transaction';
import { WalletProvider } from './wallet';

interface IClient {
  /**
   * Helper method that returns method from a provider.
   * @param {!string} method - Name of the method to look for in the provider stack
   * @param {object} [requestor] - If provided, it returns method from providers only
   *  above the requestor in the stack.
   * @return {function} Returns method from provider instance associated with the requested method
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMethod(method: string, requestor?: any): () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProviderForMethod(method: string, requestor?: boolean): any;

  chain: ChainProvider;
  wallet: WalletProvider;
  cfd: CfdProvider;
  dlc: DlcProvider;
}

export * from './cfd';
export * from './common';
export * from './dlc';
export * from './ddk';
export * from './network-utils';
export { default as Amount } from './models/Amount';
export {
  default as Input,
  InputSupplementationMode,
  DlcInputInfo,
} from './models/Input';
export { default as OracleInfo } from './models/OracleInfo';
export { default as Outcome } from './models/Outcome';
export { default as Output } from './models/Output';
export { default as Utxo } from './models/Utxo';
export * from './wallet';
export {
  BigNumber,
  IClient,
  CfdProvider,
  DlcProvider,
  ChainProvider,
  WalletProvider,
  Address,
  SendOptions,
  Block,
  Transaction,
  TxStatus,
  FeeDetails,
  FeeDetail,
  FeeProvider,
  Network,
  BitcoinJsonRpcTypes,
  bitcoin,
};
