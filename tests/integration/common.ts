/* eslint-env mocha */
import * as ddkJs from '@bennyblader/ddk-ts';
import BN from 'bignumber.js';
import { generateMnemonic } from 'bip39';
import * as cfdJs from 'cfd-js';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import BitcoinCfdProvider from '../../packages/bitcoin-cfd-provider/lib';
import BitcoinDdkProvider from '../../packages/bitcoin-ddk-provider/lib';
import BitcoinDlcProvider from '../../packages/bitcoin-dlc-provider/lib';
import { BitcoinJsWalletProvider } from '../../packages/bitcoin-js-wallet-provider';
import { BitcoinNodeWalletProvider } from '../../packages/bitcoin-node-wallet-provider';
import { BitcoinRpcProvider } from '../../packages/bitcoin-rpc-provider';
import { decodeRawTransaction } from '../../packages/bitcoin-utils';
import { Client } from '../../packages/client';
import * as errors from '../../packages/errors';
import Provider from '../../packages/provider/lib';
import { bitcoin } from '../../packages/types';
import { Input } from '../../packages/types/';
import { Transaction } from '../../packages/types/lib';
import * as utils from '../../packages/utils';
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

const bitcoinWithNode = new Client();
bitcoinWithNode.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);
bitcoinWithNode.addProvider(
  new BitcoinNodeWalletProvider({
    uri: rpc.host,
    username: rpc.username,
    password: rpc.password,
    network,
    addressType: bitcoin.AddressType.BECH32,
  }) as unknown as Provider,
);
bitcoinWithNode.addProvider(new BitcoinCfdProvider(cfdJs));
bitcoinWithNode.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));

const bitcoinWithJs = new Client();
bitcoinWithJs.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);
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

const bitcoinWithJs2 = new Client();
bitcoinWithJs2.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);
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

const bitcoinWithJs3 = new Client();
bitcoinWithJs3.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);
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

/**
 * bitcoinWithJs4 corresponds to counterparty of dlc offer, accept, sign and txs messages in fixtures
 *
 * It was added to test the specific case where derivation path is > 500
 * Relevant issue: https://github.com/AtomicFinance/bitcoin-abstraction-layer/issues/109
 */
const bitcoinWithJs4 = new Client();
bitcoinWithJs4.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);
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

const bitcoinWithJs5 = new Client();
bitcoinWithJs5.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);
bitcoinWithJs5.addProvider(
  new BitcoinJsWalletProvider({
    network,
    mnemonic: generateMnemonic(256),
    baseDerivationPath: `m/84'/${config.bitcoin.network.coinType}'/0'`,
    addressType: bitcoin.AddressType.BECH32,
    addressIndex: 100, // custom starting addressIndex
    changeAddressIndex: 100, // custom starting changeAddressIndex
  }) as any,
);
bitcoinWithJs5.addProvider(new BitcoinCfdProvider(cfdJs));
bitcoinWithJs5.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));

const bitcoinWithDdk = new Client();
bitcoinWithDdk.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);
bitcoinWithDdk.addProvider(
  new BitcoinJsWalletProvider({
    network,
    mnemonic: generateMnemonic(256),
    baseDerivationPath: `m/84'/${config.bitcoin.network.coinType}'/0'`,
    addressType: bitcoin.AddressType.BECH32,
  }) as any,
);
bitcoinWithDdk.addProvider(new BitcoinDdkProvider(network, ddkJs));

const bitcoinWithDdk2 = new Client();
bitcoinWithDdk2.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);
bitcoinWithDdk2.addProvider(
  new BitcoinJsWalletProvider({
    network,
    mnemonic: generateMnemonic(256),
    baseDerivationPath: `m/84'/${config.bitcoin.network.coinType}'/0'`,
    addressType: bitcoin.AddressType.BECH32,
  }) as any,
);
bitcoinWithDdk2.addProvider(new BitcoinDdkProvider(network, ddkJs));

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
  bitcoinWithJs5: {
    id: 'Bitcoin Js',
    name: 'bitcoin',
    client: bitcoinWithJs5,
    network: network,
  },
  bitcoinWithDdk: {
    id: 'Bitcoin DDK',
    name: 'bitcoin',
    client: bitcoinWithDdk,
    network: network,
  },
  bitcoinWithDdk2: {
    id: 'Bitcoin DDK',
    name: 'bitcoin',
    client: bitcoinWithDdk2,
    network: network,
  },
};

async function fundAddress(address: string): Promise<Transaction<any>> {
  const tx = await chains.bitcoinWithNode.client.chain.sendTransaction({
    to: address,
    value: new BN(CONSTANTS.BITCOIN_ADDRESS_DEFAULT_BALANCE),
  });
  await mineBlock();
  return tx;
}

async function importAddresses(chain: Chain): Promise<void> {
  return chain.client.getMethod('importAddresses')();
}

async function mineBlock(numBlocks = 1): Promise<void> {
  try {
    await chains.bitcoinWithNode.client.chain.generateBlock(numBlocks);
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
  addressWithDerivationPath?: { address: string; derivationPath?: string },
): Promise<Input> {
  let derivationPath;
  if (!unusedAddress) {
    ({ address: unusedAddress, derivationPath } =
      await client.wallet.getUnusedAddress());
  } else {
    // If addressWithDerivationPath is provided, use its derivation path
    if (addressWithDerivationPath?.derivationPath) {
      derivationPath = addressWithDerivationPath.derivationPath;
    } else {
      // Get derivation path for the provided address
      try {
        const walletAddress =
          await client.getMethod('getWalletAddress')(unusedAddress);
        derivationPath = walletAddress.derivationPath;
      } catch (error) {
        // If address is not found in wallet, derivationPath remains undefined
        console.warn(
          `Address ${unusedAddress} not found in wallet: ${error.message}`,
        );
      }
    }
  }

  await client.getMethod('jsonrpc')('importaddress', unusedAddress, '', false);

  const txRaw = await fundAddress(unusedAddress);
  const tx = await decodeRawTransaction(txRaw._raw.hex, network);

  const vout = tx.vout.find(
    (vout: any) => vout.scriptPubKey.addresses[0] === unusedAddress,
  );

  const input: Input = new Input(
    tx.txid,
    vout.n,
    unusedAddress,
    vout.value,
    new BN(vout.value).times(1e8).toNumber(),
    derivationPath,
    108, // maxWitnessLength
    '', // redeemScript
    undefined, // inputSerialId
    vout.scriptPubKey.hex, // scriptPubKey
    undefined, // label
    undefined, // confirmations
    undefined, // spendable
    undefined, // solvable
    undefined, // safe
    undefined, // dlcInput
  );

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
