import 'mocha';

import {
  buildCoveredCallOrderOffer,
  buildLongCallOrderOffer,
  buildLongPutOrderOffer,
  CoveredCall,
  DlcTxBuilder,
  groupByIgnoringDigits,
  HyperbolaPayoutCurve,
  LongCall,
  LongPut,
} from '@node-dlc/core';
import {
  ContractDescriptorV1,
  ContractInfoV0,
  ContractInfoV1,
  DigitDecompositionEventDescriptorV0,
  DlcAccept,
  DlcAcceptV0,
  DlcClose,
  DlcCloseMetadata,
  DlcCloseV0,
  DlcOffer,
  DlcOfferV0,
  DlcSign,
  DlcSignV0,
  DlcTransactions,
  DlcTransactionsV0,
  OracleAnnouncementV0,
  OracleAttestationV0,
  OracleEventV0,
  OracleInfoV0,
  RoundingIntervalsV0,
} from '@node-dlc/messaging';
import { xor } from '@node-lightning/crypto';
import BN, { BigNumber } from 'bignumber.js';
import { BitcoinNetworks, chainHashFromNetwork } from 'bitcoin-networks';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import {
  AcceptDlcOfferResponse,
  SignDlcAcceptResponse,
} from '../../../packages/bitcoin-dlc-provider';
import { Input } from '../../../packages/types';
import { chains, getInput } from '../common';
import f from '../fixtures/blockchain.json';
import Oracle from '../models/Oracle';
import {
  generateContractInfo,
  generateContractInfoFromPayoutFunction,
  generateOracleAnnouncement,
  generateOracleAttestation,
} from '../utils/contract';

chai.use(chaiAsPromised);
const expect = chai.expect;

const chain = chains.bitcoinWithJs;
const alice = chain.client;

const bob = chains.bitcoinWithJs2.client;
const carol = chains.bitcoinWithJs3.client;
const mm = chains.bitcoinWithJs4.client;

function toBigInt(num: BigNumber): bigint {
  return BigInt(num.integerValue().toString());
}

