import 'mocha';

import { LinearPayout } from '@node-dlc/core';
import {
  DlcAccept,
  DlcAcceptV0,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  OracleAttestationV0,
} from '@node-dlc/messaging';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import {
  AcceptDlcOfferResponse,
  SignDlcAcceptResponse,
} from '../../../packages/bitcoin-dlc-provider';
import { chains, getInput } from '../common';
import Oracle from '../models/Oracle';
import {
  generateContractInfoCustomStrategyOracle,
  generateOracleAttestation,
} from '../utils/contract';

chai.use(chaiAsPromised);
const expect = chai.expect;

const chain = chains.bitcoinWithJs;
const alice = chain.client;

const bob = chains.bitcoinWithJs2.client;

describe('Custom Strategy Oracle POC numdigits=18', () => {
  const numDigits = 18;
  const oracleBase = 2;
  const { payoutFunction } = LinearPayout.buildPayoutFunction(
    80000000n,
    120000000n,
    80000n,
    120000n,
    oracleBase,
    numDigits,
  );
  const intervals = [{ beginInterval: 0n, roundingMod: 25000n }];
  const totalCollateralIn = 120000000n;
  const unit = 'Bits';
  const eventId = 'strategyOutcome';

  const outcome = 10500;

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

  it.only('should complete entire flow', async () => {
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const {
      contractInfo,
      totalCollateral,
    } = generateContractInfoCustomStrategyOracle(
      oracle,
      numDigits,
      oracleBase,
      payoutFunction,
      intervals,
      totalCollateralIn,
      unit,
    );

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;
    const premium = BigInt(5);

    console.time('total');
    console.time('offer');

    dlcOffer = await alice.dlc.createDlcOffer(
      contractInfo,
      totalCollateral - premium,
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.log(dlcOffer.serialize().toString('hex'));
    const dlcDeserialized = DlcOffer.deserialize(dlcOffer.serialize());
    console.timeEnd('offer');

    console.time('accept');

    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      '# CETs',
      (acceptDlcOfferResponse.dlcAccept as DlcAcceptV0).cetSignatures.sigs
        .length,
    );

    console.timeEnd('accept');

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    console.time('sign');

    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    console.timeEnd('sign');

    dlcSign = signDlcAcceptResponse.dlcSign;

    console.time('finalize');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );

    console.timeEnd('finalize');

    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );

    console.time('attestation');
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
      eventId,
    );
    console.timeEnd('attestation');

    console.time('execute');

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );

    console.timeEnd('execute');
    console.timeEnd('total');

    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });
});

describe('Custom Strategy Oracle POC numdigits=21', () => {
  const numDigits = 21;
  const oracleBase = 2;
  const { payoutFunction } = LinearPayout.buildPayoutFunction(
    80000000n,
    104000000n,
    800000n,
    1040000n,
    oracleBase,
    numDigits,
  );
  const intervals = [{ beginInterval: 0n, roundingMod: 25000n }];
  const totalCollateralIn = 104000000n;
  const unit = 'Bits * 10^-1';
  const eventId = 'strategyOutcome';

  const outcome = 1020000;

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

  it('should complete entire flow', async () => {
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const {
      contractInfo,
      totalCollateral,
    } = generateContractInfoCustomStrategyOracle(
      oracle,
      numDigits,
      oracleBase,
      payoutFunction,
      intervals,
      totalCollateralIn,
      unit,
    );

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;
    const premium = BigInt(5);

    console.time('total');
    console.time('offer');

    dlcOffer = await alice.dlc.createDlcOffer(
      contractInfo,
      totalCollateral - premium,
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.timeEnd('offer');

    console.time('accept');

    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      '# CETs',
      (acceptDlcOfferResponse.dlcAccept as DlcAcceptV0).cetSignatures.sigs
        .length,
    );

    console.timeEnd('accept');

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    console.time('sign');

    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    console.timeEnd('sign');

    dlcSign = signDlcAcceptResponse.dlcSign;

    console.time('finalize');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );

    console.timeEnd('finalize');

    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );

    console.time('attestation');
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
      eventId,
    );
    console.timeEnd('attestation');

    console.time('execute');

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );

    console.timeEnd('execute');
    console.timeEnd('total');

    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });
});

describe('Custom Strategy Oracle POC numdigits=27', () => {
  const numDigits = 27;
  const oracleBase = 2;
  const { payoutFunction } = LinearPayout.buildPayoutFunction(
    80000000n,
    120000000n,
    80000000n,
    120000000n,
    oracleBase,
    numDigits,
  );
  const intervals = [{ beginInterval: 0n, roundingMod: 25000n }];
  const totalCollateralIn = 120000000n;
  const unit = 'sats';
  const eventId = 'strategyOutcome';

  const outcome = 105000000;

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

  it('should complete entire flow', async () => {
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    oracle = new Oracle('olivia', numDigits);

    const {
      contractInfo,
      totalCollateral,
    } = generateContractInfoCustomStrategyOracle(
      oracle,
      numDigits,
      oracleBase,
      payoutFunction,
      intervals,
      totalCollateralIn,
      unit,
    );

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;
    const premium = BigInt(50000);

    console.time('total');
    console.time('offer');

    dlcOffer = await alice.dlc.createDlcOffer(
      contractInfo,
      totalCollateral - premium,
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.timeEnd('offer');

    console.time('accept');

    const acceptDlcOfferResponse: AcceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    dlcAccept = acceptDlcOfferResponse.dlcAccept;
    dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    console.log(
      '# CETs',
      (acceptDlcOfferResponse.dlcAccept as DlcAcceptV0).cetSignatures.sigs
        .length,
    );

    console.timeEnd('accept');

    const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
      dlcOffer,
      dlcAccept,
    );

    console.time('sign');

    const signDlcAcceptResponse: SignDlcAcceptResponse = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    console.timeEnd('sign');

    dlcSign = signDlcAcceptResponse.dlcSign;

    console.time('finalize');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );

    console.timeEnd('finalize');

    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );

    console.time('attestation');
    oracleAttestation = generateOracleAttestation(
      outcome,
      oracle,
      oracleBase,
      numDigits,
      eventId,
    );
    console.timeEnd('attestation');

    console.time('execute');

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );

    console.timeEnd('execute');
    console.timeEnd('total');

    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });
});
