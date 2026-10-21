import { getEcc } from '@atomicfinance/utils';
import {
  DlcSign,
  DlcTransactions,
  FundingSignatures,
} from '@node-dlc/messaging';
import { payments, script, Transaction } from 'bitcoinjs-lib';
import assert from 'node:assert/strict';

import { ddkEngine } from '../../../tests/integration/utils/ddk';
import BitcoinDdkProvider, {
  BitcoinDdkProviderOptions,
} from '../lib/BitcoinDdkProvider';
import { computeContractId } from '../lib/utils/Utils';
import {
  acceptFundPrivKey,
  messages,
  offerFundPrivKey,
  provider,
} from './contract';

const ENABLE_LOCKTIME_SEQUENCE = 0xfffffffe;
const FINAL_SEQUENCE = 0xffffffff;

function fundTx(dlcTransactions: DlcTransactions): Transaction {
  return Transaction.fromBuffer(
    Buffer.from(dlcTransactions.fundTx.serialize()),
  );
}

async function contract(spliced: boolean, options?: BitcoinDdkProviderOptions) {
  const { offer, accept } = messages(spliced, 10_000n);
  const { dlcTransactions } = await provider(ddkEngine(), options).createDlcTxs(
    offer,
    accept,
  );
  const sign = new DlcSign();
  sign.contractId = computeContractId(
    dlcTransactions.fundTx.txId.serialize(),
    dlcTransactions.fundTxVout,
    offer.temporaryContractId,
  );
  return { offer, accept, sign, dlcTransactions };
}

/** A provider whose wallet holds one party's funding key. */
function walletProvider(privKey: Buffer): BitcoinDdkProvider {
  const wallet = provider(ddkEngine(), { splicedFundLockTime: 'cetLocktime' });
  Object.assign(wallet, {
    fundingInputToInput: async (input) => ({
      txid: input.prevTx.txId.toString(),
      vout: input.prevTxVout,
    }),
    GetPrivKeysForInputs: async (inputs) =>
      inputs.map(() => privKey.toString('hex')),
    findDlcFundingPrivateKey: async () => privKey.toString('hex'),
  });
  return wallet;
}

describe('spliced funding locktime', () => {
  it('builds a spliced contract with funding locktime 0 by default', async () => {
    const tx = fundTx((await contract(true)).dlcTransactions);
    assert.equal(tx.locktime, 0);
    assert.equal(tx.ins[0].sequence, FINAL_SEQUENCE);
  });

  it('sets a spliced contract funding locktime to the CET locktime', async () => {
    const { offer, dlcTransactions } = await contract(true, {
      splicedFundLockTime: 'cetLocktime',
    });
    const tx = fundTx(dlcTransactions);
    assert.equal(tx.locktime, offer.cetLocktime);
    assert.equal(tx.ins[0].sequence, ENABLE_LOCKTIME_SEQUENCE);
    for (const cet of dlcTransactions.cets) {
      assert.equal(Number(cet.locktime.value), offer.cetLocktime);
    }
  });

  it('keeps a regular contract funding locktime at 0', async () => {
    const tx = fundTx(
      (await contract(false, { splicedFundLockTime: 'cetLocktime' }))
        .dlcTransactions,
    );
    assert.equal(tx.locktime, 0);
  });

  for (const [built, rebuiltWith] of [
    ['zero', 'cetLocktime'],
    ['cetLocktime', 'zero'],
  ] as const) {
    it(`rebuilds a spliced contract built with ${built} under ${rebuiltWith}`, async () => {
      const { offer, accept, sign, dlcTransactions } = await contract(true, {
        splicedFundLockTime: built,
      });
      const rebuilder = provider(ddkEngine(), {
        splicedFundLockTime: rebuiltWith,
      });
      const rebuilt = await rebuilder.createDlcTxs(offer, accept, sign);
      assert.deepEqual(
        rebuilt.dlcTransactions.fundTx.serialize(),
        dlcTransactions.fundTx.serialize(),
      );
      assert.deepEqual(
        rebuilt.dlcTransactions.refundTx.serialize(),
        dlcTransactions.refundTx.serialize(),
      );

      sign.contractId[0] ^= 1;
      await assert.rejects(
        rebuilder.createDlcTxs(offer, accept, sign),
        /The spliced contract matches neither funding locktime\. Funding locktime \d+: The contract matches neither fee rule\..* Funding locktime \d+: The contract matches neither fee rule\./,
      );
    });
  }

  it('signs and verifies a spliced funding transaction with a nonzero locktime', async () => {
    const { offer, accept, dlcTransactions } = await contract(true, {
      splicedFundLockTime: 'cetLocktime',
    });
    const offerer = walletProvider(offerFundPrivKey);
    const fundingSignatures: FundingSignatures = await offerer[
      'CreateFundingSigs'
    ](offer, accept, dlcTransactions, true);

    const [[signatureWitness, pubkeyWitness]] =
      fundingSignatures.witnessElements;
    const { signature, hashType } = script.signature.decode(
      signatureWitness.witness,
    );
    assert.equal(hashType, Transaction.SIGHASH_ALL);

    const witnessScript = payments.p2ms({
      m: 2,
      pubkeys: [offer.fundingPubkey, accept.fundingPubkey].sort(Buffer.compare),
    }).output;
    const value = Number(offer.fundingInputs[0].prevTx.outputs[0].value.sats);
    const tx = fundTx(dlcTransactions);
    const sighash = (locktime: number) => {
      tx.locktime = locktime;
      return tx.hashForWitnessV0(
        0,
        witnessScript,
        value,
        Transaction.SIGHASH_ALL,
      );
    };
    assert.ok(
      getEcc().verify(
        sighash(offer.cetLocktime),
        pubkeyWitness.witness,
        signature,
      ),
    );
    assert.ok(!getEcc().verify(sighash(0), pubkeyWitness.witness, signature));

    const acceptor = walletProvider(acceptFundPrivKey);
    const sign = new DlcSign();
    sign.fundingSignatures = fundingSignatures;
    await acceptor['VerifyFundingSigs'](
      offer,
      accept,
      sign,
      dlcTransactions,
      false,
    );

    const noAcceptorSignatures = new FundingSignatures();
    noAcceptorSignatures.witnessElements = [];
    const signedTx = await acceptor['CreateFundingTx'](
      offer,
      accept,
      sign,
      dlcTransactions,
      noAcceptorSignatures,
    );
    assert.equal(Number(signedTx.locktime.value), offer.cetLocktime);
    assert.equal(
      signedTx.txId.toString(),
      dlcTransactions.fundTx.txId.toString(),
    );
  });
});
