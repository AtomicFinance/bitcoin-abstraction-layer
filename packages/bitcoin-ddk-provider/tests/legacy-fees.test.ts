import { DlcSign } from '@node-dlc/messaging';
import assert from 'node:assert/strict';

import {
  ddkEngine,
  legacyFeeRuleEngine,
} from '../../../tests/integration/utils/ddk';
import { computeContractId } from '../lib/utils/Utils';
import { messages, provider } from './contract';

async function legacyContract(spliced: boolean, spareValue: bigint) {
  const { offer, accept } = messages(spliced, spareValue);
  const { dlcTransactions } = await provider(
    legacyFeeRuleEngine(),
  ).createDlcTxs(offer, accept);
  const sign = new DlcSign();
  sign.contractId = computeContractId(
    dlcTransactions.fundTx.txId.serialize(),
    dlcTransactions.fundTxVout,
    offer.temporaryContractId,
  );
  return { offer, accept, sign, dlcTransactions };
}

describe('legacy fee reconstruction with the ddk engine', () => {
  for (const spliced of [false, true]) {
    const kind = spliced ? 'spliced' : 'regular';
    for (const spare of [0n, 10_000n]) {
      it(`rebuilds a ${kind} legacy contract with ${spare} sats spare`, async () => {
        const { offer, accept, sign, dlcTransactions } = await legacyContract(
          spliced,
          spare,
        );
        const current = provider(ddkEngine());
        if (spare === 0n) {
          await assert.rejects(
            current.createDlcTxs(offer, accept),
            /DlcError.InvalidArgument/,
          );
        } else {
          const fresh = await current.createDlcTxs(offer, accept);
          assert.notDeepEqual(
            fresh.dlcTransactions.fundTx.serialize(),
            dlcTransactions.fundTx.serialize(),
          );
        }
        const rebuilt = await current.createDlcTxs(offer, accept, sign);
        assert.deepEqual(
          rebuilt.dlcTransactions.fundTx.serialize(),
          dlcTransactions.fundTx.serialize(),
        );
        assert.deepEqual(
          rebuilt.dlcTransactions.refundTx.serialize(),
          dlcTransactions.refundTx.serialize(),
        );
        assert.deepEqual(
          rebuilt.dlcTransactions.cets.map((tx) => tx.serialize()),
          dlcTransactions.cets.map((tx) => tx.serialize()),
        );
        sign.contractId[0] ^= 1;
        await assert.rejects(
          current.createDlcTxs(offer, accept, sign),
          new RegExp(
            'The contract matches neither fee rule. Current rule: ' +
              (spare === 0n
                ? 'DlcError.InvalidArgument: .+'
                : 'Rebuilt transactions do not match contract') +
              '.*Rule before ddk-dlc 2.0.0-rc.4: Rebuilt transactions do not match contract',
          ),
        );
      });
    }
  }

  it('does not try legacy rules for a matching current contract', async () => {
    const { offer, accept } = messages(false, 10_000n);
    const current = provider(ddkEngine());
    const { dlcTransactions } = await current.createDlcTxs(offer, accept);
    const sign = new DlcSign();
    sign.contractId = computeContractId(
      dlcTransactions.fundTx.txId.serialize(),
      dlcTransactions.fundTxVout,
      offer.temporaryContractId,
    );
    const noFallback = provider({
      ...ddkEngine(),
      createDlcTransactionsWithFeeRule: () => {
        throw new Error('Unexpected fallback');
      },
    });
    const rebuilt = await noFallback.createDlcTxs(offer, accept, sign);
    assert.deepEqual(
      rebuilt.dlcTransactions.fundTx.serialize(),
      dlcTransactions.fundTx.serialize(),
    );
  });

  for (const binding of [
    'FeeRule',
    'createDlcTransactionsWithFeeRule',
    'createSplicedDlcTransactionsWithFeeRule',
  ]) {
    it(`refuses an engine without ${binding}`, () => {
      assert.throws(
        () => provider({ ...ddkEngine(), [binding]: undefined }),
        new RegExp(`The ddk engine has no ${binding}`),
      );
    });
  }
});
