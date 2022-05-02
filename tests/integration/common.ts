/* eslint-env mocha */
import { Input } from '@atomicfinance/types';
import { BitcoinJsWalletProvider } from '@liquality/bitcoin-js-wallet-provider';
import { BitcoinNodeWalletProvider } from '@liquality/bitcoin-node-wallet-provider';
import { BitcoinRpcProvider } from '@liquality/bitcoin-rpc-provider';
import { decodeRawTransaction } from '@liquality/bitcoin-utils';
import { Client } from '@liquality/client';
import * as errors from '@liquality/errors';
import { bitcoin } from '@liquality/types';
import * as utils from '@liquality/utils';
import BN from 'bignumber.js';
import { generateMnemonic } from 'bip39';
import * as cfdJs from 'cfd-js';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import BitcoinCfdProvider from '../../packages/bitcoin-cfd-provider/lib';
import BitcoinDlcProvider from '../../packages/bitcoin-dlc-provider/lib';
import BitcoinWalletProvider from '../../packages/bitcoin-wallet-provider/lib';
import { Client as FinanceClient } from '../../packages/client/lib';
import config from './config';
import { getWrappedCfdDlcJs } from './utils/WrappedCfdDlcJs';

const cfdDlcJs = getWrappedCfdDlcJs();

const sleep = utils.sleep;

chai.use(chaiAsPromised);

const CONSTANTS = {
  BITCOIN_FEE_PER_BYTE: 3,
  BITCOIN_ADDRESS_DEFAULT_BALANCE: 2 * 1e8,
};

const { network, rpc } = config.bitcoin;

// eslint-disable-next-line @typescript-eslint/no-empty-function
console.warn = () => {}; // Silence warnings

function mockedBitcoinRpcProvider(): BitcoinRpcProvider {
  const bitcoinRpcProvider = new BitcoinRpcProvider({
    uri: rpc.host,
    username: rpc.username,
    password: rpc.password,
    network,
  });
  // Mock Fee Per Byte to prevent from changing
  bitcoinRpcProvider.getFeePerByte = async () => CONSTANTS.BITCOIN_FEE_PER_BYTE;
  return bitcoinRpcProvider;
}

const bitcoinWithNode = new FinanceClient();
bitcoinWithNode.addProvider(mockedBitcoinRpcProvider());
bitcoinWithNode.addProvider(
  new BitcoinNodeWalletProvider({
    uri: rpc.host,
    username: rpc.username,
    password: rpc.password,
    network,
    addressType: bitcoin.AddressType.BECH32,
  }),
);
bitcoinWithNode.addProvider(new BitcoinCfdProvider(cfdJs));
bitcoinWithNode.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));
bitcoinWithNode.addProvider(new BitcoinWalletProvider(network));

const bitcoinWithJs = new FinanceClient();
bitcoinWithJs.addProvider(mockedBitcoinRpcProvider());
bitcoinWithJs.addProvider(
  new BitcoinJsWalletProvider({
    network,
    mnemonic: generateMnemonic(256),
    baseDerivationPath: `m/84'/${config.bitcoin.network.coinType}'/0'`,
    addressType: bitcoin.AddressType.BECH32,
  }) as any,
);
bitcoinWithJs.addProvider(new BitcoinCfdProvider(cfdJs));
bitcoinWithJs.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));
bitcoinWithJs.addProvider(new BitcoinWalletProvider(network));

const bitcoinWithJs2 = new FinanceClient();
bitcoinWithJs2.addProvider(mockedBitcoinRpcProvider());
bitcoinWithJs2.addProvider(
  new BitcoinJsWalletProvider({
    network,
    mnemonic: generateMnemonic(256),
    baseDerivationPath: `m/84'/${config.bitcoin.network.coinType}'/0'`,
    addressType: bitcoin.AddressType.BECH32,
  }) as any,
);
bitcoinWithJs2.addProvider(new BitcoinCfdProvider(cfdJs));
bitcoinWithJs2.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));
bitcoinWithJs2.addProvider(new BitcoinWalletProvider(network));

