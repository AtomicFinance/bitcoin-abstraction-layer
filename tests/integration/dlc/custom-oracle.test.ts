import 'mocha';

import { LinearPayout } from '@node-dlc/core';
import {
  ContractDescriptorV0,
  ContractDescriptorV1,
  ContractInfoV0,
  DlcAccept,
  DlcAcceptV0,
  DlcOffer,
  DlcOfferV0,
  DlcSign,
  DlcTransactions,
  OracleAttestationV0,
  PayoutFunctionV0,
  RoundingIntervalsV0,
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

describe.skip('Custom Strategy Oracle POC numdigits=18', () => {
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
  const unit = 'Bits * 10^-1';
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
  const unit = 'bits';
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

  it('should succeed in finding outcome index from PolynomialPayoutCurvePiece Payout Group', async () => {
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    const outcome = 101000;

    // This DlcOffer previously gave the following error
    // Error: Failed to Find OutcomeIndex From PolynomialPayoutCurvePiece. Payout Group found but incorrect group index
    const rawDlcOffer = DlcOfferV0.deserialize(
      Buffer.from(
        'a71a0006226e46111a0b59caaf126043eb5bbf28c34f3a5e332a1fc7b2b73cf188910ffdd82efd03ef00000000004c353ffda720940015fda72684000300fe004c0e3b0000fda72816000200fe004c0e3b0000fe000f3e58fe004c0e3b0000fe000f3e58fe004c0e3b0000fda7281a0002fe000f3e58fe004c0e3b0000fe000f4628fe004c353f0000fe000f4628fe004c353f0000fda7281a0002fe000f4628fe004c353f0000fe001ffffffe004c353f0000fe001ffffffe004c353f0000fda72406000100fd1382fda712fd0349fdd824fd0343b01da6c607a04c05e82cda516f4c9b117ed8daefc474c9aa6d2772fb87c9eeb562c2965f37519037832b0b3e3d729f7059ba7b437d5bf5d94e627c0915a37fba49ff245fb9d1c810aeac553f1b407aeef24e9a1c4bd1e6bf32cbc32c29db68a0fdd822fd02dd001501b98d1a21300514631cc8c8b64a36e170d0d0581ad66958c27969400d521a35d0074e60674edaba1e582acb1f512518abe4dd296bea7af8a891104801937681f4868be306ccb49ca555462227aef5829888b1c52de1b9bf3305dcd6e1a46fc82479c540c1577d7dcc40c4d6d9f14bddc5de6407a75148aeae8d997141bb899801bbba2dfee5ffa2a8faa77b523272e75a7dda58389045f3663099e937defbd836e5e49e5949335d5f07f3f86ec64f90f43c90cbebb18f5644aad9852b0226133ceed7d09e250a99d4eec58ff56ab824d34472d362a09fdded088a18af0c9fa90e31aa95173054d18c15091ece970607944682e4d9ebc62545078398fd11c45886eb7e332bc97e7fbbf250c854a5220964d2c081e129bf6ab92e68b9af7d3f2e6df7eb466099994ee127f9a8c5542a97128405078e38ac121f62cd809638efc8bd8b8b48fcb0095aab94f6654f8f6d890c0cc4f16639633c486019383ade18ef3921452f2f131fe98ff8fb11cc44274e4b8bb76dd06fd1095e0d892b0a21f451e921660dc20bc2125eea20e4702d2761453078473934dbb263832d087b6bd4ca267f51b412cbf48aee8549011fbe991c0e8049f6b894acb560c63939a7e47ba7df3262d1ab636f78b53d97fa4b7dcdb78ef4ec2ac619d2d82040fdcc4a6fd171ecfbd2233f075c8cdea26cded3eb18e5c2fe1f1b28af3085e403bb77cd2b1212ebdacb76d8ec2efca61b35d5402bad3d624b9b5b3194cd7532138e6e8af35e69f4842580d4dd6da74142cca00a39155a8f4876cf1c53ed6125d122a15f7a56b761a820c8ac01a228797766621ae0d5921c07469b0bb4c19162a7a2de2df3c8acc4f695acd5c5934a7b4a20018b9e379a6551bd27a3dc32234521d1da2e4d0c78c49f836aa6346c01c2ea747545af23003d72a7b6df88de94c6d968e2c7f88aca63087d80fdd80a0e00020004626974730000000000152461746f6d69632d726962626f6e2d6d6f6e74686c792d3141554732322d323641554732320308a44427ede78398b297d26a32f57b7dcf27ea6b03adc875466b76b5d99b1f8a001600147063f51d6bce720033e5af7e05702647f5cf6e15000000000003507f00000000004c21bd0001fda714fd01b300000000000004ab019d020000000001024bad437975eba6cc800147fdb06d166a86915d7ea4685b32940c39404de4b1840200000000ffffffff4bad437975eba6cc800147fdb06d166a86915d7ea4685b32940c39404de4b1840000000000ffffffff039e6c5d050000000016001459e3d81579b0f927ba38233fa25344eeabd40a4c7042f4050000000016001439f01d158a428eeac995e90c24bd176a4e66d5163e4d4c0000000000220020890c14cc9c7f327fe20c1ccf20cdcd41e97202e5d6effd33f72dc7f13e80e82502473044022016043e0bc83cbbfbb73ffd262580a1d4f64fee918d1c5622cc013e6bdd4ab74e022056ac2412994ddf709f6b2215a5dee4a6cfe82fc8fbb26f37eac3cafb24068f0f0121028cccd5333b56cbe8abf3a3fac14df397bdf4680dc05b98207df26858b3167ebb024730440220078d5d6cdb356aa06435f2b71343989365a1d9121ceb28b431302c0f622e9b2602204fd4a8321daedbd241af67bc7d861b501ef40c651f0fc7197c3077f1e07ae09301210314598bf18ae3be9fcac0c0dd734a8aff6be41726a98ea7cdae2b112e9be795400000000000000000ffffffff006c0000001600146405bcd0fd50594cce4864bf3a05bad9082206910000000000f1c88b000000000024dd9a000000000000000362e40deb632dfe0b',
        'hex',
      ),
    );

    oracle = new Oracle('olivia', numDigits);

    const { contractInfo } = generateContractInfoCustomStrategyOracle(
      oracle,
      numDigits,
      oracleBase,
      ((rawDlcOffer.contractInfo as ContractInfoV0)
        .contractDescriptor as ContractDescriptorV1)
        .payoutFunction as PayoutFunctionV0,
      (((rawDlcOffer.contractInfo as ContractInfoV0)
        .contractDescriptor as ContractDescriptorV1)
        .roundingIntervals as RoundingIntervalsV0).intervals,
      rawDlcOffer.contractInfo.totalCollateral,
      unit,
    );

    const feeRatePerVb = BigInt(2);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    console.time('total');
    console.time('offer');

    const dlcOffer = await alice.dlc.createDlcOffer(
      contractInfo,
      rawDlcOffer.offerCollateralSatoshis,
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

describe.skip('Custom Strategy Oracle POC numdigits=27', () => {
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
