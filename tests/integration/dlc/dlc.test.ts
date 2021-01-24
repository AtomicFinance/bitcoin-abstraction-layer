import BN from 'bignumber.js'
import chai from 'chai'
import { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import _ from 'lodash'
import * as crypto from '@liquality/crypto'
import * as BitcoinUtils from '@liquality/bitcoin-utils'
import { decodeRawTransaction } from '@liquality/bitcoin-utils';
import { chains } from '../common'
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
  AddMultisigSignRequest
} from '../types/cfdJsTypes'

const MNEMONIC_1 = 'image tornado nice envelope race unaware globe valley advice learn stadium stand labor broccoli ridge vapor run search gadget industry holiday never tuna squeeze';
const MNEMONIC_2 = 'absorb tornado nice envelope race unaware globe valley advice learn stadium stand labor broccoli ridge vapor run search gadget industry holiday never tuna squeeze';

const CONSTANTS = {
  BITCOIN_FEE_PER_BYTE: 3,
  BITCOIN_ADDRESS_DEFAULT_BALANCE: 50 * 1e8
}

describe('test', function() {
  it('should be great', async () => {
    console.log('test')

    console.log('chains', chains)

    const test = await chains.bitcoinWithJs.client.getMethod('getAddresses')()
    console.log('test', test)

    const test2 = await chains.bitcoinWithJs.client.finance.cfd.GetPrivkeyFromWif({ wif: 'cPAnYAaZbganHH3fw45Sw313UauQHwj6H5pko5DZfx4JjG8tmcBm' })
    console.log('test2', test2)

    console.log('foo', foo.default)

    // const MNEMONIC = 'image tornado nice envelope race unaware globe valley advice learn stadium stand labor broccoli ridge vapor run search gadget industry holiday never tuna squeeze';

    const pubkey1 = await getPubkeyFromMnemonic(MNEMONIC_1)
    console.log('pubkey1', pubkey1)

    const privkey1 = await getPrivkeyFromMnemonic(MNEMONIC_1)
    console.log('privkey1', privkey1)

    const pubkey2 = await getPubkeyFromMnemonic(MNEMONIC_2)
    console.log('pubkey2', pubkey2)

    const privkey2 = await getPrivkeyFromMnemonic(MNEMONIC_2)
    console.log('privkey2', privkey2)

    const createMultisigRequest: CreateMultisigRequest = {
      nrequired: 2,
      keys: [pubkey1, pubkey2],
      network: 'regtest',
      hashType: 'p2wsh'
    }

    const multisig = await chains.bitcoinWithJs.client.finance.cfd.CreateMultisig(createMultisigRequest)
    console.log('multisig', multisig)

    const txRaw = await chains.bitcoinWithNode.client.chain.sendTransaction(multisig.address, CONSTANTS.BITCOIN_ADDRESS_DEFAULT_BALANCE)
    // console.log('tx', tx)

    // console.log('tx._raw.vout', tx._raw.vout)

    const tx = await decodeRawTransaction(txRaw._raw.hex, chains.bitcoinWithJs.network)
    console.log('tx', tx)

    console.log('tx.vout[0].scriptPubKey.addresses', tx.vout[0].scriptPubKey.addresses)
    console.log('tx.vout[1].scriptPubKey.addresses', tx.vout[1].scriptPubKey.addresses)

    const multisigVout = tx.vout.find((vout: any) => vout.scriptPubKey.addresses[0] === multisig.address)
    console.log('multisigVout', multisigVout)

    const newAddress = (await chains.bitcoinWithJs.client.wallet.getAddresses(0, 1))[0].address
    console.log('newAddress', newAddress)

    console.log('new BN(multisigVout.value).times(1e8).minus(1000).toNumber()', new BN(multisigVout.value).times(1e8).minus(1000).toNumber())

    const createRawTransactionRequest: CreateRawTransactionRequest = {
      version: 2,
      locktime: 0,
      txins: [{
        txid: tx.txid,
        vout: multisigVout.n,
        sequence: 4294967295
      }],
      txouts: [{
        address: newAddress,
        amount: new BN(multisigVout.value).times(1e8).minus(1000).toNumber()
      }]
    }
    const rawTx = await chains.bitcoinWithJs.client.finance.cfd.CreateRawTransaction(createRawTransactionRequest)
    console.log('rawTx', rawTx)

    const createSignatureHashRequest: CreateSignatureHashRequest = {
      tx: rawTx.hex,
      txin: {
        txid: tx.txid,
        vout: multisigVout.n,
        keyData: {
          hex: multisig.witnessScript,
          type: 'redeem_script'
        },
        amount: new BN(multisigVout.value).times(1e8).toNumber(),
        hashType: 'p2wsh',
        sighashType: 'all',
        sighashAnyoneCanPay: false,
      }
    }
    const sighash = await chains.bitcoinWithJs.client.finance.cfd.CreateSignatureHash(createSignatureHashRequest)
    console.log('sighash', sighash)

    const calculateEcSignatureRequest1: CalculateEcSignatureRequest = {
      sighash: sighash.sighash,
      privkeyData: {
        privkey: privkey1,
        wif: true,
        network: 'regtest'
      },
      isGrindR: true
    }
    const signature1 = await chains.bitcoinWithJs.client.finance.cfd.CalculateEcSignature(calculateEcSignatureRequest1)
    console.log('signature1', signature1)

    const verifySignatureRequest1: VerifySignatureRequest = {
      tx: rawTx.hex,
      txin: {
        txid: tx.txid,
        vout: multisigVout.n,
        signature: signature1.signature,
        pubkey: pubkey1,
        redeemScript: multisig.witnessScript,
        hashType: 'p2wsh',
        sighashType: 'all',
        sighashAnyoneCanPay: false,
        amount: new BN(multisigVout.value).times(1e8).toNumber(),
      }
    }
    console.log('verifySignatureRequest1', verifySignatureRequest1)
    const verifySignature1 = await chains.bitcoinWithJs.client.finance.cfd.VerifySignature(verifySignatureRequest1)
    console.log('verifySignature1', verifySignature1)

    const calculateEcSignatureRequest2: CalculateEcSignatureRequest = {
      sighash: sighash.sighash,
      privkeyData: {
        privkey: privkey2,
        wif: true,
        network: 'regtest'
      },
      isGrindR: true
    }
    const signature2 = await chains.bitcoinWithJs.client.finance.cfd.CalculateEcSignature(calculateEcSignatureRequest2)
    console.log('signature2', signature2)

    const verifySignatureRequest2: VerifySignatureRequest = {
      tx: rawTx.hex,
      txin: {
        txid: tx.txid,
        vout: multisigVout.n,
        signature: signature2.signature,
        pubkey: pubkey2,
        redeemScript: multisig.witnessScript,
        hashType: 'p2wsh',
        sighashType: 'all',
        sighashAnyoneCanPay: false,
        amount: new BN(multisigVout.value).times(1e8).toNumber(),
      }
    }
    const verifySignature2 = await chains.bitcoinWithJs.client.finance.cfd.VerifySignature(verifySignatureRequest2)
    console.log('verifySignature2', verifySignature2)

    const signatureList: MultisigSignData[] = [{
      hex: signature1.signature,
      derEncode: true,
      sighashType: 'all',
      sighashAnyoneCanPay: false,
      relatedPubkey: pubkey1
    }, {
      hex: signature2.signature,
      derEncode: true,
      sighashType: 'all',
      sighashAnyoneCanPay: false,
      relatedPubkey: pubkey2
    }]

    const addMultisigSignRequest: AddMultisigSignRequest = {
      tx: rawTx.hex,
      txin: {
        txid: tx.txid,
        vout: multisigVout.n,
        signParams: signatureList,
        hashType: 'p2wsh',
        witnessScript: multisig.witnessScript
      }
    }
    const signedTx = await chains.bitcoinWithJs.client.finance.cfd.AddMultisigSign(addMultisigSignRequest)
    console.log('signedTx', signedTx)

    // const addMultisigSignTxInRequest: AddMultisigSignTxInRequest = {
    //   txid: tx.txid,
    //   vout: tx.vout.findIndex((vout: any) => vout.scriptPubKey.addresses[0] === multisig.address)
    // }

    // const multisig = await chains.bitcoinWithJs.client.finance.cfd.GetPrivkeyFromWif({ wif: 'cPAnYAaZbganHH3fw45Sw313UauQHwj6H5pko5DZfx4JjG8tmcBm' })
  })

  it('should do be great', async () => {
    console.log('test')

    // console.log('chains', chains)

    const test = await chains.bitcoinWithJs.client.getMethod('getAddresses')()
    // console.log('test', test)
  })
})


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



