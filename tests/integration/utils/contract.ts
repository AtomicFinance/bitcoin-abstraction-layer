import { CoveredCall } from '@node-dlc/core';
import {
  DigitDecompositionEventDescriptorV0Pre167,
  NumericContractDescriptor,
  OracleAnnouncementV0Pre167,
  OracleAttestationV0Pre167,
  OracleEventV0Pre167,
  PayoutFunction,
  RoundingIntervals,
  SingleContractInfo,
  SingleOracleInfo,
} from '@node-dlc/messaging';
import { math } from 'bip-schnorr';

import Oracle from '../models/Oracle';

export function generateContractInfo(
  oracle: Oracle,
  numDigits = 18,
  oracleBase = 2,
  eventId = 'btc/usd',
): { contractInfo: SingleContractInfo; totalCollateral: bigint } {
  const oliviaInfo = oracle.GetOracleInfo();

  const eventDescriptor = new DigitDecompositionEventDescriptorV0Pre167();
  eventDescriptor.base = oracleBase;
  eventDescriptor.isSigned = false;
  eventDescriptor.unit = 'BTC-USD';
  eventDescriptor.precision = 0;
  eventDescriptor.nbDigits = numDigits;

  const event = new OracleEventV0Pre167();
  event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
    Buffer.from(rValue, 'hex'),
  );
  event.eventMaturityEpoch = 1617170572;
  event.eventDescriptor = eventDescriptor;
  event.eventId = eventId;

  const announcement = new OracleAnnouncementV0Pre167();
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

  const { payoutFunction, totalCollateral } = CoveredCall.buildPayoutFunction(
    4000n,
    1000000n,
    oracleBase,
    numDigits,
  );

  const intervals = [{ beginInterval: 0n, roundingMod: 500n }];
  const roundingIntervals = new RoundingIntervals();
  roundingIntervals.intervals = intervals;

  const contractDescriptor = new NumericContractDescriptor();
  contractDescriptor.numDigits = numDigits;
  contractDescriptor.payoutFunction = payoutFunction;
  contractDescriptor.roundingIntervals = roundingIntervals;

  const contractInfo = new SingleContractInfo();
  contractInfo.totalCollateral = totalCollateral;
  contractInfo.contractDescriptor = contractDescriptor;
  contractInfo.oracleInfo = oracleInfo;

  return { contractInfo, totalCollateral };
}

export function generateContractInfoCustomStrategyOracle(
  oracle: Oracle,
  numDigits = 18,
  oracleBase = 2,
  payoutFunction: PayoutFunction,
  intervals: { beginInterval: bigint; roundingMod: bigint }[],
  totalCollateral: bigint,
  unit = 'BTC',
  eventId = 'strategyOutcome',
): { contractInfo: SingleContractInfo; totalCollateral: bigint } {
  const oliviaInfo = oracle.GetOracleInfo();

  const eventDescriptor = new DigitDecompositionEventDescriptorV0Pre167();
  eventDescriptor.base = oracleBase;
  eventDescriptor.isSigned = false;
  eventDescriptor.unit = unit;
  eventDescriptor.precision = 0;
  eventDescriptor.nbDigits = numDigits;

  const event = new OracleEventV0Pre167();
  event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
    Buffer.from(rValue, 'hex'),
  );
  event.eventMaturityEpoch = 1617170572;
  event.eventDescriptor = eventDescriptor;
  event.eventId = eventId;

  const announcement = new OracleAnnouncementV0Pre167();
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

  const roundingIntervals = new RoundingIntervals();
  roundingIntervals.intervals = intervals;

  const contractDescriptor = new NumericContractDescriptor();
  contractDescriptor.numDigits = numDigits;
  contractDescriptor.payoutFunction = payoutFunction;
  contractDescriptor.roundingIntervals = roundingIntervals;

  const contractInfo = new SingleContractInfo();
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
): OracleAttestationV0Pre167 {
  const oracleInfo = oracle.GetOracleInfo();

  const outcomes = outcome.toString(base).padStart(nbDigits, '0').split('');

  const sigs: Buffer[] = [];
  for (let i = 0; i < nbDigits; i++) {
    const m = math
      .taggedHash('DLC/oracle/attestation/v0', outcomes[i].toString())
      .toString('hex');
    sigs.push(Buffer.from(oracle.GetSignature(m, i + 1), 'hex'));
  }

  const oracleAttestation = new OracleAttestationV0Pre167();
  oracleAttestation.eventId = eventId;
  oracleAttestation.oraclePubkey = Buffer.from(oracleInfo.publicKey, 'hex');
  oracleAttestation.signatures = sigs;
  oracleAttestation.outcomes = outcomes;

  return oracleAttestation;
}
