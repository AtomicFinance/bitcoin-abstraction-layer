/* eslint-env mocha */
// import chai, { expect } from 'chai'
// import chaiAsPromised from 'chai-as-promised'
import { Client, providers } from '@liquality/bundle'
import { Client as FinanceClient, providers as financeProviders } from '../../packages/bundle/lib'
// import Provider from '../../packages/provider/lib'
// import { sleep } from '../../packages/utils'
// import { findLast } from 'lodash'
import { generateMnemonic } from 'bip39'
import config from './config'
// import BigNumber from 'bignumber.js'

// chai.use(chaiAsPromised)

const CONSTANTS = {
  BITCOIN_FEE_PER_BYTE: 3,
  BITCOIN_ADDRESS_DEFAULT_BALANCE: 50 * 1e8
}

// console.log('Provider', Provider)

console.warn = () => {} // Silence warnings

const bitcoinNetworks = providers.bitcoin.networks
const bitcoinNetwork = bitcoinNetworks[config.bitcoin.network]

const bitcoinWithEsplora = new Client()
const bitcoinWithEsploraFinance = new FinanceClient(bitcoinWithEsplora)

bitcoinWithEsplora.finance = bitcoinWithEsploraFinance
bitcoinWithEsplora.addProvider(new providers.bitcoin.BitcoinEsploraApiProvider('https://blockstream.info/testnet/api'))
bitcoinWithEsplora.addProvider(new providers.bitcoin.BitcoinJsWalletProvider(bitcoinNetwork, generateMnemonic(256), 'bech32'))

bitcoinWithEsplora.finance.addProvider(new financeProviders.bitcoin.BitcoinCfdProvider(bitcoinNetwork))
bitcoinWithEsplora.finance.addProvider(new financeProviders.bitcoin.BitcoinDlcProvider(bitcoinNetwork))

const chains = {
  bitcoinWithEsplora: { id: 'Bitcoin Esplora', name: 'bitcoin', client: bitcoinWithEsplora }
}

// async function importBitcoinAddresses (chain) {
//   return chain.client.getMethod('importAddresses')()
// }

// async function fundAddress (chain, address) {
//   if (chain.name === 'bitcoin') {
//     await chains.bitcoinWithNode.client.chain.sendTransaction(address, CONSTANTS.BITCOIN_ADDRESS_DEFAULT_BALANCE)
//   }
//   await mineBlock(chain)
// }

// async function fundWallet (chain) {
//   if (chain.funded) return

//   const address = await chain.client.wallet.getUnusedAddress()
//   await fundAddress(chain, address)
//   chain.funded = true
// }

// async function getRandomBitcoinAddress (chain) {
//   return findProvider(chain.client, providers.bitcoin.BitcoinRpcProvider).jsonrpc('getnewaddress')
// }

// async function mineBlock (chain) {
//   try {
//     await chain.client.chain.generateBlock(1)
//   } catch (e) {
//     if (!(e instanceof errors.UnimplementedMethodError)) throw e
//     console.log('Skipped mining block - not implement for chain - probably client automines')
//   }
// }

// async function mineUntilTimestamp (chain, timestamp) {
//   const maxNumBlocks = 100
//   for (let i = 0; i < maxNumBlocks; i++) {
//     const block = await chain.client.chain.getBlockByNumber(await chain.client.chain.getBlockHeight())
//     if (i === 0) console.log('\x1b[2m', `Mining until chain timestamp: ${timestamp}. Now: ${block.timestamp}. Remaining: ${timestamp - block.timestamp}s`, '\x1b[0m')
//     if (block.timestamp > timestamp) break
//     if (chain.name === 'ethereum') { // Send random tx to cause Geth to mime block
//       await chains.ethereumWithNode.client.chain.sendTransaction((await getNewAddress(chain)).address, 10000)
//     }
//     await mineBlock(chain)
//     await sleep(1000)
//   }
// }

