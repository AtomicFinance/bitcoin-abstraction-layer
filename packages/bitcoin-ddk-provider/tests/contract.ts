import { getECPair } from '@atomicfinance/utils';
import { Sequence, Tx } from '@node-dlc/bitcoin';
import { StreamReader } from '@node-dlc/bufio';
import {
  DlcAccept,
  DlcInput,
  DlcOffer,
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

import { DdkInterface } from '../../types/lib/ddk';
import BitcoinDdkProvider, {
  BitcoinDdkProviderOptions,
} from '../lib/BitcoinDdkProvider';
import { ddkPartyFees } from '../lib/utils/DdkFees';

export const offerFundPrivKey = Buffer.alloc(32, 1);
export const acceptFundPrivKey = Buffer.alloc(32, 2);

/**
 * A two-outcome contract the offerer funds alone from one input. A spliced
 * contract's input is the 2-of-2 funding output of an earlier contract
 * between the same funding keys.
 */
export function messages(spliced: boolean, spareValue: bigint) {
  const offer = new DlcOffer();
  const accept = new DlcAccept();
  offer.fundingPubkey = getECPair().fromPrivateKey(offerFundPrivKey).publicKey;
  accept.fundingPubkey =
    getECPair().fromPrivateKey(acceptFundPrivKey).publicKey;
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

export function provider(
  engine: DdkInterface,
  options?: BitcoinDdkProviderOptions,
) {
  return new BitcoinDdkProvider(
    BitcoinNetworks.bitcoin_regtest,
    engine,
    options,
  );
}