const bitcoinWithJs3 = new FinanceClient();
bitcoinWithJs3.addProvider(mockedBitcoinRpcProvider());
bitcoinWithJs3.addProvider(
  new BitcoinJsWalletProvider({
    network,
    mnemonic: generateMnemonic(256),
    baseDerivationPath: `m/84'/${config.bitcoin.network.coinType}'/0'`,
    addressType: bitcoin.AddressType.BECH32,
  }) as any,
);
bitcoinWithJs3.addProvider(new BitcoinCfdProvider(cfdJs));
bitcoinWithJs3.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));
bitcoinWithJs3.addProvider(new BitcoinWalletProvider(network));

/**
 * bitcoinWithJs4 corresponds to counterparty of dlc offer, accept, sign and txs messages in fixtures
 *
 * It was added to test the specific case where derivation path is > 500
 * Relevant issue: https://github.com/AtomicFinance/chainify-finance/issues/109
 */
const bitcoinWithJs4 = new FinanceClient();
bitcoinWithJs4.addProvider(mockedBitcoinRpcProvider());
bitcoinWithJs4.addProvider(
  new BitcoinJsWalletProvider({
    network,
    mnemonic:
      'half chaos stage view guilt powder meadow dish join frog expose wise ask remove pyramid female december possible eye trial coach bench champion polar',
    baseDerivationPath: `m/84'/${config.bitcoin.network.coinType}'/0'`,
    addressType: bitcoin.AddressType.BECH32,
  }) as any,
);
bitcoinWithJs4.addProvider(new BitcoinCfdProvider(cfdJs));
bitcoinWithJs4.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));
bitcoinWithJs4.addProvider(new BitcoinWalletProvider(network));

const chains = {
  bitcoinWithNode: {
    id: 'Bitcoin Node',
    name: 'bitcoin',
    client: bitcoinWithNode,
    network: network,
    segwitFeeImplemented: true,
  },
  bitcoinWithJs: {
    id: 'Bitcoin Js',
    name: 'bitcoin',
    client: bitcoinWithJs,
    network: network,
  },
  bitcoinWithJs2: {
    id: 'Bitcoin Js',
    name: 'bitcoin',
    client: bitcoinWithJs2,
    network: network,
  },
  bitcoinWithJs3: {
    id: 'Bitcoin Js',
    name: 'bitcoin',
    client: bitcoinWithJs3,
    network: network,
  },
  bitcoinWithJs4: {
    id: 'Bitcoin Js',
    name: 'bitcoin',
    client: bitcoinWithJs4,
    network: network,
  },
};

async function fundAddress(address: string) {
  const tx = await chains.bitcoinWithNode.client.chain.sendTransaction({
    to: address,
    value: new BN(CONSTANTS.BITCOIN_ADDRESS_DEFAULT_BALANCE),
  });
  await mineBlock();
  return tx;
}

async function importAddresses(chain: Chain) {
  return chain.client.getMethod('importAddresses')();
}

async function mineBlock() {
  try {
    await chains.bitcoinWithNode.client.chain.generateBlock(1);
  } catch (e) {
    if (!(e instanceof errors.UnimplementedMethodError)) throw e;
    console.log(
      'Skipped mining block - not implement for chain - probably client automines',
    );
  }
}

async function getInput(
  client: Client,
  unusedAddress?: string,
): Promise<Input> {
  let derivationPath;
  if (!unusedAddress) {
    ({
      address: unusedAddress,
      derivationPath,
    } = await client.wallet.getUnusedAddress());
  }

  await client.getMethod('jsonrpc')('importaddress', unusedAddress, '', false);

  const txRaw = await fundAddress(unusedAddress);
  const tx = await decodeRawTransaction(txRaw._raw.hex, network);

  const vout = tx.vout.find(
    (vout: any) => vout.scriptPubKey.addresses[0] === unusedAddress,
  );

  const input: Input = {
    txid: tx.txid,
    vout: vout.n,
    address: unusedAddress,
    scriptPubKey: vout.scriptPubKey.hex,
    amount: vout.value,
    value: new BN(vout.value).times(1e8).toNumber(),
    derivationPath,
    maxWitnessLength: 108,
    redeemScript: '',
    toUtxo: Input.prototype.toUtxo,
  };

  return input;
}

interface Chain {
  id: string;
  name: string;
  client: Client;
  network: any;
  segwitFeeImplemented?: boolean;
}

export {
  CONSTANTS,
  chains,
  sleep,
  fundAddress,
  importAddresses,
  mineBlock,
  mockedBitcoinRpcProvider,
  getInput,
  network,
};
