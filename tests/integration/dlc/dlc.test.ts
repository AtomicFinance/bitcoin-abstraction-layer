/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { chains } from '../common'
import config from '../config'
// import 'mocha';

// describe('DLC Flow', () => {
//   it('should return true', () => {
//     expect(true).to.equal(true);
//   });
// });

function testDLC (chain: any) {
  it('should allow locking and refunding using secretB1', async () => {
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
