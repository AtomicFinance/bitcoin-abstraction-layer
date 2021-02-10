import BN from 'bignumber.js'
import chai from 'chai'
import { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import _ from 'lodash'
import * as crypto from '@liquality/crypto'
import * as BitcoinUtils from '@liquality/bitcoin-utils'
import { decodeRawTransaction } from '@liquality/bitcoin-utils';
import Client from '@liquality/client'
import { chains, fundAddress, importAddresses } from '../common'
import config from '../config'
import * as foo from '../../../packages/bitcoin-cfd-provider/lib'
import {
  CreateMultisigRequest,
  ConvertMnemonicToSeedRequest,
  CreateExtkeyFromSeedRequest,
  GetPubkeyFromExtkeyRequest,
  GetPrivkeyFromExtkeyRequest,
  AddMultisigSignTxInRequest,
  CreateRawTransactionRequest,
  CreateSignatureHashRequest,
  CalculateEcSignatureRequest,
  VerifySignatureRequest,
  MultisigSignData,
  AddMultisigSignRequest,
} from '../types/cfdJsTypes'
import { Messages, CreateCetAdaptorSignaturesRequest } from '../types/cfdDlcJsTypes'
import Amount from '../../../packages/bitcoin-dlc-provider/lib/models/Amount';
import InputDetails from '../../../packages/bitcoin-dlc-provider/lib/models/InputDetails';
import PayoutDetails from '../../../packages/bitcoin-dlc-provider/lib/models/PayoutDetails';
import OracleInfo from '../../../packages/bitcoin-dlc-provider/lib/models/OracleInfo';
import Input from '../../../packages/bitcoin-dlc-provider/lib/models/Input';
import Oracle from '../models/Oracle'
import { math } from 'bip-schnorr';

import * as base2Output from '../outputs/base2.json'

const MNEMONIC_1 = 'image tornado nice envelope race unaware globe valley advice learn stadium stand labor broccoli ridge vapor run search gadget industry holiday never tuna squeeze';
const MNEMONIC_2 = 'absorb tornado nice envelope race unaware globe valley advice learn stadium stand labor broccoli ridge vapor run search gadget industry holiday never tuna squeeze';

const CONSTANTS = {
  BITCOIN_FEE_PER_BYTE: 3,
  BITCOIN_ADDRESS_DEFAULT_BALANCE: 50 * 1e8
}

const chain = chains.bitcoinWithJs
const alice = chain.client
const network = chain.network

const bob = chains.bitcoinWithJs2.client

describe('dlc provider', () => {
  describe('initializeContractAndOffer', () => {
    it('test', async () => {
      const cetAdaptorSignRequest: CreateCetAdaptorSignaturesRequest = {
        messagesList: [{ messages: ['2012241bd361f299bb727af5f402c41af84d01268e571d45753bb14fd61391f3']}],
        cetsHex: [
          '02000000011082b061b5332b59e0e13146f22f871b231b83b17741dc2292be4adaa021a9c00000000000ffffffff0200e1f50500000000160014d346e68d8ee4d25a51779202a69c34ea8dc3e453e803000000000000160014d346e68d8ee4d25a51779202a69c34ea8dc3e45300000000'
        ],
        privkey: '18221500a08e0f6db234e497b2c3ce37dffa22d6bce64fb395908f40faf6f6fd',
        fundTxId: '0200000002542543432371232a9c9cdbd362eabc616916f19c4ae1ebe9c870bd315b46e7850100000000ffffffff9fd2609f9fdb35460d8679d39ff88a0573afbfcd951fea5f0fbef661b21b2ac90100000000ffffffff038cebf50500000000220020b223fda83d7d7a72619b143b3b9bbbc10578f8c3c676d4cf25f853f787cd7057c208102401000000160014e9f0a3911a7ff253689f4e41c57dd23b80509efcdae5052a01000000160014e9f0a3911a7ff253689f4e41c57dd23b80509efc00000000',
        localFundPubkey: '023592bd470ef06ae29a4982491e9e96265fc76912242a444b055a790403c0f5e7',
        remoteFundPubkey: '023592bd470ef06ae29a4982491e9e96265fc76912242a444b055a790403c0f5e7',
        fundInputAmount: 100002700,
        oraclePubkey: 'c6c519b017280b6be4f0fc3c2bbb705bc86de2449259bb6570696fb866a5cccb',
        oracleRValues: ['9679923cae79c21e29e4b90621ee8b9f9c4ffc740e992886c3bb343eb56fb258']
      }

      const test = await alice.finance.dlc.CreateCetAdaptorSignatures(cetAdaptorSignRequest)
      console.log('test', test)
    })

    it.only('should', async () => {
      const localCollateral = Amount.FromSatoshis(100000000)
      const remoteCollateral = Amount.FromSatoshis(1000)
      const feeRate = 10
      const refundLockTime = 1622175850

      const inputDetails: InputDetails = {
        localCollateral,
        remoteCollateral,
        feeRate,
        refundLockTime
      }

      const base = 1

      const oracle = new Oracle('olivia', 1)
      const oracleInfo = oracle.GetOracleInfo()

      const { rValues } = oracleInfo

      const rValuesMessagesList: Messages[] = []
      rValues.forEach(r => {
        const messages = []
        for (let i = 0; i < base; i++) {
          const m = math.taggedHash('DLC/oracle/attestation/v0', i.toString()).toString('hex')
          messages.push(m)
        }
        rValuesMessagesList.push({ messages })
      })

      const startingIndex = 0

      const aliceInput = await getInput(alice)
      const bobInput = await getInput(bob)

      const payouts: PayoutDetails[] = [{
        localAmount: Amount.FromSatoshis(100000000),
        remoteAmount: Amount.FromSatoshis(1000)
      }]

      const messagesList: Messages[] = rValuesMessagesList

      const offerMessage = await alice.finance.dlc.initializeContractAndOffer(inputDetails, payouts, oracleInfo, messagesList, startingIndex, [aliceInput])
      console.log('offerMessage', offerMessage)

      console.time("accept message");
      const acceptMessage = await bob.finance.dlc.confirmContractOffer(offerMessage, startingIndex, [bobInput])
      console.timeEnd("accept message");

      console.time("sign message");
      const signMessage = await alice.finance.dlc.signContract(acceptMessage)
      console.timeEnd("sign message");

      // const txid = await bob.finance.dlc.finalizeContract(signMessage)
      // console.log('txid', txid)
    })

    it('should create proper offer message', async () => {
      const localCollateral = Amount.FromSatoshis(100000000)
      const remoteCollateral = Amount.FromSatoshis(1000)
      const feeRate = 10
      const refundLockTime = 1622175850
      
      const inputDetails: InputDetails = {
        localCollateral,
        remoteCollateral,
        feeRate,
        refundLockTime
      }

      // there needs to be a function that takes output

      console.log('base2Output', base2Output)

      console.log('base2Output info', base2Output[0].groups)

      const significantDigits = base2Output.default.map((output: Output) => output.groups.map((a: number[]) => a.length).reduce((a: number, b: number) => Math.max(a, b))).reduce((a: number, b: number) => Math.max(a, b))
      console.log('significantDigits', significantDigits)

      const base = 2

      const oracle = new Oracle('olivia', significantDigits)
      const oracleInfo = oracle.GetOracleInfo()
      console.log('oracleInfo', oracleInfo)

      const { rValues } = oracleInfo

      const rValuesMessagesList: Messages[] = []
      rValues.forEach(r => {
        const messages = []
        for (let i = 0; i < base; i++) {
          const m = math.taggedHash('DLC/oracle/attestation/v0', i.toString()).toString('hex')
          messages.push(m)
        }
        rValuesMessagesList.push({ messages })
      })

      const startingIndex = 0

      const aliceInput = await getInput(alice)
      const bobInput = await getInput(bob)

      console.time("answer time");
      const { payouts, messagesList } = alice.finance.dlc.outputsToPayouts(base2Output.default, rValuesMessagesList, localCollateral, remoteCollateral, true)
      console.timeEnd("answer time");

      // console.log('messagesList', messagesList)

      const offerMessage = await alice.finance.dlc.initializeContractAndOffer(inputDetails, payouts, oracleInfo, messagesList, startingIndex, [aliceInput])
      console.log('offerMessage', offerMessage)

      console.time("accept message");
      const acceptMessage = await bob.finance.dlc.confirmContractOffer(offerMessage, startingIndex, [bobInput])
      console.timeEnd("accept message");
      // console.log('acceptMessage', acceptMessage)

      console.time("sign message");
      const signMessage = await alice.finance.dlc.signContract(acceptMessage)
      console.timeEnd("sign message");

      const txid = await bob.finance.dlc.finalizeContract(signMessage)
      console.log('txid', txid)
    })
  })
  // describe('multisig', () => {
  //   it('can multisig', async () => {
  //     console.log('test')

  //     console.log('chains', chains)

  //     const test = await chains.bitcoinWithJs.client.getMethod('getAddresses')()
  //     console.log('test', test)

  //     const test2 = await chains.bitcoinWithJs.client.finance.cfd.GetPrivkeyFromWif({ wif: 'cPAnYAaZbganHH3fw45Sw313UauQHwj6H5pko5DZfx4JjG8tmcBm' })
  //     console.log('test2', test2)

  //     console.log('foo', foo.default)

  //     // const MNEMONIC = 'image tornado nice envelope race unaware globe valley advice learn stadium stand labor broccoli ridge vapor run search gadget industry holiday never tuna squeeze';

  //     const pubkey1 = await getPubkeyFromMnemonic(MNEMONIC_1)
  //     console.log('pubkey1', pubkey1)

  //     const privkey1 = await getPrivkeyFromMnemonic(MNEMONIC_1)
  //     console.log('privkey1', privkey1)

  //     const pubkey2 = await getPubkeyFromMnemonic(MNEMONIC_2)
  //     console.log('pubkey2', pubkey2)

  //     const privkey2 = await getPrivkeyFromMnemonic(MNEMONIC_2)
  //     console.log('privkey2', privkey2)

  //     const createMultisigRequest: CreateMultisigRequest = {
  //       nrequired: 2,
  //       keys: [pubkey1, pubkey2],
  //       network: 'regtest',
  //       hashType: 'p2wsh'
  //     }

  //     const multisig = await chains.bitcoinWithJs.client.finance.cfd.CreateMultisig(createMultisigRequest)
  //     console.log('multisig', multisig)

  //     const txRaw = await chains.bitcoinWithNode.client.chain.sendTransaction(multisig.address, CONSTANTS.BITCOIN_ADDRESS_DEFAULT_BALANCE)
  //     // console.log('tx', tx)

  //     // console.log('tx._raw.vout', tx._raw.vout)

  //     const tx = await decodeRawTransaction(txRaw._raw.hex, chains.bitcoinWithJs.network)
  //     console.log('tx', tx)

  //     console.log('tx.vout[0].scriptPubKey.addresses', tx.vout[0].scriptPubKey.addresses)
  //     console.log('tx.vout[1].scriptPubKey.addresses', tx.vout[1].scriptPubKey.addresses)

  //     const multisigVout = tx.vout.find((vout: any) => vout.scriptPubKey.addresses[0] === multisig.address)
  //     console.log('multisigVout', multisigVout)

  //     const newAddress = (await chains.bitcoinWithJs.client.wallet.getAddresses(0, 1))[0].address
  //     console.log('newAddress', newAddress)

  //     console.log('new BN(multisigVout.value).times(1e8).minus(1000).toNumber()', new BN(multisigVout.value).times(1e8).minus(1000).toNumber())

  //     const createRawTransactionRequest: CreateRawTransactionRequest = {
  //       version: 2,
  //       locktime: 0,
  //       txins: [{
  //         txid: tx.txid,
  //         vout: multisigVout.n,
  //         sequence: 4294967295
  //       }],
  //       txouts: [{
  //         address: newAddress,
  //         amount: new BN(multisigVout.value).times(1e8).minus(1000).toNumber()
  //       }]
  //     }
  //     const rawTx = await chains.bitcoinWithJs.client.finance.cfd.CreateRawTransaction(createRawTransactionRequest)
  //     console.log('rawTx', rawTx)

  //     const createSignatureHashRequest: CreateSignatureHashRequest = {
  //       tx: rawTx.hex,
  //       txin: {
  //         txid: tx.txid,
  //         vout: multisigVout.n,
  //         keyData: {
  //           hex: multisig.witnessScript,
  //           type: 'redeem_script'
  //         },
  //         amount: new BN(multisigVout.value).times(1e8).toNumber(),
  //         hashType: 'p2wsh',
  //         sighashType: 'all',
  //         sighashAnyoneCanPay: false,
  //       }
  //     }
  //     const sighash = await chains.bitcoinWithJs.client.finance.cfd.CreateSignatureHash(createSignatureHashRequest)
  //     console.log('sighash', sighash)

  //     const calculateEcSignatureRequest1: CalculateEcSignatureRequest = {
  //       sighash: sighash.sighash,
  //       privkeyData: {
  //         privkey: privkey1,
  //         wif: true,
  //         network: 'regtest'
  //       },
  //       isGrindR: true
  //     }
  //     const signature1 = await chains.bitcoinWithJs.client.finance.cfd.CalculateEcSignature(calculateEcSignatureRequest1)
  //     console.log('signature1', signature1)

  //     const verifySignatureRequest1: VerifySignatureRequest = {
  //       tx: rawTx.hex,
  //       txin: {
  //         txid: tx.txid,
  //         vout: multisigVout.n,
  //         signature: signature1.signature,
  //         pubkey: pubkey1,
  //         redeemScript: multisig.witnessScript,
  //         hashType: 'p2wsh',
  //         sighashType: 'all',
  //         sighashAnyoneCanPay: false,
  //         amount: new BN(multisigVout.value).times(1e8).toNumber(),
  //       }
  //     }
  //     console.log('verifySignatureRequest1', verifySignatureRequest1)
  //     const verifySignature1 = await chains.bitcoinWithJs.client.finance.cfd.VerifySignature(verifySignatureRequest1)
  //     console.log('verifySignature1', verifySignature1)

  //     const calculateEcSignatureRequest2: CalculateEcSignatureRequest = {
  //       sighash: sighash.sighash,
  //       privkeyData: {
  //         privkey: privkey2,
  //         wif: true,
  //         network: 'regtest'
  //       },
  //       isGrindR: true
  //     }
  //     const signature2 = await chains.bitcoinWithJs.client.finance.cfd.CalculateEcSignature(calculateEcSignatureRequest2)
  //     console.log('signature2', signature2)

  //     const verifySignatureRequest2: VerifySignatureRequest = {
  //       tx: rawTx.hex,
  //       txin: {
  //         txid: tx.txid,
  //         vout: multisigVout.n,
  //         signature: signature2.signature,
  //         pubkey: pubkey2,
  //         redeemScript: multisig.witnessScript,
  //         hashType: 'p2wsh',
  //         sighashType: 'all',
  //         sighashAnyoneCanPay: false,
  //         amount: new BN(multisigVout.value).times(1e8).toNumber(),
  //       }
  //     }
  //     const verifySignature2 = await chains.bitcoinWithJs.client.finance.cfd.VerifySignature(verifySignatureRequest2)
  //     console.log('verifySignature2', verifySignature2)

  //     const signatureList: MultisigSignData[] = [{
  //       hex: signature1.signature,
  //       derEncode: true,
  //       sighashType: 'all',
  //       sighashAnyoneCanPay: false,
  //       relatedPubkey: pubkey1
  //     }, {
  //       hex: signature2.signature,
  //       derEncode: true,
  //       sighashType: 'all',
  //       sighashAnyoneCanPay: false,
  //       relatedPubkey: pubkey2
  //     }]

  //     const addMultisigSignRequest: AddMultisigSignRequest = {
  //       tx: rawTx.hex,
  //       txin: {
  //         txid: tx.txid,
  //         vout: multisigVout.n,
  //         signParams: signatureList,
  //         hashType: 'p2wsh',
  //         witnessScript: multisig.witnessScript
  //       }
  //     }
  //     const signedTx = await chains.bitcoinWithJs.client.finance.cfd.AddMultisigSign(addMultisigSignRequest)
  //     console.log('signedTx', signedTx)

  //     // const addMultisigSignTxInRequest: AddMultisigSignTxInRequest = {
  //     //   txid: tx.txid,
  //     //   vout: tx.vout.findIndex((vout: any) => vout.scriptPubKey.addresses[0] === multisig.address)
  //     // }

  //     // const multisig = await chains.bitcoinWithJs.client.finance.cfd.GetPrivkeyFromWif({ wif: 'cPAnYAaZbganHH3fw45Sw313UauQHwj6H5pko5DZfx4JjG8tmcBm' })
  //   })
  // })
})

async function getInput(client: Client): Promise<Input> {
  const { address: unusedAddress, derivationPath } = await client.wallet.getUnusedAddress()
  console.log('unusedAddress', unusedAddress)

  await client.getMethod('jsonrpc')('importaddress', unusedAddress, '', false)

  const txRaw = await fundAddress(unusedAddress)
  const tx = await decodeRawTransaction(txRaw._raw.hex, network)

  const vout = tx.vout.find((vout: any) => vout.scriptPubKey.addresses[0] === unusedAddress)

  const input: Input = {
    txid: tx.txid,
    vout: vout.n,
    address: unusedAddress,
    label: '',
    scriptPubKey: vout.scriptPubKey.hex,
    amount: new BN(vout.value).times(1e8).toNumber(),
    confirmations: 1,
    spendable: true,
    solvable: true,
    safe: true,
    satoshis: new BN(vout.value).times(1e8).toNumber(),
    value: new BN(vout.value).times(1e8).toNumber(),
    derivationPath
  }

  return input
}

async function getPubkeyFromMnemonic(mnemonic: string) {
  const convertMnemonicToSeedRequest: ConvertMnemonicToSeedRequest = {
    mnemonic: mnemonic.split(' '),
    passphrase: ''
  }

  const seed = await chains.bitcoinWithJs.client.finance.cfd.ConvertMnemonicToSeed(convertMnemonicToSeedRequest)

  const createExtkeyFromSeedRequest: CreateExtkeyFromSeedRequest = {
    seed: seed.seed,
    network: 'regtest',
    extkeyType: 'extPubkey'
  }

  const xpub = await chains.bitcoinWithJs.client.finance.cfd.CreateExtkeyFromSeed(createExtkeyFromSeedRequest)

  const getPubkeyFromExtkeyRequest: GetPubkeyFromExtkeyRequest = {
    extkey: xpub.extkey,
    network: 'regtest'
  }

  const pubkey = await chains.bitcoinWithJs.client.finance.cfd.GetPubkeyFromExtkey(getPubkeyFromExtkeyRequest)

  return pubkey.pubkey
}

async function getPrivkeyFromMnemonic(mnemonic: string) {
  const convertMnemonicToSeedRequest: ConvertMnemonicToSeedRequest = {
    mnemonic: mnemonic.split(' '),
    passphrase: ''
  }

  const seed = await chains.bitcoinWithJs.client.finance.cfd.ConvertMnemonicToSeed(convertMnemonicToSeedRequest)

  const createExtkeyFromSeedRequest: CreateExtkeyFromSeedRequest = {
    seed: seed.seed,
    network: 'regtest',
    extkeyType: 'extPrivkey'
  }

  const xpub = await chains.bitcoinWithJs.client.finance.cfd.CreateExtkeyFromSeed(createExtkeyFromSeedRequest)
  console.log('xpub', xpub)
  console.log('xpub.extkey', xpub.extkey)

  const getPrivkeyFromExtkeyRequest: GetPrivkeyFromExtkeyRequest = {
    extkey: xpub.extkey,
    network: 'regtest',
    wif: true
  }

  const privkey = await chains.bitcoinWithJs.client.finance.cfd.GetPrivkeyFromExtkey(getPrivkeyFromExtkeyRequest)

  return privkey.privkey
}

interface Output {
  payout: number,
  groups: number[][]
}

// extkey: string;
//   network: string;
//   wif: boolean;
//   isCompressed?: boolean;



// async function fundAddress (chain, address) {
//   console.log('fundAddress')
//   if (chain.name === 'bitcoin') {
//     await chains.bitcoinWithNode.client.chain.sendTransaction(address, CONSTANTS.BITCOIN_ADDRESS_DEFAULT_BALANCE)
//   } else if (chain.name === 'liquid') {
//     console.log('chain.name', chain.name)
//     const tx = await chains.liquidWithNode.client.chain.sendTransaction(address, CONSTANTS.BITCOIN_ADDRESS_DEFAULT_BALANCE)
//     console.log('after fund address')
//     console.log('tx', tx)
//     await sleep(1000)
//   } else if (chain.name === 'ethereum') {
//     await chains.ethereumWithNode.client.chain.sendTransaction(address, CONSTANTS.ETHEREUM_ADDRESS_DEFAULT_BALANCE)
//   }
//   await mineBlock(chain)
// }



// /** */
// export interface MultisigScriptSigData {
//   hex: string;
//   type?: string;
//   derEncode?: boolean;
//   sighashType?: string;
//   sighashAnyoneCanPay?: boolean;
//   relatedPubkey?: string;
// }

// /** @property {string} redeemScript - multisig script */
// export interface CreateMultisigScriptSigRequest {
//   signParams?: MultisigScriptSigData[];
//   redeemScript: string;
// }

// /** */
// export interface CreateMultisigScriptSigResponse {
//   hex: string;
// }


// /** */
// export interface CreateMultisigRequest {
//   nrequired: number;
//   keys: string[];
//   isElements?: boolean;
//   network: string;
//   hashType: string;
// }

// /**
// * @property {string} redeemScript? - (required for P2SH or P2SH-P2WSH) redeem script for unlocking script
// * @property {string} witnessScript? - (required for P2WSH or P2SH-P2WSH) witness script for witness stack
// */
// export interface CreateMultisigResponse {
//   address: string;
//   redeemScript?: string;
//   witnessScript?: string;
// }



