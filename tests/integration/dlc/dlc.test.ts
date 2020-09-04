/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { chains } from '../common'
import config from '../config'

import { Amount, InputDetails, OutcomeDetails, OracleInfo } from '../../../packages/bitcoin-dlc-provider/lib'

import Oracle from './models/Oracle'

import { CreateKeyPairRequest, CreateKeyPairResponse } from 'cfd-js-wasm'

function testDLC (chain: any) {
  it('should', async () => {

    const localCollateral: Amount = Amount.FromSatoshis(1000000)
    const remoteCollateral: Amount = Amount.FromSatoshis(1000000)

    console.log('(new Date()).getTime()', (new Date()).getTime())

    // const keyPairRequest: CreateKeyPairRequest = { wif: false }
    // let keyPair: CreateKeyPairResponse = await chain.client.finance.cfd.CreateKeyPair(keyPairRequest);
    // console.log('keyPair', keyPair)

    // const inputDetails: InputDetails = {
    //   localCollateral,
    //   remoteCollateral,
    //   feeRate: 10,
    //   maturityTime: new Date(),
    //   refundLockTime: (new Date()).getTime(),
    //   cetCsvDelay: 0
    // };

    // const outcomeDetail: OutcomeDetails = {
    //   localAmount: Amount.FromSatoshis(1000000),
    //   remoteAmount: Amount.FromSatoshis(1000000),
    //   message: 'localwin'
    // }

    // const outcomes: Array<OutcomeDetails> = [ outcomeDetail ]

    // console.log('test1')

    // const oracle: Oracle = await Oracle.build(chain.client, "Olivia")
    // console.log('test2')
    // const oracleInfo: OracleInfo = oracle.GetOracleInfo()
    // console.log('test3')

    // const offerMessage = await chain.client.finance.dlc.initializeContractAndOffer(inputDetails, outcomes, oracleInfo)

    // console.log('offerMessage', offerMessage)

    expect(1).to.equal(1)
    // const { lockTxHash, colParams } = await lockCollateral(chain)

    // const refundParams = [lockTxHash, colParams.pubKeys, colParams.secrets.secretB1, colParams.secretHashes, colParams.expirations]
    // const refundTxHash = await chain.client.loan.collateral.refund(...refundParams)
    // await chains.bitcoinWithNode.client.chain.generateBlock(1)

    // const refundTxRaw = await chain.client.getMethod('getRawTransactionByHash')(refundTxHash)
    // const refundTx = await chain.client.getMethod('decodeRawTransaction')(refundTxRaw)

    // const refundVouts = refundTx._raw.data.vout
    // const refundVins = refundTx._raw.data.vin

    // expect(refundVins.length).to.equal(2)
    // expect(refundVouts.length).to.equal(1)

    // expect(getVinRedeemScript(refundVins[0]).includes(colParams.secrets.secretB1)).to.equal(true)
    // expect(getVinRedeemScript(refundVins[1]).includes(colParams.secrets.secretB1)).to.equal(true)
  })
}

describe('DLC Flow', function () {
  this.timeout(config.timeout)

  describe('Bitcoin - Esplora', () => {
    testDLC(chains.bitcoinWithEsplora)
  })
})
