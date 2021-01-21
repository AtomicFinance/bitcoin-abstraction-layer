import { v4 as uuidv4 } from "uuid";
// import { Client, ClientOption } from "bitcoin-simple-rpc";
import Client from '@liquality/client';
import {
  AcceptMessage,
  Input,
  OfferMessage,
  SignMessage,
} from '../../packages/bitcoin-dlc-provider/lib/index';
import {
  Client as FinanceClient,
  providers as dlcProviders,
} from '../../packages/bundle/lib/index';
import BitcoinRpcProvider from '@liquality/bitcoin-rpc-provider';
import BitcoinJsWalletProvider from '@liquality/bitcoin-js-wallet-provider';
import BitcoinNetworks from '@liquality/bitcoin-networks';

import { generateMnemonic } from 'bip39'

console.log('test')
// bitcoin_regtest

const bitcoinNetwork = BitcoinNetworks['bitcoin_regtest'];

const bitcoin = new Client();
const bitcoinFinance = new FinanceClient(bitcoin);

bitcoin.finance = bitcoinFinance;
bitcoin.addProvider(new BitcoinRpcProvider('http://localhost:18443', 'bitcoin', 'local321'));
bitcoin.addProvider(
  new BitcoinJsWalletProvider(bitcoinNetwork, generateMnemonic(256), 'bech32')
);

const cfdProvider = new dlcProviders.bitcoin.BitcoinCfdProvider(bitcoinNetwork);
// const dlcProvider = new dlcProviders.bitcoin.BitcoinDlcProvider(bitcoinNetwork);
// const walletProvider = new dlcProviders.bitcoin.BitcoinWalletProvider(
//   bitcoinNetwork
// );

// bitcoin.finance.addProvider(cfdProvider);
// bitcoin.finance.addProvider(dlcProvider);
// bitcoin.finance.addProvider(walletProvider);






// export function CreateWalletClient(walletName: string) {
//   const clientConfig: ClientOption = {
//     baseURL: `http://localhost:18443/wallet/${walletName}`,
//   };
//   clientConfig.auth = { username: "user", password: "pass" };

//   return new Client(clientConfig);
// }

// utilize CAL Finance and CAL stuff to build it