// async function expectBalance (chain, address, func, comparison) {
//   const balanceBefore = await chain.client.chain.getBalance([address])
//   await func()
//   if (chain.name === 'bitcoin') await sleep(1000) // Node seems to need a little bit of time to process utxos
//   const balanceAfter = await chain.client.chain.getBalance([address])
//   comparison(balanceBefore, balanceAfter)
// }

// async function getBitcoinTransactionFee (chain, tx) {
//   const inputs = tx._raw.vin.map((vin) => ({ txid: vin.txid, vout: vin.vout }))
//   const inputTransactions = await Promise.all(
//     inputs.map(input => chain.client.chain.getTransactionByHash(input.txid))
//   )
//   const inputValues = inputTransactions.map((inputTx, index) => {
//     const vout = inputs[index].vout
//     const output = inputTx._raw.vout[vout]
//     return output.value * 1e8
//   })
//   const inputValue = inputValues.reduce((a, b) => a.plus(BigNumber(b)), BigNumber(0))

//   const outputValue = tx._raw.vout.reduce((a, b) => a.plus(BigNumber(b.value).times(BigNumber(1e8))), BigNumber(0))

//   const feeValue = inputValue.minus(outputValue)

//   return feeValue.toNumber()
// }

// async function expectFee (chain, txHash, expectedFeePerByte, swapInitiate = false, swapRedeem = false) {
//   if (chain.name === 'bitcoin') {
//     return swapRedeem // It's dumb because it does legacy calculation using 1 input 1 output
//       ? expectBitcoinSwapRedeemFee(chain, txHash, expectedFeePerByte)
//       : expectBitcoinFee(chain, txHash, expectedFeePerByte, swapInitiate)
//   }
//   if (chain.name === 'ethereum') {
//     return expectEthereumFee(chain, txHash, expectedFeePerByte)
//   }
// }

// async function expectBitcoinFee (chain, txHash, expectedFeePerByte, payToScript) {
//   const tx = await chain.client.chain.getTransactionByHash(txHash)
//   const fee = await getBitcoinTransactionFee(chain, tx)
//   let size = chain.segwitFeeImplemented ? tx._raw.vsize : tx._raw.size
//   if (payToScript && (chain.id.includes('Ledger') || chain.id.includes('Js'))) {
//     size -= 10 // Coin select fee calculation is off by 10 bytes as it does not consider pay to script
//   }
//   const maxFeePerByte = (expectedFeePerByte * (size + 2)) / size // https://github.com/bitcoin/bitcoin/blob/362f9c60a54e673bb3daa8996f86d4bc7547eb13/test/functional/test_framework/util.py#L40
//   const feePerByte = BigNumber(fee).div(size).toNumber()

//   expect(feePerByte).gte(expectedFeePerByte)
//   expect(feePerByte).lte(maxFeePerByte)
// }

// // A dumber fee calculation that is used in swap redeems - 1 in 1 out - legacy tx/inputs assumed
// async function expectBitcoinSwapRedeemFee (chain, txHash, expectedFeePerByte) {
//   const tx = await chain.client.chain.getTransactionByHash(txHash)
//   const fee = await getBitcoinTransactionFee(chain, tx)
//   const expectedFee = providers.bitcoin.BitcoinUtils.calculateFee(1, 1, expectedFeePerByte)

//   expect(fee).to.equal(expectedFee)
// }

// function findProvider (client, type) {
//   return findLast(
//     client._providers,
//     provider => provider instanceof type, client._providers.length
//   )
// }

// const describeExternal = process.env.RUN_EXTERNAL ? describe.only : describe.skip

export {
  CONSTANTS,
  chains,
  // getNewAddress,
  // getRandomAddress,
  // getRandomBitcoinAddress,
  // importBitcoinAddresses,
  // fundAddress,
  // fundWallet,
  // metaMaskConnector,
  // kibaConnector,
  // initiateAndVerify,
  // claimAndVerify,
  // refundAndVerify,
  // getSwapParams,
  // expectBalance,
  // expectFee,
  sleep,
  // stopEthAutoMining,
  // mineUntilTimestamp,
  // mineBlock,
  // deployERC20Token,
  // connectMetaMask,
  // connectKiba,
  // describeExternal
}
