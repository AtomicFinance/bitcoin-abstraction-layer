import 'mocha'
import chai from 'chai'
import { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import BN from 'bignumber.js'
import _ from 'lodash'
import { decodeRawTransaction } from '@liquality/bitcoin-utils';
import Client from '@liquality/client'
import { chains, fundAddress, mineBlock } from '../common'
import { Messages } from '../@types/cfd-dlc-js'
import Amount from '../../../packages/bitcoin-dlc-provider/lib/models/Amount';
import InputDetails from '../../../packages/bitcoin-dlc-provider/lib/models/InputDetails';
import PayoutDetails from '../../../packages/bitcoin-dlc-provider/lib/models/PayoutDetails';
import Input from '../../../packages/bitcoin-dlc-provider/lib/models/Input';
import Oracle from '../models/Oracle'
import { math } from 'bip-schnorr';
import { sleep } from '@liquality/utils'

import * as base2Output from '../outputs/base2.json'

const chain = chains.bitcoinWithJs
const alice = chain.client
const network = chain.network

const bob = chains.bitcoinWithJs2.client

describe('dlc provider', () => {
  it('unilateralClose', async () => {
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

    const oracle = new Oracle('olivia', 1)
    const oracleInfo = oracle.GetOracleInfo()

    const { rValues } = oracleInfo

    const rValuesMessagesList: Messages[] = []
    rValues.forEach(r => {
      const messages = []
      for (let i = 0; i < 1; i++) {
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
    const acceptMessage = await bob.finance.dlc.confirmContractOffer(offerMessage, startingIndex, [bobInput])
    const signMessage = await alice.finance.dlc.signContract(acceptMessage)
    const txid = await bob.finance.dlc.finalizeContract(signMessage)
    const tx = await alice.getMethod('getTransactionByHash')(txid)

    const { contractId } = offerMessage
    const outcomeIndex = 0
    const signature = oracle.GetSignature(messagesList[0].messages[0])

    const closeTxid = await alice.finance.dlc.unilateralClose(outcomeIndex, [signature], contractId)
    const closeTx = await alice.getMethod('getTransactionByHash')(closeTxid)

    expect(tx._raw.vout.length).to.equal(3)
    expect(closeTx._raw.vout.length).to.equal(2)
  })

  it('refund', async () => {
    const localCollateral = Amount.FromSatoshis(100000000)
    const remoteCollateral = Amount.FromSatoshis(1000)
    const feeRate = 10
    const refundLockTime = 1612975534

    const inputDetails: InputDetails = {
      localCollateral,
      remoteCollateral,
      feeRate,
      refundLockTime
    }

    const oracle = new Oracle('olivia', 1)
    const oracleInfo = oracle.GetOracleInfo()

    const { rValues } = oracleInfo

    const rValuesMessagesList: Messages[] = []
    rValues.forEach(r => {
      const messages = []
      for (let i = 0; i < 1; i++) {
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
    const acceptMessage = await bob.finance.dlc.confirmContractOffer(offerMessage, startingIndex, [bobInput])
    const signMessage = await alice.finance.dlc.signContract(acceptMessage)
    const txid = await bob.finance.dlc.finalizeContract(signMessage)
    const tx = await alice.getMethod('getTransactionByHash')(txid)

    await mineBlock()

    const { contractId } = offerMessage
    const refundTxid = await alice.finance.dlc.refund(contractId)
    const refundTx = await alice.getMethod('getTransactionByHash')(refundTxid)

    expect(tx._raw.vout.length).to.equal(3)
    expect(refundTx._raw.vout.length).to.equal(2)
  })

  it('from outcomes with multiple r values', async () => {
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

    const significantDigits = base2Output.default.map((output: Output) => output.groups.map((a: number[]) => a.length).reduce((a: number, b: number) => Math.max(a, b))).reduce((a: number, b: number) => Math.max(a, b))

    const base = 2

    const oracle = new Oracle('olivia', significantDigits)
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

    const { payouts, messagesList } = alice.finance.dlc.outputsToPayouts(base2Output.default, rValuesMessagesList, localCollateral, remoteCollateral, true)

    const offerMessage = await alice.finance.dlc.initializeContractAndOffer(inputDetails, payouts, oracleInfo, messagesList, startingIndex, [aliceInput])
    const acceptMessage = await bob.finance.dlc.confirmContractOffer(offerMessage, startingIndex, [bobInput])
    const signMessage = await alice.finance.dlc.signContract(acceptMessage)
    const txid = await bob.finance.dlc.finalizeContract(signMessage)
    const tx = await alice.getMethod('getTransactionByHash')(txid)

    const { contractId } = offerMessage
    const outcomeIndex = 0

    const signatures: string[] = []
    for (let i = 1; i <= messagesList[outcomeIndex].messages.length; i++) {
      const signature = oracle.GetSignature(messagesList[outcomeIndex].messages[i - 1], i)
      signatures.push(signature)
    }

    await sleep(1000)

    const closeTxid = await alice.finance.dlc.unilateralClose(outcomeIndex, signatures, contractId)
    const closeTx = await alice.getMethod('getTransactionByHash')(closeTxid)

    expect(tx._raw.vout.length).to.equal(3)
    expect(closeTx._raw.vout.length).to.equal(1)
  })
})

async function getInput(client: Client): Promise<Input> {
  const { address: unusedAddress, derivationPath } = await client.wallet.getUnusedAddress()

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

interface Output {
  payout: number,
  groups: number[][]
}
