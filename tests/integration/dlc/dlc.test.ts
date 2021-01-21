import BigNumber from 'bignumber.js'
import chai from 'chai'
import { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import _ from 'lodash'
import * as crypto from '@liquality/crypto'
import * as BitcoinUtils from '@liquality/bitcoin-utils'
import { chains } from '../common'
import config from '../config'
import * as foo from '../../../packages/bitcoin-cfd-provider/lib'
import {
  CreateMultisigRequest,
  ConvertMnemonicToSeedRequest,
  CreateExtkeyFromSeedRequest
} from '../types/cfdJsTypes'

describe('test', function() {
  it('should be great', async () => {
    console.log('test')

    console.log('chains', chains)

    const test = await chains.bitcoinWithJs.client.getMethod('getAddresses')()
    console.log('test', test)

    const test2 = await chains.bitcoinWithJs.client.finance.cfd.GetPrivkeyFromWif({ wif: 'cPAnYAaZbganHH3fw45Sw313UauQHwj6H5pko5DZfx4JjG8tmcBm' })
    console.log('test2', test2)

    console.log('foo', foo.default)

    const MNEMONIC = 'image tornado nice envelope race unaware globe valley advice learn stadium stand labor broccoli ridge vapor run search gadget industry holiday never tuna squeeze';

    const convertMnemonicToSeedRequest: ConvertMnemonicToSeedRequest = {
      mnemonic: MNEMONIC.split(' '),
      passphrase: ''
    }

    const seed = await chains.bitcoinWithJs.client.finance.cfd.ConvertMnemonicToSeed(convertMnemonicToSeedRequest)
    console.log('seed', seed.seed)

    const createExtkeyFromSeedRequest: CreateExtkeyFromSeedRequest = {
      seed: seed.seed,
      network: 'regtest',
      extkeyType: 'extPubkey'
    }

    const createMultisigRequest: CreateMultisigRequest = {
      nrequired: 2,
      keys: ['', ''],
      network: 'regtest',
      hashType: 'p2wsh'
    }

    // const multisig = await chains.bitcoinWithJs.client.finance.cfd.GetPrivkeyFromWif({ wif: 'cPAnYAaZbganHH3fw45Sw313UauQHwj6H5pko5DZfx4JjG8tmcBm' })
  })

  it('should do be great', async () => {
    console.log('test')

    // console.log('chains', chains)

    const test = await chains.bitcoinWithJs.client.getMethod('getAddresses')()
    // console.log('test', test)
  })
})



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