describe.only('finance', () => {
  const numDigits = 18;
  const oracleBase = 2;
  let dlcOffer: DlcOffer;
  let dlcAccept: DlcAccept;
  let dlcSign: DlcSign;
  let dlcTransactions: DlcTransactions;
  let oracleAttestation: OracleAttestationV0;
  let aliceAddresses: string[] = [];
  let oracle: Oracle;

  before(async () => {
    const aliceNonChangeAddresses: string[] = (
      await alice.wallet.getAddresses(0, 15, false)
    ).map((address) => address.address);
    const aliceChangeAddresses: string[] = (
      await alice.wallet.getAddresses(0, 15, true)
    ).map((address) => address.address);

    aliceAddresses = [...aliceNonChangeAddresses, ...aliceChangeAddresses];

    for (let i = 0; i < aliceAddresses.length; i++) {
      await alice.getMethod('jsonrpc')(
        'importaddress',
        aliceAddresses[i],
        '',
        false,
      );
    }
  });

  it('should long call using orderoffer OTM', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 5000;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    const longCallOrderOffer = buildLongCallOrderOffer(
      announcement,
      Number(contractSize),
      Number(strikePrice),
      Number(maxGain),
      Number(premium),
      Number(feeRatePerVb),
      rounding,
      network,
    );

    dlcOffer = await alice.dlc.createDlcOffer(
      longCallOrderOffer.contractInfo,
      longCallOrderOffer.offerCollateralSatoshis,
      longCallOrderOffer.feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      'cets length',
      (dlcAccept as DlcAcceptV0).cetSignatures.sigs.length,
    );

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    console.log(
      'dlcOffer',
      dlcOffer.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    console.log(
      'dlcAccept',
      dlcAccept.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 29000;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  it('should long call using orderoffer ATM', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 25000;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    const longCallOrderOffer = buildLongCallOrderOffer(
      announcement,
      Number(contractSize),
      Number(strikePrice),
      Number(maxGain),
      Number(premium),
      Number(feeRatePerVb),
      rounding,
      network,
    );

    dlcOffer = await alice.dlc.createDlcOffer(
      longCallOrderOffer.contractInfo,
      longCallOrderOffer.offerCollateralSatoshis,
      longCallOrderOffer.feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    console.log(
      'dlcOffer',
      dlcOffer.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    console.log(
      'dlcAccept',
      dlcAccept.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 30000;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    console.log('cetTxId', cetTxId);
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  it('should long call using orderoffer ITM', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 5000;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    const longCallOrderOffer = buildLongCallOrderOffer(
      announcement,
      Number(contractSize),
      Number(strikePrice),
      Number(maxGain),
      Number(premium),
      Number(feeRatePerVb),
      rounding,
      network,
    );

    dlcOffer = await alice.dlc.createDlcOffer(
      longCallOrderOffer.contractInfo,
      longCallOrderOffer.offerCollateralSatoshis,
      longCallOrderOffer.feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      'dlcOffer',
      dlcOffer.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    console.log(
      'dlcAccept',
      dlcAccept.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 30500;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    console.log('cetTxId', cetTxId);
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  it('should long call using orderoffer ITM significantly', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 25000;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    const longCallOrderOffer = buildLongCallOrderOffer(
      announcement,
      Number(contractSize),
      Number(strikePrice),
      Number(maxGain),
      Number(premium),
      Number(feeRatePerVb),
      rounding,
      network,
    );

    dlcOffer = await alice.dlc.createDlcOffer(
      longCallOrderOffer.contractInfo,
      longCallOrderOffer.offerCollateralSatoshis,
      longCallOrderOffer.feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      'dlcOffer',
      dlcOffer.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    console.log(
      'dlcAccept',
      dlcAccept.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 60000;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    console.log('cetTxId', cetTxId);
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  it('should long call using payout function ITM slightly', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 25000;

    const { payoutFunction } = LongCall.buildPayoutFunction(
      strikePrice,
      contractSize,
      maxGain,
      oracleBase,
      numDigits,
    );

    const contractInfo = generateContractInfoFromPayoutFunction(
      numDigits,
      payoutFunction,
      maxGain,
      oracleInfo,
    );

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    console.log('test1');

    dlcOffer = await alice.dlc.createDlcOffer(
      contractInfo,
      premium,
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log(
      'dlcOffer',
      dlcOffer.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      'dlcAccept',
      dlcAccept.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 30500;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    console.log('cetTxId', cetTxId);
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  // ================================================================================

  // ================================================================================

  // ================================================================================

  it('should long put using orderoffer OTM', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 25000;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    const longPutOrderOffer = buildLongPutOrderOffer(
      announcement,
      Number(contractSize),
      Number(strikePrice),
      Number(maxGain),
      Number(premium),
      Number(feeRatePerVb),
      rounding,
      network,
    );

    dlcOffer = await alice.dlc.createDlcOffer(
      longPutOrderOffer.contractInfo,
      longPutOrderOffer.offerCollateralSatoshis,
      longPutOrderOffer.feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      'dlcOffer',
      dlcOffer.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    console.log(
      'dlcAccept',
      dlcAccept.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 31000;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  it('should long put using orderoffer ATM', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 25000;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    const longPutOrderOffer = buildLongPutOrderOffer(
      announcement,
      Number(contractSize),
      Number(strikePrice),
      Number(maxGain),
      Number(premium),
      Number(feeRatePerVb),
      rounding,
      network,
    );

    dlcOffer = await alice.dlc.createDlcOffer(
      longPutOrderOffer.contractInfo,
      longPutOrderOffer.offerCollateralSatoshis,
      longPutOrderOffer.feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      'cets length',
      (dlcAccept as DlcAcceptV0).cetSignatures.sigs.length,
    );

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 30000;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    console.log('cetTxId', cetTxId);
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  it('should long put using orderoffer ITM', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 25000;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    const longPutOrderOffer = buildLongPutOrderOffer(
      announcement,
      Number(contractSize),
      Number(strikePrice),
      Number(maxGain),
      Number(premium),
      Number(feeRatePerVb),
      rounding,
      network,
    );

    dlcOffer = await alice.dlc.createDlcOffer(
      longPutOrderOffer.contractInfo,
      longPutOrderOffer.offerCollateralSatoshis,
      longPutOrderOffer.feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 29500;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    console.log('cetTxId', cetTxId);
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  it('should long put using orderoffer ITM significantly', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 25000;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    const longPutOrderOffer = buildLongPutOrderOffer(
      announcement,
      Number(contractSize),
      Number(strikePrice),
      Number(maxGain),
      Number(premium),
      Number(feeRatePerVb),
      rounding,
      network,
    );

    dlcOffer = await alice.dlc.createDlcOffer(
      longPutOrderOffer.contractInfo,
      longPutOrderOffer.offerCollateralSatoshis,
      longPutOrderOffer.feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      'dlcOffer',
      dlcOffer.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    console.log(
      'dlcAccept',
      dlcAccept.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 15000;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    console.log('cetTxId', cetTxId);
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  it('should long put using payout function ITM slightly', async () => {
    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const announcement = generateOracleAnnouncement(
      oracle,
      numDigits,
      oracleBase,
    );

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const strikePrice = 30000n;
    const contractSize = 100000000n; // 1 BTC contract size
    const premium = 1000000n; // 0.01 BTC premium
    const maxGain = premium * 3n; // 0.03 BTC max gain
    const rounding = 25000;

    const { payoutFunction } = LongPut.buildPayoutFunction(
      strikePrice,
      contractSize,
      maxGain,
      oracleBase,
      numDigits,
    );

    const contractInfo = generateContractInfoFromPayoutFunction(
      numDigits,
      payoutFunction,
      maxGain,
      oracleInfo,
    );

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const network = BitcoinNetworks.bitcoin_regtest.name;

    console.log('test1');

    dlcOffer = await alice.dlc.createDlcOffer(
      contractInfo,
      premium,
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log('test2');

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    console.log('test3');
    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.log('test4');
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      'dlcOffer',
      dlcOffer.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    console.log(
      'dlcAccept',
      dlcAccept.getAddresses(BitcoinNetworks.bitcoin_regtest),
    );

    console.log(
      'cets length',
      (dlcAccept as DlcAcceptV0).cetSignatures.sigs.length,
    );

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    expect(
      (dlcTransactions as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).fundTx.serialize().toString('hex'),
    );
    expect(
      (dlcTransactions as DlcTransactionsV0).cets[5]
        .serialize()
        .toString('hex'),
    ).to.equal(
      (dlcTxsFromMsgs as DlcTransactionsV0).cets[5].serialize().toString('hex'),
    );

    console.timeEnd('accept-time');

    console.time('sign-time');
    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    dlcSign = signDlcAcceptResponse.dlcSign;
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    const outcome = 29500;
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    console.log('cetTxId', cetTxId);
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });
});
