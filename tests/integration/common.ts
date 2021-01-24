/* eslint-env mocha */
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
// TOOD: Connector does not work for EIP1193
import Client from '@liquality/client'
import * as crypto from '@liquality/crypto'
import * as errors from '@liquality/errors'
import * as utils from '@liquality/utils'
import BitcoinNodeWalletProvider from '@liquality/bitcoin-node-wallet-provider'
import BitcoinJsWalletProvider from '@liquality/bitcoin-js-wallet-provider'
import BitcoinRpcProvider from '@liquality/bitcoin-rpc-provider'
import * as BitcoinUtils from '@liquality/bitcoin-utils'
import { Client as FinanceClient } from '../../packages/client/lib'
import BitcoinCfdProvider from '../../packages/bitcoin-cfd-provider/lib'
import BitcoinDlcProvider from '../../packages/bitcoin-dlc-provider/lib'
import BitcoinWalletProvider from '../../packages/bitcoin-wallet-provider/lib'
import { findLast } from 'lodash'
import { generateMnemonic } from 'bip39'
import config from './config'
import BigNumber from 'bignumber.js'

const providers = {
  bitcoin: {
    BitcoinRpcProvider,
    BitcoinNodeWalletProvider,
    BitcoinJsWalletProvider,
    BitcoinUtils
  }
}

const sleep = utils.sleep

chai.use(chaiAsPromised)

const CONSTANTS = {
  BITCOIN_FEE_PER_BYTE: 3,
  BITCOIN_ADDRESS_DEFAULT_BALANCE: 50 * 1e8
}

console.warn = () => {} // Silence warnings

function mockedBitcoinRpcProvider () {
  const bitcoinRpcProvider = new providers.bitcoin.BitcoinRpcProvider(config.bitcoin.rpc.host, config.bitcoin.rpc.username, config.bitcoin.rpc.password)
  // Mock Fee Per Byte to prevent from changing
  bitcoinRpcProvider.getFeePerByte = async () => CONSTANTS.BITCOIN_FEE_PER_BYTE
  return bitcoinRpcProvider
}

const bitcoinWithNode = new Client()
const bitcoinWithNodeFinance = new FinanceClient(bitcoinWithNode);
bitcoinWithNode.finance = bitcoinWithNodeFinance
bitcoinWithNode.addProvider(mockedBitcoinRpcProvider())
bitcoinWithNode.addProvider(new providers.bitcoin.BitcoinNodeWalletProvider(config.bitcoin.network, config.bitcoin.rpc.host, config.bitcoin.rpc.username, config.bitcoin.rpc.password, 'bech32'))
bitcoinWithNode.finance.addProvider(new BitcoinCfdProvider(config.bitcoin.network));
bitcoinWithNode.finance.addProvider(new BitcoinDlcProvider(config.bitcoin.network));
bitcoinWithNode.finance.addProvider(new BitcoinWalletProvider(config.bitcoin.network));

const bitcoinWithJs = new Client()
const bitcoinWithJsFinance = new FinanceClient(bitcoinWithJs);
bitcoinWithJs.finance = bitcoinWithJsFinance
bitcoinWithJs.addProvider(mockedBitcoinRpcProvider())
bitcoinWithJs.addProvider(new providers.bitcoin.BitcoinJsWalletProvider(config.bitcoin.network, generateMnemonic(256), 'bech32'))
bitcoinWithJs.finance.addProvider(new BitcoinCfdProvider(config.bitcoin.network));
bitcoinWithJs.finance.addProvider(new BitcoinDlcProvider(config.bitcoin.network));
bitcoinWithJs.finance.addProvider(new BitcoinWalletProvider(config.bitcoin.network));

const chains = {
  bitcoinWithNode: { id: 'Bitcoin Node', name: 'bitcoin', client: bitcoinWithNode, network: config.bitcoin.network, segwitFeeImplemented: true },
  bitcoinWithJs: { id: 'Bitcoin Js', name: 'bitcoin', client: bitcoinWithJs, network: config.bitcoin.network }
}

export {
  CONSTANTS,
  chains,
  sleep
}
