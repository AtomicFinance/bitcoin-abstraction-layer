import 'mocha';

import { Sequence, Tx, Value } from '@node-dlc/bitcoin';
import { StreamReader } from '@node-dlc/bufio';
import {
  CoveredCall,
  DlcTxBuilder,
  groupByIgnoringDigits,
  HyperbolaPayoutCurve,
} from '@node-dlc/core';
import { sha256, xor } from '@node-dlc/crypto';
import {
  DigitDecompositionEventDescriptor,
  DisjointContractInfo,
  DlcAccept,
  DlcClose,
  DlcCloseMetadata,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  EnumeratedDescriptor,
  EnumEventDescriptor,
  FundingInput,
  NumericalDescriptor,
  OracleAnnouncement,
  OracleAttestation,
  OracleEvent,
  RoundingIntervals,
  SingleContractInfo,
  SingleOracleInfo,
} from '@node-dlc/messaging';
import BN from 'bignumber.js';
import { math } from 'bip-schnorr';
import { BitcoinNetworks, chainHashFromNetwork } from 'bitcoin-networks';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as crypto from 'crypto';

import {
  AcceptDlcOfferResponse,
  SignDlcAcceptResponse,
} from '../../../packages/bitcoin-dlc-provider';
import { Input } from '../../../packages/types';
import { InputSupplementationMode } from '../../../packages/types/lib';
import { chains, getInput } from '../common';
import f from '../fixtures/blockchain.json';
import { attestation_for_payout_amount_failure as AttestationWithPayoutAmountFailure } from '../fixtures/messages.json';
import Oracle from '../models/Oracle';
import {
  calculateNetworkFees,
  generateContractInfo,
  generateDdkCompatibleEnumOracleAttestation,
  generateEnumCollateralContractInfo,
  generateEnumOracleAttestation,
  generateLongCallOffer,
  generateOracleAttestation,
} from '../utils/contract';

chai.use(chaiAsPromised);
const expect = chai.expect;

const chain = chains.bitcoinWithJs;
const alice = chain.client;

const bob = chains.bitcoinWithJs2.client;
const carol = chains.bitcoinWithJs3.client;
const ddk = chains.bitcoinWithDdk.client;
const ddk2 = chains.bitcoinWithDdk2.client;

describe('bitcoin networks', () => {
  it('have correct genesis block hashes', async () => {
    expect(
      chainHashFromNetwork(BitcoinNetworks.bitcoin).toString('hex'),
    ).to.equal(f.mainnet.chainhash);
    expect(
      chainHashFromNetwork(BitcoinNetworks.bitcoin_testnet).toString('hex'),
    ).to.equal(f.testnet.chainhash);
    expect(
      chainHashFromNetwork(BitcoinNetworks.bitcoin_regtest).toString('hex'),
    ).to.equal(f.regtest.chainhash);
  });
  it('should send to p2sh-segwit address successfully', async () => {
    await getInput(alice);
    await alice.chain.sendTransaction({
      to: '2N4QQxSdPLmFnb7RCHDF1u4tQU1s6HJHRTn',
      value: new BN(10000),
    });
  });
  it('should return correct cfd network', async () => {
    const network = await alice.getMethod('GetCfdNetwork')();
    expect(network).to.equal('regtest');
  });
});

describe('inputToFundingInput', () => {
  it('should throw Error if invalid input', async () => {
    const aliceInput = await getInput(alice);
    const invalidInput = new Input(
      '00'.repeat(32),
      aliceInput.vout,
      aliceInput.address,
      aliceInput.amount,
      aliceInput.value,
    );

    expect(
      alice.dlc.inputToFundingInput(invalidInput),
    ).to.be.eventually.rejectedWith(Error);
  });
});

