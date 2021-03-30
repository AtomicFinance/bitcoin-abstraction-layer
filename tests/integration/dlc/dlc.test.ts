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
import Output from '../../../packages/bitcoin-dlc-provider/lib/models/Output';
import Oracle from '../models/Oracle'
import { math } from 'bip-schnorr';
import { sleep } from '@liquality/utils'
import {
  ContractInfoV0,
  ContractDescriptorV0,
  OracleInfoV0,
  OracleAnnouncementV0,
  OracleEventV0,
  OracleAttestationV0,
  EnumEventDescriptorV0
} from "@node-dlc/messaging";
import { sha256 } from '@liquality/crypto';

import * as base2Output from '../outputs/base2.json'

const chain = chains.bitcoinWithJs
const alice = chain.client
const network = chain.network

const bob = chains.bitcoinWithJs2.client

describe('tlv integration', () => {
  it.only('should', async () => {
    const aliceInput = await getInput(alice)
    const bobInput = await getInput(bob)

    const oracle = new Oracle('olivia', 1)
    const oliviaInfo = oracle.GetOracleInfo()

    const eventDescriptor = new EnumEventDescriptorV0();
    eventDescriptor.outcomes = [ 'YES', 'NO' ];

    const event = new OracleEventV0();
    event.oracleNonces = oliviaInfo.rValues.map(rValue => Buffer.from(rValue, 'hex'));
    event.eventMaturityEpoch = 1622175850
    event.eventDescriptor = eventDescriptor;
    event.eventId = 'YES-OR-NO'

    const announcement = new OracleAnnouncementV0();
    announcement.announcementSig = Buffer.from(oracle.GetSignature(sha256(event.serialize())), 'hex')
    announcement.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
    announcement.oracleEvent = event;

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const contractDescriptor = new ContractDescriptorV0();
    contractDescriptor.outcomes = [
      {
        outcome: math.taggedHash('DLC/oracle/attestation/v0', 'WIN'),
        localPayout: BigInt(100001000)
      },
      {
        outcome: math.taggedHash('DLC/oracle/attestation/v0', 'LOSE'),
        localPayout: BigInt(100001000)
      }
    ]

    const contractInfo = new ContractInfoV0();
    contractInfo.totalCollateral = BigInt(100001000);
    contractInfo.contractDescriptor = contractDescriptor;
    contractInfo.oracleInfo = oracleInfo;

    const offerCollateralSatoshis = BigInt(100000000);
    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1622175850;
    const refundLocktime = 1622175850;

    const offerMessage = await alice.finance.dlc.initializeContractAndOffer(
      contractInfo,
      offerCollateralSatoshis,
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput]
    );

    console.log('offerMessage', offerMessage)
  })
})

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

    await mineBlock()

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

  it('multisig', async () => {
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

    const outputs: Output[] = []
    outputs.push(new Output('bcrt1qxcjufgh2jarkp2qkx68azh08w9v5gah8u6es8s', Amount.FromSatoshis(100001000)))

    await mineBlock()

    const mutualClosingMessage = await bob.finance.dlc.initiateEarlyExit(contractId, outputs)
    const exitTxid = await alice.finance.dlc.finalizeEarlyExit(contractId, mutualClosingMessage)
    const exitTx = await alice.getMethod('getTransactionByHash')(exitTxid)

    expect(tx._raw.vout.length).to.equal(3)
    expect(exitTx._raw.vout.length).to.equal(1)
  })

  it.skip('from outcomes with multiple r values', async () => {
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

    const significantDigits = base2Output.default.map((output: GeneratedOutput) => output.groups.map((a: number[]) => a.length).reduce((a: number, b: number) => Math.max(a, b))).reduce((a: number, b: number) => Math.max(a, b))

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

interface GeneratedOutput {
  payout: number,
  groups: number[][]
}
