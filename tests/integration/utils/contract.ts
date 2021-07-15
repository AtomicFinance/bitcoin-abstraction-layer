import { CoveredCall } from '@node-dlc/core';
import {
  ContractDescriptorV1,
  ContractInfoV0,
  DigitDecompositionEventDescriptorV0,
  OracleAnnouncementV0,
  OracleAttestationV0,
  OracleEventV0,
  OracleInfoV0,
  RoundingIntervalsV0,
} from '@node-dlc/messaging';
import { math } from 'bip-schnorr';
import Oracle from '../models/Oracle';

export function generateContractInfo(
  oracle: Oracle,
  numDigits = 18,
  oracleBase = 2,
  eventId = 'btc/usd',
): { contractInfo: ContractInfoV0; totalCollateral: bigint } {
  const oliviaInfo = oracle.GetOracleInfo();

  const eventDescriptor = new DigitDecompositionEventDescriptorV0();
  eventDescriptor.base = oracleBase;
  eventDescriptor.isSigned = false;
  eventDescriptor.unit = 'BTC-USD';
  eventDescriptor.precision = 0;
  eventDescriptor.nbDigits = numDigits;

  const event = new OracleEventV0();
  event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
    Buffer.from(rValue, 'hex'),
  );
  event.eventMaturityEpoch = 1617170572;
  event.eventDescriptor = eventDescriptor;
  event.eventId = eventId;

  const announcement = new OracleAnnouncementV0();
  announcement.announcementSig = Buffer.from(
    oracle.GetSignature(
      math
        .taggedHash(
          'DLC/oracle/announcement/v0',
          event.serialize().toString('hex'),
        )
        .toString('hex'),
    ),
    'hex',
  );

  announcement.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
  announcement.oracleEvent = event;

  const oracleInfo = new OracleInfoV0();
  oracleInfo.announcement = announcement;

  const { payoutFunction, totalCollateral } = CoveredCall.buildPayoutFunction(
    4000n,
    1000000n,
    oracleBase,
    numDigits,
  );

  const intervals = [{ beginInterval: 0n, roundingMod: 500n }];
  const roundingIntervals = new RoundingIntervalsV0();
  roundingIntervals.intervals = intervals;

  const contractDescriptor = new ContractDescriptorV1();
  contractDescriptor.numDigits = numDigits;
  contractDescriptor.payoutFunction = payoutFunction;
  contractDescriptor.roundingIntervals = roundingIntervals;

  const contractInfo = new ContractInfoV0();
  contractInfo.totalCollateral = totalCollateral;
  contractInfo.contractDescriptor = contractDescriptor;
  contractInfo.oracleInfo = oracleInfo;

  return { contractInfo, totalCollateral };
}

export function generateOracleAttestation(
  outcome,
  oracle: Oracle,
  base = 2,
  nbDigits = 18,
  eventId = 'btc/usd',
): OracleAttestationV0 {
  const oracleInfo = oracle.GetOracleInfo();

  const outcomes = outcome.toString(base).padStart(nbDigits, '0').split('');

  const sigs: Buffer[] = [];
  for (let i = 0; i < nbDigits; i++) {
    const m = math
      .taggedHash('DLC/oracle/attestation/v0', outcomes[i].toString())
      .toString('hex');
    sigs.push(Buffer.from(oracle.GetSignature(m, i + 1), 'hex'));
  }

  const oracleAttestation = new OracleAttestationV0();
  oracleAttestation.eventId = eventId;
  oracleAttestation.oraclePubkey = Buffer.from(oracleInfo.publicKey, 'hex');
  oracleAttestation.signatures = sigs;
  oracleAttestation.outcomes = outcomes;

  return oracleAttestation;
}
