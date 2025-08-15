import 'mocha';
import { expect } from 'chai';
import { sha256 } from '@node-dlc/crypto';
import {
  DlcAccept,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  EnumeratedDescriptor,
  EnumEventDescriptor,
  OracleAnnouncement,
  OracleAttestation,
  OracleEvent,
  SingleContractInfo,
  SingleOracleInfo,
} from '@node-dlc/messaging';
import { math } from 'bip-schnorr';

import {
  AcceptDlcOfferResponse,
  SignDlcAcceptResponse,
} from '../../../packages/bitcoin-dlc-provider';
import { chains, getInput } from '../common';
import Oracle from '../models/Oracle';
import { generateDdkCompatibleEnumOracleAttestation } from '../utils/contract';

const ddk = chains.bitcoinWithDdk.client;
const ddk2 = chains.bitcoinWithDdk2.client;

describe('DDK Oracle Compatibility', () => {
  it('should fund and execute enum DLC with DDK-compatible oracle', async () => {
    const oracle = new Oracle('olivia');
    const ddkInput = await getInput(ddk);
    const ddk2Input = await getInput(ddk2);

    const eventId = 'test';
    const oliviaInfo = oracle.GetOracleInfo();

    // Create event descriptor with simple enum outcomes
    const eventDescriptor = new EnumEventDescriptor();
    const outcomes = ['1', '2', '3'];
    eventDescriptor.outcomes = outcomes;

    // Create oracle event
    const event = new OracleEvent();
    event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
      Buffer.from(rValue, 'hex'),
    );
    event.eventMaturityEpoch = 10;
    event.eventDescriptor = eventDescriptor;
    event.eventId = eventId;

    // Create oracle announcement
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

    // Create contract descriptor with simple outcomes
    const contractDescriptor = new EnumeratedDescriptor();
    contractDescriptor.outcomes = [
      {
        outcome: '1',  // Use raw outcome, not SHA256
        localPayout: BigInt(1e6),
      },
      {
        outcome: '2',
        localPayout: BigInt(0),
      },
      {
        outcome: '3',
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

    // Create DLC offer
    const dlcOffer = await ddk.dlc.createDlcOffer(
      contractInfo,
      totalCollateral - BigInt(2000),
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [ddkInput],
    );

    // Accept DLC offer
    const acceptDlcOfferResponse: AcceptDlcOfferResponse =
      await ddk2.dlc.acceptDlcOffer(dlcOffer, [ddk2Input]);

    const dlcAccept = acceptDlcOfferResponse.dlcAccept;
    const dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

    // Sign DLC accept
    const signDlcAcceptResponse: SignDlcAcceptResponse =
      await ddk.dlc.signDlcAccept(dlcOffer, dlcAccept);

    const dlcSign = signDlcAcceptResponse.dlcSign;

    // Finalize and broadcast funding transaction
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

    // Create oracle attestation for outcome '1'
    const oracleAttestation = generateDdkCompatibleEnumOracleAttestation('1', oracle, eventId);

    console.log('Oracle attestation:', {
      eventId: oracleAttestation.eventId,
      oraclePubkey: oracleAttestation.oraclePubkey.toString('hex'),
      signatures: oracleAttestation.signatures.map(s => s.toString('hex')),
      outcomes: oracleAttestation.outcomes,
    });

    // Execute the DLC with the oracle attestation
    const cet = await ddk2.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
      oracleAttestation,
      false,
    );

    // Broadcast the CET
    const cetTxId = await ddk2.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    expect(cetTxId).to.not.be.undefined;

    // Verify the CET was created correctly
    const cetTx = await ddk2.getMethod('getTransactionByHash')(cetTxId);
    expect(cetTx._raw.vin.length).to.equal(1);
    
    console.log('✅ DLC executed successfully with DDK-compatible oracle!');
  });
});