describe('dlc provider', () => {
  const numDigits = 17;
  const oracleBase = 2;
  let dlcOffer: DlcOffer;
  let dlcAccept: DlcAccept;
  let dlcSign: DlcSign;
  let dlcTransactions: DlcTransactions;
  let oracleAttestation: OracleAttestation;
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

  describe('test issue', () => {
    it('should work', async () => {
      const dlcOffer = DlcOffer.deserialize(
        Buffer.from(
          'a71a000000010006226e46111a0b59caaf126043eb5bbf28c34f3a5e332a1fc7b2b73cf188910fe4cdd23c82e41af745f1c0529efc4a0c1d3aa2523ed27f5801b8fc60eb05121b0000000000000f424000040652455041494400000000000f42401d4c4951554944415445445f42595f4d415455524154494f4e5f4441544500000000000000001d4c4951554944415445445f42595f50524943455f5448524553484f4c440000000000000000084e4f545f50414944000000000000000000fdd824fd012a3da50e734d7591fcd0a13da01fd21da09147588b97e9ddb7e2a1b0a9a7e65aa6b5cd0967341261920ec9ac7b2c08e948dd27aec77ee07faaa0dcacf453cd9f9ec3d07289c2ade25405c1c421b38c9322cd73fb2c89f42ce0730a35fae1f8875dfdd822c6000135bf32e1367d557626432961a2a7846bd33e927c6c839df37d9db35c3e660ae468ae7ccbfdd8064e0004084e4f545f50414944065245504149441d4c4951554944415445445f42595f4d415455524154494f4e5f444154451d4c4951554944415445445f42595f50524943455f5448524553484f4c444d6c6f616e2d6d6174757265642d336639633637396430643830363464393762373231623263363732626162313439643433663733313463363737326535336233613930363235353038396132330366c2dc21c1edef400882ad99a988cd7201fcb5967e061aaf6dc71e308e8ca9d50016001410dc295adaf8d2a13e5352b669a52ce005bdda9f0000000000f45a7600000000000f424001000000000003c887de020000000001013de08102602c4560a446890b3ed912d1914461e2b47b449bbd64daf6d1f496b10100000000feffffff0200e1f5050000000016001445bee50b18940baf85280712092806dd4f4ab7045a5b4d6b000000001600141eb536fdc9a7c3920834d62626b65bee73f5ac5e0247304402203b2197f56251399e9f30ce685fe3c83cde2ea585d6838d1982daa55371d6aec102206ef223c12d1cad03800e1798ce26608611104fa28d7daf9b6163c9c34eea8ea4012102857de552ef5b6ade5fcbbd97651f31edd5777fa08aa7baef33ee8ea18493c64d7514000000000000ffffffff006c000000001600142eeca9b930815f17cf1cbe86d200c8ecb426f414000000000000ac4d000000000001c5f2000000000000000a68ae449468b8d094',
          'hex',
        ),
      );
      const dlcAccept = DlcAccept.deserialize(
        Buffer.from(
          'a71c00000001e4cdd23c82e41af745f1c0529efc4a0c1d3aa2523ed27f5801b8fc60eb05121b00000000000000000295a17c503cfe880a130b5895e7cb0599a6dc25ef4880a552b76f9b67c82c7d160016001471b7485b8b79df6e02976bda30eaaf605977ab8e6e78b2ded1b65544000016001471b7485b8b79df6e02976bda30eaaf605977ab8edb3408e8ea3994e10403fc82e5f7a6ecea47e16885abcc959eed1f0709af1d9e0bf578122859b3c0f03e035437b436addb2706832914d6f8ffe86ed9adbeff129ecdda3ad8d7393a2e470a9273ee85fc6f568c97444a1947cdfea4bd92d970199270e72b168dd40de4225e4966c884dd1d81f1d0259f8a4fc0ef5bd410970884d2cbee8698a2277cc7b74d86e50ebca1af139503e5e8c9a7d73afcfe485f0a28f40f8011fc524b3cd80adf0256200aaaf4468f2df077eb484257a3b24eddd47774b170d9cfc3728069a7eb84028fca858a53979628ff5dfc5f4679372ab486da72853c2caa555990de81d960520fd9943055255daa827fa6977c9812458ebbb2329295361c57fd8ab805d7511831e40a33e7b920298e097327c87c6227acead836eb97b639991edcf5c1d696216e947c6b15c6d80d1dfae32e11f6638c7a8b2b9854d75efd5957a3355a08e73c03e47c1bf27675201dab8f3af8d7f19859c81ee065f7a1c93daf446067f2d9ec8503ffcfd98fd11b9ab672fd31a73176759a5fbd1c720ed7137d7ae638bed52679186857155d7173aa604ab78f806f7bfdd2855aa93a41dbe70c2d43f0568ddfd629f77a592ae10ad42d6941c9a75f362fea2d937f242cd4de3a46209d4c282d1d4644dfa05b92e3b4c7459e816a39eeb1dc23ff6be36c9c6e24052b913b8fa2d1cc03dcfb43bf00a5152960d6015728a067e81fbb5f773b60bd3fbaa406a8d25b47f102e100b453c23496a0f7ae39a6cad9781c43094d4b527602052b7f155e1fe0a4562ea3c5d101257af8a1bdd61975590a8467b4ea497fd45a0b7e776c79ebc92dffffecfc6447e21bf2718967707ba2c271802a2fd19250dcf5fe97f77161bba28001808390f86bfaaf343e09635a26ddc8c607718671a92a79cd260dd85af4238b791cd556cfcbfb29b0130e5ebfae595ebe971a766dcc8090b2ec9e1adaa6c29a482fcc5a215974da1cb21b4e48aa3f59c469837da41ae2e8690d218b8f369c2600',
          'hex',
        ),
      );

      console.log('dlc accept sigs', dlcAccept.cetAdaptorSignatures.sigs);

      console.log(
        'dlcAccept',
        dlcAccept.toJSON().cetAdaptorSignatures.ecdsaAdaptorSignatures,
      );

      const dlcTxs = (await ddk.getMethod('createDlcTxs')(dlcOffer, dlcAccept))
        .dlcTransactions;

      // console.log(dlcTxs);

      // const dlcTxs = DlcTransactions.deserialize(
      //   Buffer.from(
      //     'ef2e007d0200000001c50bf42fc09395787a8d456e20f18ddd53c6b0e3aa3d0e09cc67954d7192a5b40000000000ffffffff020893e605000000001600149dcf009e5fb1c1c89a70ef15b538a8e2db4cccd4fe470f000000000022002076edb6abbadb5885557f6312a110c2d8fbcb0ab3d8cd996d6c2647a6478b37f600000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000520200000001ceb2cf2bedacf1ffb8e6bf9c63997b84660b8bb87e644de6ffeee7c3ee68610c0100000000feffffff0140420f00000000001600149345d3214e5c176d93c61147ee4d828bf74597c8104db8680400520200000001ceb2cf2bedacf1ffb8e6bf9c63997b84660b8bb87e644de6ffeee7c3ee68610c0100000000feffffff0140420f00000000001600149345d3214e5c176d93c61147ee4d828bf74597c810c1ad6800520200000001ceb2cf2bedacf1ffb8e6bf9c63997b84660b8bb87e644de6ffeee7c3ee68610c0100000000feffffff0140420f000000000016001471b7485b8b79df6e02976bda30eaaf605977ab8e10c1ad6800520200000001ceb2cf2bedacf1ffb8e6bf9c63997b84660b8bb87e644de6ffeee7c3ee68610c0100000000feffffff0140420f000000000016001471b7485b8b79df6e02976bda30eaaf605977ab8e10c1ad6800520200000001ceb2cf2bedacf1ffb8e6bf9c63997b84660b8bb87e644de6ffeee7c3ee68610c0100000000feffffff0140420f000000000016001471b7485b8b79df6e02976bda30eaaf605977ab8e10c1ad6800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      //     'hex',
      //   ),
      // );

      const fundingSigs = await ddk.getMethod('CreateFundingSigsAlt')(
        dlcOffer,
        dlcAccept,
        dlcTxs,
        true,
      );
      console.log(fundingSigs);

      console.log('dlcAccept', dlcAccept.refundSignature.toString('hex'));

      const signDlcAcceptResponse: SignDlcAcceptResponse =
        await ddk.dlc.signDlcAccept(dlcOffer, dlcAccept);

      console.log(signDlcAcceptResponse);
    });
  });

  describe('funding with DDK', () => {
    it('should fund and execute enum DLC', async () => {
      const oracle = new Oracle('olivia');

      const ddkInput = await getInput(ddk);
      const ddk2Input = await getInput(ddk2);

      const eventId = 'trump-vs-kamala';

      const oliviaInfo = oracle.GetOracleInfo();

      const eventDescriptor = new EnumEventDescriptor();

      const outcomes = ['trump', 'kamala', 'neither'];

      eventDescriptor.outcomes = outcomes;

      const event = new OracleEvent();
      event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
        Buffer.from(rValue, 'hex'),
      );
      event.eventMaturityEpoch = 1617170572;
      event.eventDescriptor = eventDescriptor;
      event.eventId = eventId;

      const announcement = new OracleAnnouncement();
      announcement.announcementSig = Buffer.from(
        oracle.GetSignature(
          math
            .taggedHash('DLC/oracle/announcement/v0', event.serialize())
            .toString('hex'),
        ),
        'hex',
      );

      announcement.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
      announcement.oracleEvent = event;

      const oracleInfo = new SingleOracleInfo();
      oracleInfo.announcement = announcement;

      const contractDescriptor = new EnumeratedDescriptor();

      contractDescriptor.outcomes = [
        {
          outcome: sha256(Buffer.from('trump')).toString('hex'),
          localPayout: BigInt(1e6),
        },
        {
          outcome: sha256(Buffer.from('kamala')).toString('hex'),
          localPayout: BigInt(0),
        },
        {
          outcome: sha256(Buffer.from('neither')).toString('hex'),
          localPayout: BigInt(500000),
        },
      ];

      const totalCollateral = BigInt(1e6);

      const contractInfo = new SingleContractInfo();
      contractInfo.totalCollateral = totalCollateral;
      contractInfo.contractDescriptor = contractDescriptor;
      contractInfo.oracleInfo = oracleInfo;

      const feeRatePerVb = BigInt(10);
      const cetLocktime = 1617170572;
      const refundLocktime = 1617170573;

      dlcOffer = await ddk.dlc.createDlcOffer(
        contractInfo,
        totalCollateral - BigInt(2000),
        feeRatePerVb,
        cetLocktime,
        refundLocktime,
        [ddkInput],
      );

      const acceptDlcOfferResponse: AcceptDlcOfferResponse =
        await ddk2.dlc.acceptDlcOffer(dlcOffer, [ddk2Input]);

      dlcAccept = acceptDlcOfferResponse.dlcAccept;
      dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

      console.log('dlcAccept', dlcAccept.refundSignature.toString('hex'));

      const signDlcAcceptResponse: SignDlcAcceptResponse =
        await ddk.dlc.signDlcAccept(dlcOffer, dlcAccept);

      dlcSign = signDlcAcceptResponse.dlcSign;

      const fundTx = await ddk2.dlc.finalizeDlcSign(
        dlcOffer,
        dlcAccept,
        dlcSign,
        dlcTransactions,
      );

      const fundTxId = await ddk2.chain.sendRawTransaction(
        fundTx.serialize().toString('hex'),
      );
      expect(fundTxId).to.not.be.undefined;

      oracleAttestation = generateDdkCompatibleEnumOracleAttestation(
        'trump',
        oracle,
        announcement.getEventId(),
      );

      oracleAttestation.validate();

      const cet = await ddk2.dlc.execute(
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
      expect(cetTxId).to.not.be.undefined;
      const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
      expect(cetTx._raw.vin.length).to.equal(1);
    });
  });

  describe('enum event', () => {
    it('should fund and execute enum DLC', async () => {
      const oracle = new Oracle('olivia');

      const aliceInput = await getInput(alice);
      const bobInput = await getInput(bob);

      const eventId = 'trump-vs-kamala';

      const oliviaInfo = oracle.GetOracleInfo();

      const eventDescriptor = new EnumEventDescriptor();

      const outcomes = ['trump', 'kamala', 'neither'];

      eventDescriptor.outcomes = outcomes;

      const event = new OracleEvent();
      event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
        Buffer.from(rValue, 'hex'),
      );
      event.eventMaturityEpoch = 1617170572;
      event.eventDescriptor = eventDescriptor;
      event.eventId = eventId;

      const announcement = new OracleAnnouncement();
      announcement.announcementSig = Buffer.from(
        oracle.GetSignature(
          math
            .taggedHash('DLC/oracle/announcement/v0', event.serialize())
            .toString('hex'),
        ),
        'hex',
      );

      announcement.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
      announcement.oracleEvent = event;

      const oracleInfo = new SingleOracleInfo();
      oracleInfo.announcement = announcement;

      const contractDescriptor = new EnumeratedDescriptor();

      contractDescriptor.outcomes = [
        {
          outcome: sha256(Buffer.from('trump')).toString('hex'),
          localPayout: BigInt(1e6),
        },
        {
          outcome: sha256(Buffer.from('kamala')).toString('hex'),
          localPayout: BigInt(0),
        },
        {
          outcome: sha256(Buffer.from('neither')).toString('hex'),
          localPayout: BigInt(500000),
        },
      ];

      const totalCollateral = BigInt(1e6);

      const contractInfo = new SingleContractInfo();
      contractInfo.totalCollateral = totalCollateral;
      contractInfo.contractDescriptor = contractDescriptor;
      contractInfo.oracleInfo = oracleInfo;

      const feeRatePerVb = BigInt(10);
      const cetLocktime = 1617170572;
      const refundLocktime = 1617170573;

      dlcOffer = await alice.dlc.createDlcOffer(
        contractInfo,
        totalCollateral - BigInt(2000),
        feeRatePerVb,
        cetLocktime,
        refundLocktime,
        [aliceInput],
      );

      const dlcOfferV0 = DlcOffer.deserialize(dlcOffer.serialize());
      dlcOfferV0.validate();

      const acceptDlcOfferResponse: AcceptDlcOfferResponse =
        await bob.dlc.acceptDlcOffer(dlcOffer, [bobInput]);

      dlcAccept = acceptDlcOfferResponse.dlcAccept;
      dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

      const signDlcAcceptResponse: SignDlcAcceptResponse =
        await alice.dlc.signDlcAccept(dlcOffer, dlcAccept);

      dlcSign = signDlcAcceptResponse.dlcSign;

      const fundTx = await bob.dlc.finalizeDlcSign(
        dlcOffer,
        dlcAccept,
        dlcSign,
        dlcTransactions,
      );

      const fundTxId = await bob.chain.sendRawTransaction(
        fundTx.serialize().toString('hex'),
      );
      expect(fundTxId).to.not.be.undefined;

      oracleAttestation = generateEnumOracleAttestation('trump', oracle);

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
      expect(cetTxId).to.not.be.undefined;
      const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
      expect(cetTx._raw.vin.length).to.equal(1);
    });
  });

  describe('enum event single funded', () => {
    it('should fund and execute enum DLC', async () => {
      const oracle = new Oracle('olivia');

      const aliceInput = await getInput(alice);

      const eventId = 'trump-vs-kamala';

      const oliviaInfo = oracle.GetOracleInfo();

      const eventDescriptor = new EnumEventDescriptor();

      const outcomes = ['trump', 'kamala', 'neither'];

      eventDescriptor.outcomes = outcomes;

      const event = new OracleEvent();
      event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
        Buffer.from(rValue, 'hex'),
      );
      event.eventMaturityEpoch = 1617170572;
      event.eventDescriptor = eventDescriptor;
      event.eventId = eventId;

      const announcement = new OracleAnnouncement();
      announcement.announcementSig = Buffer.from(
        oracle.GetSignature(
          math
            .taggedHash('DLC/oracle/announcement/v0', event.serialize())
            .toString('hex'),
        ),
        'hex',
      );

      announcement.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
      announcement.oracleEvent = event;

      const oracleInfo = new SingleOracleInfo();
      oracleInfo.announcement = announcement;

      const contractDescriptor = new EnumeratedDescriptor();

      contractDescriptor.outcomes = [
        {
          outcome: sha256(Buffer.from('trump')).toString('hex'),
          localPayout: BigInt(1e6),
        },
        {
          outcome: sha256(Buffer.from('kamala')).toString('hex'),
          localPayout: BigInt(0),
        },
        {
          outcome: sha256(Buffer.from('neither')).toString('hex'),
          localPayout: BigInt(500000),
        },
      ];

      const totalCollateral = BigInt(1e6);

      const contractInfo = new SingleContractInfo();
      contractInfo.totalCollateral = totalCollateral;
      contractInfo.contractDescriptor = contractDescriptor;
      contractInfo.oracleInfo = oracleInfo;

      const feeRatePerVb = BigInt(10);
      const cetLocktime = 1617170572;
      const refundLocktime = 1617170573;

      dlcOffer = await alice.dlc.createDlcOffer(
        contractInfo,
        totalCollateral, // single funded DLC
        feeRatePerVb,
        cetLocktime,
        refundLocktime,
        [aliceInput],
      );

      const dlcOfferV0 = DlcOffer.deserialize(dlcOffer.serialize());
      dlcOfferV0.validate();

      const acceptDlcOfferResponse: AcceptDlcOfferResponse =
        await bob.dlc.acceptDlcOffer(dlcOffer);

      dlcAccept = acceptDlcOfferResponse.dlcAccept;
      dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

      const signDlcAcceptResponse: SignDlcAcceptResponse =
        await alice.dlc.signDlcAccept(dlcOffer, dlcAccept);

      dlcSign = signDlcAcceptResponse.dlcSign;

      const fundTx = await bob.dlc.finalizeDlcSign(
        dlcOffer,
        dlcAccept,
        dlcSign,
        dlcTransactions,
      );

      const fundTxId = await bob.chain.sendRawTransaction(
        fundTx.serialize().toString('hex'),
      );
      expect(fundTxId).to.not.be.undefined;

      oracleAttestation = generateEnumOracleAttestation('trump', oracle);

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
      expect(cetTxId).to.not.be.undefined;
      const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
      expect(cetTx._raw.vin.length).to.equal(1);
    });
  });

  describe('single oracle event', () => {
    beforeEach(async () => {
      console.time('offer-get-time');
      const aliceInput = await getInput(alice);
      const bobInput = await getInput(bob);

      oracle = new Oracle('olivia', numDigits);

      const { contractInfo, totalCollateral } = generateContractInfo(
        oracle,
        numDigits,
        oracleBase,
      );

      const feeRatePerVb = BigInt(10);
      const cetLocktime = 1617170572;
      const refundLocktime = 1617170573;

      dlcOffer = await alice.dlc.createDlcOffer(
        contractInfo,
        totalCollateral - BigInt(2000),
        feeRatePerVb,
        cetLocktime,
        refundLocktime,
        [aliceInput],
      );

      console.timeEnd('offer-get-time');

      console.time('accept-time');
      const acceptDlcOfferResponse: AcceptDlcOfferResponse =
        await bob.dlc.acceptDlcOffer(dlcOffer, [bobInput]);
      dlcAccept = acceptDlcOfferResponse.dlcAccept;
      dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

      const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
        dlcOffer,
        dlcAccept,
      );

      expect(dlcTransactions.fundTx.serialize().toString('hex')).to.equal(
        dlcTxsFromMsgs.fundTx.serialize().toString('hex'),
      );
      expect(dlcTransactions.cets[5].serialize().toString('hex')).to.equal(
        dlcTxsFromMsgs.cets[5].serialize().toString('hex'),
      );

      console.timeEnd('accept-time');
    });

    describe('actions', () => {
      beforeEach(async () => {
        console.time('sign-time');
        const signDlcAcceptResponse: SignDlcAcceptResponse =
          await alice.dlc.signDlcAccept(dlcOffer, dlcAccept);
        dlcSign = signDlcAcceptResponse.dlcSign;
        console.timeEnd('sign-time');

        const fundTx = await bob.dlc.finalizeDlcSign(
          dlcOffer,
          dlcAccept,
          dlcSign,
          dlcTransactions,
        );
        await bob.chain.sendRawTransaction(fundTx.serialize().toString('hex'));

        const outcome = 5000;
        oracleAttestation = generateOracleAttestation(
          outcome,
          oracle,
          oracleBase,
          numDigits,
        );
      });

      it('execute', async () => {
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

      it('should execute if offerer not provided', async () => {
        const cet = await bob.dlc.execute(
          dlcOffer,
          dlcAccept,
          dlcSign,
          dlcTransactions,
          oracleAttestation,
          undefined,
        );
        const cetTxId = await bob.chain.sendRawTransaction(
          cet.serialize().toString('hex'),
        );
        const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
        expect(cetTx._raw.vin.length).to.equal(1);
      });

      it(`should fail to execute if event id's don't match`, async () => {
        oracleAttestation.eventId = 'invalidId';

        let error = null;
        try {
          await bob.dlc.execute(
            dlcOffer,
            dlcAccept,
            dlcSign,
            dlcTransactions,
            oracleAttestation,
            false,
          );
        } catch (e) {
          error = e;
        }
        expect(error).to.be.an('Error');
      });

      it('refund', async () => {
        const refund = await bob.dlc.refund(
          dlcOffer,
          dlcAccept,
          dlcSign,
          dlcTransactions,
        );
        const refundTxId = await bob.chain.sendRawTransaction(
          refund.serialize().toString('hex'),
        );
        const refundTx = await alice.getMethod('getTransactionByHash')(
          refundTxId,
        );
        expect(refundTx._raw.vout.length).to.equal(2);
        expect(refundTx._raw.vin.length).to.equal(1);
      });

      it('batch close', async () => {
        console.time('batch-close');
        const aliceDlcCloses: DlcClose[] = await alice.dlc.createBatchDlcClose(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          [0n, ...Array.from(Array(250).keys()).map((n) => BigInt(n + 10000))],
          true,
        );
        console.timeEnd('batch-close');

        await alice.dlc.createBatchDlcClose(
          // Test creation of DlcClose with undefined offerer
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          Array.from(Array(1).keys()).map((n) => BigInt(n + 10000)),
          undefined,
        );

        console.time('batch-close-verify');
        await bob.dlc.verifyBatchDlcClose(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          aliceDlcCloses,
        );
        console.timeEnd('batch-close-verify');

        const dlcCloseMetadata = DlcCloseMetadata.fromDlcMessages(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
        );
        await bob.dlc.verifyBatchDlcCloseUsingMetadata(
          dlcCloseMetadata,
          [aliceDlcCloses[0]],
          false,
        );

        const bobDlcTx = await bob.dlc.finalizeDlcClose(
          dlcOffer,
          dlcAccept,
          aliceDlcCloses[randomIntFromInterval(0, 249)],
          dlcTransactions,
        );

        const closeTxId = await bob.chain.sendRawTransaction(bobDlcTx);
        const closeTx = await alice.getMethod('getTransactionByHash')(
          closeTxId,
        );
        expect(closeTx._raw.vin.length).to.equal(1);
      });

      it('close', async () => {
        const aliceDlcClose: DlcClose = await alice.dlc.createDlcClose(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          10000n,
          true,
        );

        const bobDlcTx: string = await bob.dlc.finalizeDlcClose(
          dlcOffer,
          dlcAccept,
          aliceDlcClose,
          dlcTransactions,
        );

        const closeTxId = await bob.chain.sendRawTransaction(bobDlcTx);
        const closeTx = await alice.getMethod('getTransactionByHash')(
          closeTxId,
        );
        const offerFirst = dlcOffer.payoutSerialId < dlcAccept.payoutSerialId;

        expect(closeTx._raw.vin.length).to.equal(2);
        expect(closeTx._raw.vout[0].scriptPubKey.hex).to.equal(
          offerFirst
            ? dlcOffer.payoutSpk.toString('hex')
            : dlcAccept.payoutSpk.toString('hex'),
        );
        expect(closeTx._raw.vout[1].scriptPubKey.hex).to.equal(
          !offerFirst
            ? dlcOffer.payoutSpk.toString('hex')
            : dlcAccept.payoutSpk.toString('hex'),
        );
      });

      it('close with fixedInputs', async () => {
        const aliceInput = await getInput(alice);

        const aliceDlcClose: DlcClose = await alice.dlc.createDlcClose(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          10000n,
          true,
          [aliceInput],
        );

        const bobDlcTx: string = await bob.dlc.finalizeDlcClose(
          dlcOffer,
          dlcAccept,
          aliceDlcClose,
          dlcTransactions,
        );

        const closeTxId = await bob.chain.sendRawTransaction(bobDlcTx);
        const closeTx = await alice.getMethod('getTransactionByHash')(
          closeTxId,
        );
        expect(closeTx._raw.vin.length).to.equal(2);
      });

      it('should fail batch close with fixedInputs', async () => {
        const wrongInput = await getInput(bob);

        expect(
          alice.dlc.createBatchDlcClose(
            dlcOffer,
            dlcAccept,
            dlcTransactions,
            [10000n],
            true,
            [wrongInput],
          ),
        ).to.be.eventually.rejectedWith(Error);
      });

      it('should fail verify batch close with fixedInputs', async () => {
        // TODO support multiple funding inputs
        const aliceInput = await getInput(alice);

        const aliceDlcClose: DlcClose = await alice.dlc.createDlcClose(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          10000n,
          true,
          [aliceInput],
        );

        const dlcCloseMetadata = DlcCloseMetadata.fromDlcMessages(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
        );

        expect(
          bob.dlc.verifyBatchDlcClose(
            dlcOffer,
            dlcAccept,
            dlcTransactions,
            [aliceDlcClose],
            false,
          ),
        ).to.be.eventually.rejectedWith(Error);

        expect(
          bob.dlc.verifyBatchDlcCloseUsingMetadata(
            dlcCloseMetadata,
            [aliceDlcClose],
            false,
          ),
        ).to.be.eventually.rejectedWith(Error);
      });

      it('should fail verify batch close with invalid close msg offer payout', async () => {
        const aliceDlcClose: DlcClose = await alice.dlc.createDlcClose(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          10000n,
          true,
          [],
        );

        const invalidDlcClose = aliceDlcClose;
        invalidDlcClose.offerPayoutSatoshis =
          invalidDlcClose.offerPayoutSatoshis + 1n;

        expect(
          bob.dlc.verifyBatchDlcClose(
            dlcOffer,
            dlcAccept,
            dlcTransactions,
            [aliceDlcClose],
            false,
          ),
        ).to.be.eventually.rejectedWith(Error);
      });

      it('should fail verify batch close with invalid close msg accept payout', async () => {
        const aliceDlcClose: DlcClose = await alice.dlc.createDlcClose(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          10000n,
        );

        const invalidDlcClose = aliceDlcClose;
        invalidDlcClose.acceptPayoutSatoshis =
          invalidDlcClose.acceptPayoutSatoshis + 1n;

        expect(
          bob.dlc.verifyBatchDlcClose(
            dlcOffer,
            dlcAccept,
            dlcTransactions,
            [aliceDlcClose],
            false,
          ),
        ).to.be.eventually.rejectedWith(Error);
      });

      it('should fail close with invalid fixedInputs', async () => {
        const wrongInput = await getInput(bob);

        expect(
          alice.dlc.createDlcClose(
            dlcOffer,
            dlcAccept,
            dlcTransactions,
            10000n,
            true,
            [wrongInput],
          ),
        ).to.be.eventually.rejectedWith(Error);
      });

      it('compute payouts', async () => {
        const numDigits = 17;
        const oracleBase = 2;

        const { payoutFunction, totalCollateral } =
          CoveredCall.buildPayoutFunction(
            4000n,
            1000000n,
            oracleBase,
            numDigits,
          );

        const intervals = [
          { beginInterval: 0n, roundingMod: 1n },
          { beginInterval: 4000n, roundingMod: 500n },
        ];
        const roundingIntervals = new RoundingIntervals();
        roundingIntervals.intervals = intervals;

        const payouts = HyperbolaPayoutCurve.computePayouts(
          payoutFunction,
          totalCollateral,
          roundingIntervals,
        );

        const groups = [];
        payouts.forEach((p) => {
          groups.push({
            payout: p.payout,
            groups: groupByIgnoringDigits(
              p.indexFrom,
              p.indexTo,
              oracleBase,
              numDigits,
            ),
          });
        });

        console.log('groups', groups);
        console.log(
          `# of CETS: ${groups.reduce(
            (acc, group) => acc + group.groups.length,
            0,
          )}`,
        );
      });

      it('serializes and deserializes all messages', async () => {
        const newDlcOffer = DlcOffer.deserialize(dlcOffer.serialize());
        const newDlcAccept = DlcAccept.deserialize(dlcAccept.serialize());
        const newDlcSign = DlcSign.deserialize(dlcSign.serialize());

        expect(newDlcOffer.chainHash).to.deep.equal(dlcOffer.chainHash);
        expect(newDlcOffer.fundingPubkey).to.deep.equal(dlcOffer.fundingPubkey);
        expect(newDlcAccept.fundingPubkey).to.deep.equal(
          dlcAccept.fundingPubkey,
        );
        expect(newDlcSign.refundSignature).to.deep.equal(
          dlcSign.refundSignature,
        );
      });
    });

    // Test to make sure payout groups find index works properly
    describe('Finding payout index works for long calls', () => {
      it('finds payout index correctly for payout that does not match rounded payout', async () => {
        console.time('offer-get-time');
        const aliceInput = await getInput(alice);
        const bobInput = await getInput(bob);

        oracle = new Oracle('olivia', 18);

        const feePerByte = 5;

        const LONG_OPTION_MAX_GAIN = Value.fromBitcoin(0.005);

        const contractPrice = 0.0108;

        const networkFees = Value.fromSats(
          calculateNetworkFees(BigInt(feePerByte)),
        );

        const contractSize = 0.1;
        const contractSizeSats = BigInt(Math.round(contractSize * 1e8));

        const maxGain = Value.fromSats(
          (LONG_OPTION_MAX_GAIN.sats * contractSizeSats) / BigInt(1e8) +
            BigInt(Math.round(contractPrice * contractSize * 1e8)) +
            networkFees.sats,
        );
        const premium = Value.fromSats(
          BigInt(Math.round(contractPrice * contractSize * 1e8)) +
            networkFees.sats,
        );

        const offer = generateLongCallOffer(
          oracle,
          18,
          2,
          'atomic-deribit-BTC-13OCT23',
          29000,
          maxGain,
          premium,
          feePerByte,
          5000,
          'bitcoin_regtest',
        );

        const cetLocktime = 1617170572;
        const refundLocktime = 1617170573;

        dlcOffer = await alice.dlc.createDlcOffer(
          offer.contractInfo,
          offer.offerCollateralSatoshis,
          offer.feeRatePerVb,
          cetLocktime,
          refundLocktime,
          [aliceInput],
        );

        console.timeEnd('offer-get-time');

        console.time('accept-time');
        const acceptDlcOfferResponse: AcceptDlcOfferResponse =
          await bob.dlc.acceptDlcOffer(dlcOffer, [bobInput]);
        dlcAccept = acceptDlcOfferResponse.dlcAccept;
        dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

        const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
          dlcOffer,
          dlcAccept,
        );

        expect(dlcTransactions.fundTx.serialize().toString('hex')).to.equal(
          dlcTxsFromMsgs.fundTx.serialize().toString('hex'),
        );
        expect(dlcTransactions.cets[5].serialize().toString('hex')).to.equal(
          dlcTxsFromMsgs.cets[5].serialize().toString('hex'),
        );

        console.timeEnd('accept-time');

        console.time('sign-time');
        const signDlcAcceptResponse: SignDlcAcceptResponse =
          await alice.dlc.signDlcAccept(dlcOffer, dlcAccept);
        dlcSign = signDlcAcceptResponse.dlcSign;
        console.timeEnd('sign-time');

        const fundTx = await bob.dlc.finalizeDlcSign(
          dlcOffer,
          dlcAccept,
          dlcSign,
          dlcTransactions,
        );
        await bob.chain.sendRawTransaction(fundTx.serialize().toString('hex'));

        const outcome = 37000;
        oracleAttestation = generateOracleAttestation(
          outcome,
          oracle,
          oracleBase,
          18,
          'atomic-deribit-BTC-13OCT23',
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

      it('finds payout index correctly for payout that does match rounded payout', async () => {
        console.time('offer-get-time');
        const aliceInput = await getInput(alice);
        const bobInput = await getInput(bob);

        oracle = new Oracle('olivia', 18);

        const feePerByte = 5;

        const LONG_OPTION_MAX_GAIN = Value.fromBitcoin(0.005);

        const contractPrice = 0.0108;

        const networkFees = Value.fromSats(
          calculateNetworkFees(BigInt(feePerByte)),
        );

        const contractSize = 0.1;
        const contractSizeSats = BigInt(Math.round(contractSize * 1e8));

        const maxGain = Value.fromSats(
          (LONG_OPTION_MAX_GAIN.sats * contractSizeSats) / BigInt(1e8) +
            BigInt(Math.round(contractPrice * contractSize * 1e8)),
        );
        const premium = Value.fromSats(
          BigInt(Math.round(contractPrice * contractSize * 1e8)) +
            networkFees.sats,
        );

        const offer = generateLongCallOffer(
          oracle,
          18,
          2,
          'atomic-deribit-BTC-13OCT23',
          29000,
          maxGain,
          premium,
          feePerByte,
          5000,
          'bitcoin_regtest',
        );

        const cetLocktime = 1617170572;
        const refundLocktime = 1617170573;

        dlcOffer = await alice.dlc.createDlcOffer(
          offer.contractInfo,
          offer.offerCollateralSatoshis,
          offer.feeRatePerVb,
          cetLocktime,
          refundLocktime,
          [aliceInput],
        );

        console.timeEnd('offer-get-time');

        console.time('accept-time');
        const acceptDlcOfferResponse: AcceptDlcOfferResponse =
          await bob.dlc.acceptDlcOffer(dlcOffer, [bobInput]);
        dlcAccept = acceptDlcOfferResponse.dlcAccept;
        dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

        const { dlcTransactions: dlcTxsFromMsgs } = await bob.dlc.createDlcTxs(
          dlcOffer,
          dlcAccept,
        );

        expect(dlcTransactions.fundTx.serialize().toString('hex')).to.equal(
          dlcTxsFromMsgs.fundTx.serialize().toString('hex'),
        );
        expect(dlcTransactions.cets[5].serialize().toString('hex')).to.equal(
          dlcTxsFromMsgs.cets[5].serialize().toString('hex'),
        );

        console.timeEnd('accept-time');

        console.time('sign-time');
        const signDlcAcceptResponse: SignDlcAcceptResponse =
          await alice.dlc.signDlcAccept(dlcOffer, dlcAccept);
        dlcSign = signDlcAcceptResponse.dlcSign;
        console.timeEnd('sign-time');

        const fundTx = await bob.dlc.finalizeDlcSign(
          dlcOffer,
          dlcAccept,
          dlcSign,
          dlcTransactions,
        );
        await bob.chain.sendRawTransaction(fundTx.serialize().toString('hex'));

        const outcome = 38000;
        oracleAttestation = generateOracleAttestation(
          outcome,
          oracle,
          oracleBase,
          18,
          'atomic-deribit-BTC-13OCT23',
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
    });

    /**
     * Currently quickFindAddress only checked the first 5000 addresses
     * This means DlcSign would fail if any addresses are > 5000
     * Relevant Issue: https://github.com/AtomicFinance/bitcoin-abstraction-layer/issues/109
     *
     * This test ensures this issue is accounted for when finalizingDlcSign
     */

    describe('validation', () => {
      it('throws if dlcoffer fundingpubkey equal to dlcaccept fundingpubkey', async () => {
        const _dlcAccept = dlcAccept;
        const _dlcOffer = dlcOffer;

        _dlcAccept.fundingPubkey = _dlcOffer.fundingPubkey;

        expect(
          alice.dlc.signDlcAccept(_dlcOffer, _dlcAccept),
        ).to.be.eventually.rejectedWith(Error);
      });
    });

    describe('isOfferer', () => {
      it('should determine if party is offerer', async () => {
        const aliceIsOfferer = await alice.dlc.isOfferer(dlcOffer, dlcAccept);
        const bobIsOfferer = await bob.dlc.isOfferer(dlcOffer, dlcAccept);
        expect(aliceIsOfferer).to.equal(true);
        expect(bobIsOfferer).to.equal(false);
        expect(
          carol.dlc.isOfferer(dlcOffer, dlcAccept),
        ).to.be.eventually.rejectedWith(Error);
      });
    });
  });

  describe('disjoint oracle events', () => {
    let oliviaOracle: Oracle;
    let oliverOracle: Oracle;

    beforeEach(async () => {
      console.time('offer-get-time');
      const aliceInput = await getInput(alice);
      const bobInput = await getInput(bob);

      oliviaOracle = new Oracle('olivia', numDigits);
      oliverOracle = new Oracle('oliver', numDigits);

      const {
        contractInfo: {
          contractDescriptor: contractDescriptor1,
          oracleInfo: oracleInfo1,
        },
        totalCollateral,
      } = generateContractInfo(oliviaOracle, numDigits, oracleBase, 'event_1');

      const {
        contractInfo: {
          contractDescriptor: contractDescriptor2,
          oracleInfo: oracleInfo2,
        },
      } = generateContractInfo(oliverOracle, numDigits, oracleBase, 'event_2');

      const {
        contractInfo: {
          contractDescriptor: contractDescriptor3,
          oracleInfo: oracleInfo3,
        },
      } = generateContractInfo(oliverOracle, numDigits, oracleBase, 'event_3');

      const contractInfo = new DisjointContractInfo();
      contractInfo.contractOraclePairs = [
        { contractDescriptor: contractDescriptor1, oracleInfo: oracleInfo1 },
        {
          contractDescriptor: contractDescriptor2,
          oracleInfo: oracleInfo2,
        },
        {
          contractDescriptor: contractDescriptor3,
          oracleInfo: oracleInfo3,
        },
      ];
      contractInfo.totalCollateral = totalCollateral;

      const feeRatePerVb = BigInt(10);
      const cetLocktime = 1617170572;
      const refundLocktime = 1617170573;

      dlcOffer = await alice.dlc.createDlcOffer(
        contractInfo,
        totalCollateral - BigInt(2000),
        feeRatePerVb,
        cetLocktime,
        refundLocktime,
        [aliceInput],
      );

      console.timeEnd('offer-get-time');
      console.time('accept-time');

      const acceptDlcOfferResponse: AcceptDlcOfferResponse =
        await bob.dlc.acceptDlcOffer(dlcOffer, [bobInput]);

      dlcAccept = acceptDlcOfferResponse.dlcAccept;
      dlcTransactions = acceptDlcOfferResponse.dlcTransactions;
      console.timeEnd('accept-time');
    });

    describe('actions', () => {
      beforeEach(async () => {
        console.time('sign-time');
        const signDlcAcceptResponse: SignDlcAcceptResponse =
          await alice.dlc.signDlcAccept(dlcOffer, dlcAccept);
        dlcSign = signDlcAcceptResponse.dlcSign;
        console.timeEnd('sign-time');

        const fundTx = await bob.dlc.finalizeDlcSign(
          dlcOffer,
          dlcAccept,
          dlcSign,
          dlcTransactions,
        );

        await bob.chain.sendRawTransaction(fundTx.serialize().toString('hex'));
      });

      it('execute event 1', async () => {
        const outcome = 3000;
        const oracleAttestation = generateOracleAttestation(
          outcome,
          oliviaOracle,
          oracleBase,
          numDigits,
          'event_1',
        );

        const txBuilder = new DlcTxBuilder(dlcOffer, dlcAccept.withoutSigs());
        const tx = txBuilder.buildFundingTransaction();
        const fundingTxid = tx.txId.serialize();
        const contractId = xor(fundingTxid, dlcAccept.temporaryContractId);

        expect(contractId.toString('hex')).to.equal(
          dlcSign.contractId.toString('hex'),
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

      it('execute event 2', async () => {
        const outcome = 0;
        const oracleAttestation = generateOracleAttestation(
          outcome,
          oliverOracle,
          oracleBase,
          numDigits,
          'event_2',
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

      it('execute event 3', async () => {
        const outcome = 0;
        const oracleAttestation = generateOracleAttestation(
          outcome,
          oliverOracle,
          oracleBase,
          numDigits,
          'event_3',
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

      it(`should fail to execute if event_id is not found`, async () => {
        const outcome = 2500;
        const oracleAttestation = generateOracleAttestation(
          outcome,
          oliverOracle,
          oracleBase,
          numDigits,
          'event_4',
        );

        let error = null;
        try {
          await bob.dlc.execute(
            dlcOffer,
            dlcAccept,
            dlcSign,
            dlcTransactions,
            oracleAttestation,
            false,
          );
        } catch (e) {
          error = e;
        }
        expect(error).to.be.an('Error');
      });

      it(`should fail to execute if wrong oracle signs event`, async () => {
        const outcome = 2500;
        const oracleAttestation = generateOracleAttestation(
          outcome,
          oliviaOracle,
          oracleBase,
          numDigits,
          'event_3',
        );

        let error = null;
        try {
          const cet = await bob.dlc.execute(
            dlcOffer,
            dlcAccept,
            dlcSign,
            dlcTransactions,
            oracleAttestation,
            false,
          );
          await bob.chain.sendRawTransaction(cet.serialize().toString('hex'));
        } catch (e) {
          error = e;
        }
        expect(error).to.not.be.undefined;
      });

      it('refund', async () => {
        const refund = await bob.dlc.refund(
          dlcOffer,
          dlcAccept,
          dlcSign,
          dlcTransactions,
        );
        const refundTxId = await bob.chain.sendRawTransaction(
          refund.serialize().toString('hex'),
        );
        const refundTx = await alice.getMethod('getTransactionByHash')(
          refundTxId,
        );
        expect(refundTx._raw.vout.length).to.equal(2);
        expect(refundTx._raw.vin.length).to.equal(1);
      });

      it('close', async () => {
        const aliceDlcClose: DlcClose = await alice.dlc.createDlcClose(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          10000n,
          true,
        );

        const bobDlcTx: string = await bob.dlc.finalizeDlcClose(
          dlcOffer,
          dlcAccept,
          aliceDlcClose,
          dlcTransactions,
        );

        const closeTxId = await bob.chain.sendRawTransaction(bobDlcTx);
        const closeTx = await alice.getMethod('getTransactionByHash')(
          closeTxId,
        );
        expect(closeTx._raw.vin.length).to.equal(2);
      });

      it('close with fixedInputs', async () => {
        const aliceInput = await getInput(alice);

        const aliceDlcClose: DlcClose = await alice.dlc.createDlcClose(
          dlcOffer,
          dlcAccept,
          dlcTransactions,
          10000n,
          true,
          [aliceInput],
        );

        const bobDlcTx: string = await bob.dlc.finalizeDlcClose(
          dlcOffer,
          dlcAccept,
          aliceDlcClose,
          dlcTransactions,
        );

        const closeTxId = await bob.chain.sendRawTransaction(bobDlcTx);
        const closeTx = await alice.getMethod('getTransactionByHash')(
          closeTxId,
        );
        expect(closeTx._raw.vin.length).to.equal(2);
      });

      it('should fail close with invalid fixedInputs', async () => {
        const wrongInput = await getInput(bob);

        expect(
          alice.dlc.createDlcClose(
            dlcOffer,
            dlcAccept,
            dlcTransactions,
            10000n,
            true,
            [wrongInput],
          ),
        ).to.be.eventually.rejectedWith(Error);
      });
    });
  });

  describe('derivation path increases', () => {
    it('should fail if > 5000 if 4999 has not been used', async () => {
      const address = (await bob.getMethod('getAddresses')(5001))[0];

      const aliceInput = await getInput(alice);
      const bobInput = await getInput(bob, address.address, address);

      oracle = new Oracle('olivia', numDigits);

      const { contractInfo, totalCollateral } = generateContractInfo(
        oracle,
        numDigits,
        oracleBase,
      );

      const feeRatePerVb = BigInt(10);
      const cetLocktime = 1617170572;
      const refundLocktime = 1617170573;

      const dlcOffer = await alice.dlc.createDlcOffer(
        contractInfo,
        totalCollateral - BigInt(2000),
        feeRatePerVb,
        cetLocktime,
        refundLocktime,
        [aliceInput],
      );

      const acceptDlcOfferResponse: AcceptDlcOfferResponse =
        await bob.dlc.acceptDlcOffer(dlcOffer, [bobInput]);

      const dlcAccept = acceptDlcOfferResponse.dlcAccept;
      const dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

      const signDlcAcceptResponse: SignDlcAcceptResponse =
        await alice.dlc.signDlcAccept(dlcOffer, dlcAccept);

      const dlcSign = signDlcAcceptResponse.dlcSign;

      return expect(
        bob.dlc.finalizeDlcSign(dlcOffer, dlcAccept, dlcSign, dlcTransactions),
      ).to.be.rejected;
    });

    it('should succeed if <= 5000', async () => {
      const address = (await bob.getMethod('getAddresses')(4999))[0];

      const aliceInput = await getInput(alice);
      const bobInput = await getInput(bob, address.address);

      oracle = new Oracle('olivia', numDigits);

      const { contractInfo, totalCollateral } = generateContractInfo(
        oracle,
        numDigits,
        oracleBase,
      );

      const feeRatePerVb = BigInt(10);
      const cetLocktime = 1617170572;
      const refundLocktime = 1617170573;

      const dlcOffer = await alice.dlc.createDlcOffer(
        contractInfo,
        totalCollateral - BigInt(2000),
        feeRatePerVb,
        cetLocktime,
        refundLocktime,
        [aliceInput],
      );

      const acceptDlcOfferResponse: AcceptDlcOfferResponse =
        await bob.dlc.acceptDlcOffer(dlcOffer, [bobInput]);

      const dlcAccept = acceptDlcOfferResponse.dlcAccept;
      const dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

      const signDlcAcceptResponse: SignDlcAcceptResponse =
        await alice.dlc.signDlcAccept(dlcOffer, dlcAccept);

      const dlcSign = signDlcAcceptResponse.dlcSign;

      return expect(
        bob.dlc.finalizeDlcSign(dlcOffer, dlcAccept, dlcSign, dlcTransactions),
      ).to.be.fulfilled;
    });

    it('should succeed if > 5000 after 4999 was used', async () => {
      const address = (await bob.getMethod('getAddresses')(5001))[0];

      const aliceInput = await getInput(alice);
      const bobInput = await getInput(bob, address.address);

      oracle = new Oracle('olivia', numDigits);

      const { contractInfo, totalCollateral } = generateContractInfo(
        oracle,
        numDigits,
        oracleBase,
      );

      const feeRatePerVb = BigInt(10);
      const cetLocktime = 1617170572;
      const refundLocktime = 1617170573;

      const dlcOffer = await alice.dlc.createDlcOffer(
        contractInfo,
        totalCollateral - BigInt(2000),
        feeRatePerVb,
        cetLocktime,
        refundLocktime,
        [aliceInput],
      );

      const acceptDlcOfferResponse: AcceptDlcOfferResponse =
        await bob.dlc.acceptDlcOffer(dlcOffer, [bobInput]);

      const dlcAccept = acceptDlcOfferResponse.dlcAccept;
      const dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

      const signDlcAcceptResponse: SignDlcAcceptResponse =
        await alice.dlc.signDlcAccept(dlcOffer, dlcAccept);

      const dlcSign = signDlcAcceptResponse.dlcSign;

      return expect(
        bob.dlc.finalizeDlcSign(dlcOffer, dlcAccept, dlcSign, dlcTransactions),
      ).to.be.fulfilled;
    });
  });
});

/**
 * External Test Vectors
 * i.e. Suredbits Oracle: https://test.oracle.suredbits.com/event/dae0e209c8a6747c27b9adf3d2fd3e1245b28fcef82e9e13e9a1b708f013a719
 * oracle_announcement_v0
 */
describe('external test vectors', () => {
  it('executes', async () => {
    const numDigits = 18;
    const oracleBase = 2;

    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    const oracle = new Oracle('olivia', numDigits);
    const oliviaInfo = oracle.GetOracleInfo();

    const eventDescriptor = new DigitDecompositionEventDescriptor();
    eventDescriptor.base = oracleBase;
    eventDescriptor.isSigned = false;
    eventDescriptor.unit = 'BTC-USD';
    eventDescriptor.precision = 0;
    eventDescriptor.nbDigits = numDigits;

    const event = new OracleEvent();
    event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
      Buffer.from(rValue, 'hex'),
    );
    event.eventMaturityEpoch = 1617170572;
    event.eventDescriptor = eventDescriptor;
    event.eventId = 'btc/usd';

    // Using valid Lava oracle announcement instead of problematic Deribit data
    const announcement = OracleAnnouncement.deserialize(
      Buffer.from(
        'fdd824fd02db8816a387d809fa769f872546088728e3d838dcbdf9c564a823d045707b294949c5d3ed7ba1e6286cc179d6b0390e1628814181d5d9a3e2796de25b4f4ffc40ab30bbf19aa3a986ed4e5640240b507901d6e03d6bbd71a281ed356a145516c655fdd822fd0275001205df86bd325d15f56dea823bc687e29b4891ef88eea325babf0f2536991fbd347a3a52025984aaa1ccf14194bb2a5189e266c7e1ec3be6773b9f334fdaf70cb893eb19029774ce66928efdbb77c12ebd9259be97d702ee98a5a89907ce22b922dbaa730559236f86255c85107e44ba569fba6ed1971c222c00f48db7104a5ac4bf030cc09c93e7a819f8c4e1158fe995a6fdb7ee4728b61fc7fd1835ea5c76329166f88f7c7043b225e290ce8e00e708e4f681513d1ccdcb4a12ccc59db43c9f3ab0a4611a6e261c8ba2af1cc2b1ff6c7eb658ef1661176c1d6360765c7c425c0e427060fdff248b8b295c66bf778d58fa449ce38d982c1305c3312ce47390d19ae8125354fd907f422174b457804843322c2b5ef58c6067056f5553d96551b61a25de66b5f80d613f8e1b2d73f4ddc841d711f8203a8b6c1172ac3ff93caf2bfc06b9b937330cd6ccd74eeba10168df17e237ef657e8fa8053525b84a358ff8ce569ae03b105a7af91de46d1b2d926561d14bee563e35dc11c893cf911e10c91aca9f4861ce3862ff6bb3605b4914b92b27f4557eae248b3777d60bd333829509eccfb53013a62dab537fa18c521fe0814dad0343b7278891a4abd0cd6ac5f50e94f4f1a7584ce2347567f437b9d4d9b4c7d64e9c8ae0c84bf4278c2f05eb4126ebb6e54c7f68773e2412e787674b00dba152eb9301ef6cac61c57b4a1e6818c34f770aee4cc673015b6591c0e790a58c3e5e40e264e1295a9e93faf7b6c90bdc61881f17c6272cef403405ff52cc1ff892ebd2dbf427ba180a9b249a2181f668551500fdd80a10000200064254435553440000000000121a61746f6d69632d646572696269742d4254432d32304a554e3235',
        'hex',
      ),
    );

    const oracleInfo = new SingleOracleInfo();
    oracleInfo.announcement = announcement;

    const { payoutFunction, totalCollateral } = CoveredCall.buildPayoutFunction(
      60000n,
      100000000n,
      oracleBase,
      numDigits,
    );

    const intervals = [
      { beginInterval: 0n, roundingMod: 1n },
      { beginInterval: 60000n, roundingMod: 50000n },
    ];
    const roundingIntervals = new RoundingIntervals();
    roundingIntervals.intervals = intervals;

    const contractDescriptor = new NumericalDescriptor();
    contractDescriptor.numDigits = numDigits;
    contractDescriptor.payoutFunction = payoutFunction;
    contractDescriptor.roundingIntervals = roundingIntervals;

    const contractInfo = new SingleContractInfo();
    contractInfo.totalCollateral = totalCollateral;
    contractInfo.contractDescriptor = contractDescriptor;
    contractInfo.oracleInfo = oracleInfo;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170573;

    const dlcOffer = await alice.dlc.createDlcOffer(
      contractInfo,
      totalCollateral - BigInt(2000),
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );
    console.timeEnd('offer-get-time');

    console.time('accept-time');
    const { dlcAccept, dlcTransactions } = await bob.dlc.acceptDlcOffer(
      dlcOffer,
      [bobInput],
    );
    console.timeEnd('accept-time');

    console.time('sign-time');
    const { dlcSign, dlcTransactions: dlcTxs } = await alice.dlc.signDlcAccept(
      dlcOffer,
      dlcAccept,
    );
    console.timeEnd('sign-time');

    const fundTx = await bob.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    await bob.chain.sendRawTransaction(fundTx.serialize().toString('hex'));

    const oracleAttestation = OracleAttestation.deserialize(
      Buffer.from(
        'fdd868fd04e11a61746f6d69632d646572696269742d4254432d32304a554e323530bbf19aa3a986ed4e5640240b507901d6e03d6bbd71a281ed356a145516c655001205df86bd325d15f56dea823bc687e29b4891ef88eea325babf0f2536991fbd34c0fb4677df7e85133e16a159e7d8e2e6b98a5a5f6409ca6b1d71ba8858fe5dd77a3a52025984aaa1ccf14194bb2a5189e266c7e1ec3be6773b9f334fdaf70cb8fc7548e7bb793ab6492a298dc996713c7fb7952c04adfb382bc356ad83f90b1793eb19029774ce66928efdbb77c12ebd9259be97d702ee98a5a89907ce22b922aa6aec27681683aada8344972723c59ea07e317be13b2b2a596e4ac8b194b0b0dbaa730559236f86255c85107e44ba569fba6ed1971c222c00f48db7104a5ac4d2fa3c829d6c94e889f41112472ad3e3b8621abbb0dbe4fc9afb9b5fee3622abbf030cc09c93e7a819f8c4e1158fe995a6fdb7ee4728b61fc7fd1835ea5c763223c7efde42400cf8e6c2db5c5b850ee7f15156545cd045d92d110e20809e3a979166f88f7c7043b225e290ce8e00e708e4f681513d1ccdcb4a12ccc59db43c9ff8dcaf1d606464f9bd5d5ed0f8431deb7d5291b19e3a3ff29a389a8ddf54a0123ab0a4611a6e261c8ba2af1cc2b1ff6c7eb658ef1661176c1d6360765c7c425c8d2a4c8afe473fe006cd048f11cf83632a34593ba0b45efeee67aebb4203ff7f0e427060fdff248b8b295c66bf778d58fa449ce38d982c1305c3312ce47390d1d6b245997c936730905989cd3ef7d29bbb72e14cd81700efef3469819ceaf2bb9ae8125354fd907f422174b457804843322c2b5ef58c6067056f5553d96551b6f4bd5ce1c9c25eb7b4f888bf2711ba4cc0934de4c3839ac7591448814b78958d1a25de66b5f80d613f8e1b2d73f4ddc841d711f8203a8b6c1172ac3ff93caf2ba27515bad6dfbaccc304f98c1c661ab038bf786a1227b9edeb8dc8be7110d647fc06b9b937330cd6ccd74eeba10168df17e237ef657e8fa8053525b84a358ff8df2d558c7052df024e9ab890eae93eef1368b5af2d39780c062e735f3a8f8dd0ce569ae03b105a7af91de46d1b2d926561d14bee563e35dc11c893cf911e10c95377912b33e20896e7adc4f09eb318079242300ab2de1e99a354476291739ab71aca9f4861ce3862ff6bb3605b4914b92b27f4557eae248b3777d60bd33382951a5c2d7985034f8447298a8635dc432520acd8dc5f8873ed00a82e909f33bfab09eccfb53013a62dab537fa18c521fe0814dad0343b7278891a4abd0cd6ac5f5c300bab1188daf9b7536b7a6518437e5308e08367f3964c320c268bbb1e7b6ca0e94f4f1a7584ce2347567f437b9d4d9b4c7d64e9c8ae0c84bf4278c2f05eb411e19c0883e2d76d749ac4c368442d7772cc9b6ca8ec826b74acc3ac10b0f0ed926ebb6e54c7f68773e2412e787674b00dba152eb9301ef6cac61c57b4a1e6818135ed1a8b99291b043f9273334843b84a9b1068e4dbc3533fc8762653c0584a7c34f770aee4cc673015b6591c0e790a58c3e5e40e264e1295a9e93faf7b6c90baa8e31e0077638520fbf0f4e2c5545bdc01671a03df57d681ecc60c0818d9918dc61881f17c6272cef403405ff52cc1ff892ebd2dbf427ba180a9b249a2181f6c3bdfb0e6d067a221dead5d6c1a34517333e74c2af42784796cf2a00a1e76d3b013001310131013001300131013101310130013001300130013101300130013001310130',
        'hex',
      ),
    );

    const cet = await bob.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
      oracleAttestation,
      false,
    );
    const cetTxId = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    const cetTx = await alice.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
  });

  it('should fallback to brute force finding payout index if find by payout fails', async () => {
    const announcement = OracleAnnouncement.deserialize(
      Buffer.from(
        'fdd824fd02da06315e57c0d437cc1634ec4b0aee2d613dd64b5ca3f91eecb0e140808fbd3a19e3ee2cebbd41285025ca1f6667cc99beb001e5e38016ed97f04c15d7b749c94930bbf19aa3a986ed4e5640240b507901d6e03d6bbd71a281ed356a145516c655fdd822fd0274001295ec10ffcdfcb6caa70e92c7778d099baa41b875b0506fee5a6c426ac35d992f250fb7d4e4f3d3e79989073c294040cad7736350dc1102d9bf6cd1f524fb6f8bfd86fded7df39438788d92f850a990d27ac58c5157b134dc53880e28ec1187356f77b5819cd88728300b30fab9ca27f18cceaea7c8dfac3f86db8e833a84342e29c7aee52ce7d0efedca2b56458bfbea558993036e6ef57a3691305b1d88b251fe7daa82a4aae6092163af24a70ece6f1b62cfa5ba30f1b31a4a4829bf769b1db46a160a997811168efd478edfabf43e62c86dc20f7fb9667d9f3c174294b27410130c13d0576e3e36b270840ec3e1b070afc897c56b97330865c3a5e3d57425fe581a861a8b56ddac9f6ba2d01113f31bb34afd734b2ae540d360c8ccadaeb90b85516c808b757de2a1c087d269f84488a7fab0810982277dce598218a8fc0951aa11365e49283918a8c5fe676b964dcd67ad48899dd1fbb727335f308d529934625029e029085218b7541ae9d80e264f82c28b483b279c860122b0bc653c74575fb6eaba2f05553f4c553016808a82527fc809c6f3850a10cbfa6d8595e396e7f66258763633108c8df08b641de9dc3790b13b5c1e93978d444ee408fd44704529b56c60482bb217049f0a0c50a556d71b237983a0818f52341574b96ae64da5a39a127421e9dc62dee328ddce4883bab35e66c4a7f94047f9d7564bb6e525971ff915eea8c93cc2589fa14210d8c3850701a5c3f45ecc4faf025d6ca763e9d2febbdee807d0c5160e8c0ec7fb0b73e4df1966c5d553a1338faea48014ec8b66dab680fdd80a10000200064254435553440000000000121961746f6d69632d646572696269742d4254432d365345503234',
        'hex',
      ),
    );

    const oracleInfo = new SingleOracleInfo();
    oracleInfo.announcement = announcement;

    const { payoutFunction } = CoveredCall.buildPayoutFunction(
      BigInt(59000),
      BigInt(100000000),
      2,
      18,
    );

    const roundingIntervals = new RoundingIntervals();
    roundingIntervals.intervals = [
      { beginInterval: BigInt(0), roundingMod: BigInt(5000) },
      { beginInterval: BigInt(59000), roundingMod: BigInt(1) },
    ];

    const numericalDescriptor = new NumericalDescriptor();
    numericalDescriptor.numDigits = 18;
    numericalDescriptor.payoutFunction = payoutFunction;
    numericalDescriptor.roundingIntervals = roundingIntervals;

    const contractInfo = new SingleContractInfo();
    contractInfo.contractDescriptor = numericalDescriptor;
    contractInfo.oracleInfo = oracleInfo;
    contractInfo.totalCollateral = BigInt(5612082);

    const dlcOffer = new DlcOffer();
    // NEW REQUIRED FIELDS
    dlcOffer.protocolVersion = 1;
    dlcOffer.temporaryContractId = crypto.randomBytes(32);
    dlcOffer.contractInfo = contractInfo;

    dlcOffer.contractFlags = Buffer.from('00', 'hex');
    dlcOffer.chainHash = Buffer.from(
      '6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000',
      'hex',
    );

    // NEW FORMAT FIELDS (lowercase, correct names)
    dlcOffer.fundingPubkey = Buffer.from(
      '03fcffcd79695d8818434bf3694a70010971668667e258389ddd4aaa2a405a2a07',
      'hex',
    );
    dlcOffer.payoutSpk = Buffer.from(
      '001415d252d2488c1bc0039fca0d84fb7fb724d5cb23',
      'hex',
    );
    dlcOffer.payoutSerialId = BigInt(2347722);
    dlcOffer.offerCollateral = BigInt(5112082);

    dlcOffer.changeSpk = Buffer.from(
      '001445a489167e3f1e08b5aa996ef80c7830f4234d7d',
      'hex',
    );
    dlcOffer.changeSerialId = BigInt(131392);
    dlcOffer.fundOutputSerialId = BigInt(4427080);
    dlcOffer.feeRatePerVb = BigInt(6);
    dlcOffer.cetLocktime = 1724168634;
    dlcOffer.refundLocktime = 1728028800;

    const fundingInput1 = new FundingInput();
    fundingInput1.inputSerialId = BigInt(889645);
    fundingInput1.prevTx = Tx.decode(
      StreamReader.fromHex(
        '020000000001010168545b168d246ba314b1bd5d98f09c6a19f7ba6ee1102b3e0c480b9ee71f370100000000fdffffff0260ae0a00000000001600147e7d7ee522eeda3166ba5471dfe262bae6604205a05a010000000000160014face8940cb898bb9d9eac13e29b62b5a4207b6380248304502210088037e9d5392fca2185def6275a0142cdff098921529ad597c0ad63b89ca983d02207a060ed2fd2424950ab82d61d36b74dc8522606be01d5d77d53e0a119429f82601210227cf9bb682f4d5db3ebf9b2eea9a330be8d9faf304412f3bda841b8dbb47fd9c00000000',
      ),
    );
    fundingInput1.prevTxVout = 0;
    fundingInput1.sequence = Sequence.default();
    fundingInput1.maxWitnessLen = 108;
    fundingInput1.redeemScript = Buffer.from('', 'hex');

    const fundingInput2 = new FundingInput();
    fundingInput2.inputSerialId = BigInt(1354484);
    fundingInput2.prevTx = Tx.decode(
      StreamReader.fromHex(
        '02000000000101d5be4a5e8e4a5c0de61e9dad5195e3df7c3f1e8b29032b90f8397abd244631d80300000000fdffffff02907f4f00000000001600140eab755e3c79c2757315e7589079382a0d4d8879be0b0c0000000000160014face8940cb898bb9d9eac13e29b62b5a4207b6380247304402206738e4f14747748fc63e5274ffc78c5578813669d279f1e79676f6f05264938d02200a508ab89d28f0fa3910be2dbfedf5d604dc180b78195feb897d9e70e6e9c5b701210227cf9bb682f4d5db3ebf9b2eea9a330be8d9faf304412f3bda841b8dbb47fd9c00000000',
      ),
    );
    fundingInput2.prevTxVout = 0;
    fundingInput2.sequence = Sequence.default();
    fundingInput2.maxWitnessLen = 108;
    fundingInput2.redeemScript = Buffer.from('', 'hex');

    dlcOffer.fundingInputs = [fundingInput1, fundingInput2];

    const oracleAttestation = OracleAttestation.deserialize(
      Buffer.from(AttestationWithPayoutAmountFailure, 'hex'),
    );

    const { index: outcomeIndex, groupLength } = await carol.getMethod(
      'FindOutcomeIndex',
    )(dlcOffer, oracleAttestation);

    expect(outcomeIndex).to.be.equal(17);
    expect(groupLength).to.be.equal(5);
  });
});

describe('DLC Splicing', () => {
  describe('single funded DLC to spliced DLC', () => {
    it('should create a DLC, then use its funding output as input to a new spliced DLC', async () => {
      // Step 1: Create and fund the first DLC (single-funded)
      console.time('first-dlc-creation');

      const oracle1 = new Oracle('oracle1', 1);
      const aliceInput1 = await getInput(alice);

      const maxCollateral1 = await alice.dlc.calculateMaxCollateral(
        [aliceInput1],
        BigInt(10),
        1,
      );

      const { contractInfo: contractInfo1, totalCollateral: totalCollateral1 } =
        generateEnumCollateralContractInfo(oracle1, maxCollateral1);

      const feeRatePerVb = BigInt(10);
      const cetLocktime1 = 1617170572;
      const refundLocktime1 = 1617170573;

      // Create first DLC offer (single-funded: alice provides all collateral)
      const dlcOffer1 = await alice.dlc.createDlcOffer(
        contractInfo1,
        totalCollateral1, // Alice funds entire DLC
        feeRatePerVb,
        cetLocktime1,
        refundLocktime1,
        [aliceInput1],
        InputSupplementationMode.None,
      );

      // Bob accepts without providing inputs (single-funded)
      const { dlcAccept: dlcAccept1, dlcTransactions: dlcTransactions1 } =
        await bob.dlc.acceptDlcOffer(dlcOffer1);

      // Alice signs
      const { dlcSign: dlcSign1 } = await alice.dlc.signDlcAccept(
        dlcOffer1,
        dlcAccept1,
      );

      // Finalize and broadcast first DLC
      const fundTx1 = await bob.dlc.finalizeDlcSign(
        dlcOffer1,
        dlcAccept1,
        dlcSign1,
        dlcTransactions1,
      );

      const fundTxId1 = await bob.chain.sendRawTransaction(
        fundTx1.serialize().toString('hex'),
      );

      console.timeEnd('first-dlc-creation');

      // Step 2: Extract DLC funding output details for splicing
      const fundTx1Details = await alice.getMethod('getTransactionByHash')(
        fundTxId1,
      );
      const fundingOutputValue = fundTx1Details._raw.vout[0].value;
      const fundingOutputAmount = BigInt(Math.round(fundingOutputValue * 1e8)); // Convert to satoshis

      // Get the funding pubkeys from the DLC messages
      const aliceFundPubkey = dlcOffer1.fundingPubkey.toString('hex');
      const bobFundPubkey = dlcAccept1.fundingPubkey.toString('hex');

      // Try both possible orderings to find which one matches the actual funding address
      // We need to determine which perspective was used in the original DLC
      let correctLocalPubkey: string;
      let correctRemotePubkey: string;

      // Test Alice-local perspective first
      try {
        const testInputInfo1 = alice.dlc.createDlcInputInfo(
          fundTxId1,
          0,
          fundingOutputAmount,
          aliceFundPubkey, // Alice local
          bobFundPubkey, // Bob remote,
          dlcTransactions1.contractId.toString('hex'),
          220,
          BigInt(1),
        );

        // This will throw if address doesn't match
        await alice.dlc.createDlcFundingInput(
          testInputInfo1,
          fundTx1.serialize().toString('hex'),
        );

        // If we get here, this ordering works
        correctLocalPubkey = aliceFundPubkey;
        correctRemotePubkey = bobFundPubkey;
        console.log('Using Alice-local perspective for DLC input');
      } catch (error) {
        // Try Bob-local perspective
        try {
          const testInputInfo2 = alice.dlc.createDlcInputInfo(
            fundTxId1,
            0,
            fundingOutputAmount,
            bobFundPubkey, // Bob local (from Alice's POV, Bob becomes local)
            aliceFundPubkey, // Alice remote (from Alice's POV, Alice becomes remote)
            dlcTransactions1.contractId.toString('hex'),
            220,
            BigInt(1),
          );

          await alice.dlc.createDlcFundingInput(
            testInputInfo2,
            fundTx1.serialize().toString('hex'),
          );

          // If we get here, this ordering works
          correctLocalPubkey = bobFundPubkey;
          correctRemotePubkey = aliceFundPubkey;
          console.log('Using Bob-local perspective for DLC input');
        } catch (error2) {
          throw new Error(
            `Neither pubkey ordering matches the original funding address. Alice-local error: ${error.message}, Bob-local error: ${error2.message}`,
          );
        }
      }

      // Create DLC input info with the correct ordering
      const dlcInputInfo = alice.dlc.createDlcInputInfo(
        fundTxId1,
        0, // First output is the funding output
        fundingOutputAmount,
        correctLocalPubkey,
        correctRemotePubkey,
        dlcTransactions1.contractId.toString('hex'),
        220, // Standard P2WSH multisig max witness length
        BigInt(1), // Input serial ID
      );

      // Step 3: Create second DLC that splices the first DLC's output
      console.time('second-dlc-creation');

      const oracle2 = new Oracle('oracle2', 1);
      const aliceInput2 = await getInput(alice); // Additional collateral input
      const bobInput2 = await getInput(bob);

      const cetLocktime2 = 1617170574;
      const refundLocktime2 = 1617170575;

      // Create DLC funding input from the first DLC
      const dlcFundingInput = await alice.dlc.createDlcFundingInput(
        dlcInputInfo,
        fundTx1.serialize().toString('hex'),
      );

      // Calculate the maximum collateral possible with our inputs
      const maxCollateral = await alice.dlc.calculateMaxCollateral(
        [dlcFundingInput, aliceInput2],
        feeRatePerVb,
        1, // Single contract
      );

      const { contractInfo: contractInfo2 } =
        generateEnumCollateralContractInfo(oracle2, maxCollateral);

      // Create second DLC offer that includes both DLC input and additional collateral
      // Use the calculated max collateral for exact amounts (no change)
      const dlcOffer2 = await alice.dlc.createDlcOffer(
        contractInfo2,
        maxCollateral, // Use exact calculated amount - no guessing!
        feeRatePerVb,
        cetLocktime2,
        refundLocktime2,
        [dlcFundingInput, aliceInput2], // Include both DLC input and regular input
        InputSupplementationMode.None, // No supplementation - exact amounts
      );

      // Bob accepts with his input
      const { dlcAccept: dlcAccept2, dlcTransactions: dlcTransactions2 } =
        await bob.dlc.acceptDlcOffer(dlcOffer2, [bobInput2]);

      // Verify that the second DLC was created using spliced transactions
      expect(dlcTransactions2).to.not.be.undefined;
      expect(dlcTransactions2.fundTx).to.not.be.undefined;

      // The funding transaction should have multiple inputs:
      // - The DLC input from the first DLC
      // - Alice's additional collateral input
      // - Bob's input
      const fundTx2Inputs = dlcTransactions2.fundTx.inputs.length;
      expect(fundTx2Inputs).to.be.greaterThan(1);

      // Alice signs the second DLC (DLC input signing handled automatically via funding pubkey derivation)
      const { dlcSign: dlcSign2 } = await alice.dlc.signDlcAccept(
        dlcOffer2,
        dlcAccept2,
      );

      // Finalize and broadcast second DLC
      const fundTx2 = await bob.dlc.finalizeDlcSign(
        dlcOffer2,
        dlcAccept2,
        dlcSign2,
        dlcTransactions2,
      );

      const fundTxId2 = await bob.chain.sendRawTransaction(
        fundTx2.serialize().toString('hex'),
      );

      console.timeEnd('second-dlc-creation');

      // Step 4: Verify the splicing worked correctly
      const fundTx2Details = await alice.getMethod('getTransactionByHash')(
        fundTxId2,
      );

      // Verify that one of the inputs references the first DLC's funding output
      const hasFirstDlcInput = fundTx2Details._raw.vin.some(
        (input) => input.txid === fundTxId1 && input.vout === 0,
      );
      expect(hasFirstDlcInput).to.be.true;

      // Verify the second DLC has proper funding
      expect(fundTx2Details._raw.vout.length).to.be.greaterThan(0);

      const oracleAttestation2 = generateEnumOracleAttestation(
        'paid',
        oracle2,
        'collateral',
      );

      const cet2 = await bob.dlc.execute(
        dlcOffer2,
        dlcAccept2,
        dlcSign2,
        dlcTransactions2,
        oracleAttestation2,
        false,
      );

      const cetTxId2 = await bob.chain.sendRawTransaction(
        cet2.serialize().toString('hex'),
      );

      const cetTx2 = await alice.getMethod('getTransactionByHash')(cetTxId2);
      expect(cetTx2._raw.vin.length).to.equal(1);
    });
  });
});

const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};
