import { Sequence, Tx } from '@node-dlc/bitcoin';
import { StreamReader } from '@node-dlc/bufio';
import {
  DlcAccept,
  DlcInput,
  DlcOffer,
  DlcSign,
  EnumeratedDescriptor,
  EnumEventDescriptor,
  FundingInput,
  OracleAnnouncement,
  OracleEvent,
  SingleContractInfo,
  SingleOracleInfo,
} from '@node-dlc/messaging';
import { BitcoinNetworks } from 'bitcoin-network';
import { payments, Transaction } from 'bitcoinjs-lib';
import assert from 'node:assert/strict';

import { ddkEngine } from '../../../tests/integration/utils/ddk';
import { DdkInterface } from '../../types/lib/ddk';
import BitcoinDdkProvider from '../lib/BitcoinDdkProvider';
import { ddkPartyFees } from '../lib/utils/DdkFees';
import { computeContractId } from '../lib/utils/Utils';

function messages(spliced: boolean, spareValue: bigint) {
  const offer = new DlcOffer();
  const accept = new DlcAccept();
  offer.fundingPubkey = Buffer.from(
    '02505f234a81fe3af88625ebda259dbaec44c72b181e2f64735f8b8ec8d7cf7377',
    'hex',
  );
  accept.fundingPubkey = Buffer.from(
    '03187db77a59f1c5f3cfd2296f87ebd7e829226b0f628d9efe4b9f221414e3b967',
    'hex',
  );
  offer.payoutSpk = offer.changeSpk = Buffer.from(
    '0014' + '11'.repeat(20),
    'hex',
  );
  accept.payoutSpk = accept.changeSpk = Buffer.from(
    '0014' + '22'.repeat(20),
    'hex',
  );
  offer.payoutSerialId = 1n;
  accept.payoutSerialId = 2n;
  offer.changeSerialId = 3n;
  accept.changeSerialId = 4n;
  offer.fundOutputSerialId = 5n;
  offer.offerCollateral = 100_000n;
  accept.acceptCollateral = 0n;
  offer.feeRatePerVb = 2n;
  offer.cetLocktime = 750;
  offer.refundLocktime = 1000;
  offer.contractFlags = Buffer.from([0]);
  offer.temporaryContractId = Buffer.alloc(32, 7);
  accept.temporaryContractId = offer.temporaryContractId;
  const descriptor = new EnumeratedDescriptor();
  descriptor.outcomes = [
    { outcome: 'up', localPayout: 100_000n },
    { outcome: 'down', localPayout: 0n },
  ];
  const info = new SingleContractInfo();
  info.totalCollateral = 100_000n;
  info.contractDescriptor = descriptor;
  const eventDescriptor = new EnumEventDescriptor();
  eventDescriptor.outcomes = ['up', 'down'];
  const event = new OracleEvent();
  event.eventDescriptor = eventDescriptor;
  const announcement = new OracleAnnouncement();
  announcement.oracleEvent = event;
  const oracle = new SingleOracleInfo();
  oracle.announcement = announcement;
  info.oracleInfo = oracle;
  offer.contractInfo = info;

  const input = new FundingInput();
  input.inputSerialId = 10n;
  input.prevTxVout = 0;
  input.sequence = Sequence.default();
  input.maxWitnessLen = spliced ? 220 : 108;
  input.redeemScript = Buffer.alloc(0);
  if (spliced) {
    input.dlcInput = new DlcInput();
    input.dlcInput.localFundPubkey = offer.fundingPubkey;
    input.dlcInput.remoteFundPubkey = accept.fundingPubkey;
    input.dlcInput.contractId = Buffer.alloc(32, 8);
  }
  const fees = ddkPartyFees({
    fundingInputs: [input],
    payoutSpkLength: 22,
    changeSpkLength: 22,
    feeRatePerVb: 2n,
    fundsWholeContract: true,
    counterpartyPayoutSpkLength: 0,
  });
  const previous = new Transaction();
  previous.addInput(Buffer.alloc(32, 9), 0);
  const previousScript = spliced
    ? payments.p2wsh({
        redeem: payments.p2ms({
          m: 2,
          pubkeys: [offer.fundingPubkey, accept.fundingPubkey].sort(
            Buffer.compare,
          ),
        }),
      }).output
    : offer.payoutSpk;
  previous.addOutput(
    previousScript,
    Number(100_000n + fees.fundFee + fees.cetFee + spareValue),
  );
  input.prevTx = Tx.decode(StreamReader.fromBuffer(previous.toBuffer()));
  offer.fundingInputs = [input];
  accept.fundingInputs = [];
  return { offer, accept };
}

function provider(engine: DdkInterface) {
  return new BitcoinDdkProvider(BitcoinNetworks.bitcoin_regtest, engine);
}

async function legacyContract(spliced: boolean, spareValue: bigint) {
  const engine = ddkEngine();
  const { offer, accept } = messages(spliced, spareValue);
  const legacyEngine: DdkInterface = {
    ...engine,
    createDlcTransactions: (...args) =>
      engine.createDlcTransactionsWithFeeRule(
        ...args,
        engine.FeeRule.OwnPayoutOnly,
      ),
    createSplicedDlcTransactions: (...args) =>
      engine.createSplicedDlcTransactionsWithFeeRule(
        ...args,
        engine.FeeRule.OwnPayoutOnly,
      ),
  };
  const { dlcTransactions } = await provider(legacyEngine).createDlcTxs(
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

describe('legacy fee reconstruction with the ddk engine', () => {
  before(() => {
    const engine = ddkEngine();
    assert.ok(
      engine.FeeRule &&
        engine.createDlcTransactionsWithFeeRule &&
        engine.createSplicedDlcTransactionsWithFeeRule,
      'This suite needs the fee-rule bindings. Set DDK_ENGINE_MODULE to the built @bennyblader/ddk entry file URL.',
    );
  });

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
          /under either fee rule/,
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

  for (const spliced of [false, true]) {
    it(`reports missing engine support for ${spliced ? 'spliced' : 'regular'} contracts`, async () => {
      const { offer, accept, sign } = await legacyContract(spliced, 0n);
      await assert.rejects(
        provider({ ...ddkEngine(), FeeRule: undefined }).createDlcTxs(
          offer,
          accept,
          sign,
        ),
        /no FeeRule/,
      );
      const method = spliced
        ? 'createSplicedDlcTransactionsWithFeeRule'
        : 'createDlcTransactionsWithFeeRule';
      await assert.rejects(
        provider({ ...ddkEngine(), [method]: undefined }).createDlcTxs(
          offer,
          accept,
          sign,
        ),
        new RegExp(`no ${method}`),
      );
    });
  }
});
