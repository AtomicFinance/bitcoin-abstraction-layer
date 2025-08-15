import { Value } from '@node-dlc/bitcoin';
import {
  buildLongCallOrderOffer,
  CoveredCall,
  DualFundingTxFinalizer,
  PolynomialPayoutCurve,
} from '@node-dlc/core';
import { sha256 } from '@node-dlc/crypto';
import {
  DigitDecompositionEventDescriptor,
  EnumeratedDescriptor,
  EnumEventDescriptor,
  FundingInput,
  NumericalDescriptor,
  OracleAnnouncement,
  OracleAttestation,
  OracleEvent,
  OrderOffer,
  PayoutFunction,
  RoundingIntervals,
  SingleContractInfo,
  SingleOracleInfo,
} from '@node-dlc/messaging';
import BN from 'bignumber.js';
import { math } from 'bip-schnorr';

import Oracle from '../models/Oracle';

export function generateEnumContractInfo(
  oracle: Oracle,
  eventId = 'trump-vs-kamala',
  totalCollateral = BigInt(1e6),
): { contractInfo: SingleContractInfo; totalCollateral: bigint } {
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
      outcome: 'BIDEN_WIN',
      localPayout: BigInt(1e6),
    },
    {
      outcome: 'BIDEN_LOSE',
      localPayout: BigInt(0),
    },
    {
      outcome: 'NEITHER',
      localPayout: BigInt(0),
    },
  ];

  const contractInfo = new SingleContractInfo();
  contractInfo.totalCollateral = totalCollateral;
  contractInfo.contractDescriptor = contractDescriptor;
  contractInfo.oracleInfo = oracleInfo;

  return { contractInfo, totalCollateral };
}

export function generateContractInfo(
  oracle: Oracle,
  numDigits = 18,
  oracleBase = 2,
  eventId = 'btc/usd',
): { contractInfo: SingleContractInfo; totalCollateral: bigint } {
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

  const { payoutFunction, totalCollateral } = CoveredCall.buildPayoutFunction(
    4000n,
    1000000n,
    oracleBase,
    numDigits,
  );

  const intervals = [{ beginInterval: 0n, roundingMod: 500n }];
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

  const eventDescriptor = new DigitDecompositionEventDescriptor();
  eventDescriptor.base = oracleBase;
  eventDescriptor.isSigned = false;
  eventDescriptor.unit = unit;
  eventDescriptor.precision = 0;
  eventDescriptor.nbDigits = numDigits;

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

  return { contractInfo, totalCollateral };
}

export function generateEnumCollateralContractInfo(
  oracle: Oracle,
  totalCollateral: bigint,
) {
  const contractDescriptor = new EnumeratedDescriptor();
  contractDescriptor.outcomes = [
    {
      outcome: sha256(Buffer.from('paid')).toString('hex'),
      localPayout: totalCollateral,
    },
    {
      outcome: sha256(Buffer.from('unpaid')).toString('hex'),
      localPayout: BigInt(0),
    },
  ];

  const oliviaInfo = oracle.GetOracleInfo();

  const eventDescriptor = new EnumEventDescriptor();
  eventDescriptor.outcomes = ['paid', 'unpaid'];

  const event = new OracleEvent();
  event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
    Buffer.from(rValue, 'hex'),
  );
  event.eventMaturityEpoch = 1617170572;
  event.eventDescriptor = eventDescriptor;
  event.eventId = 'collateral';

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

  const contractInfo = new SingleContractInfo();
  contractInfo.totalCollateral = totalCollateral;
  contractInfo.contractDescriptor = contractDescriptor;
  contractInfo.oracleInfo = oracleInfo;

  return { contractInfo, totalCollateral };
}

export function generateLongCallOffer(
  oracle: Oracle,
  numDigits = 18,
  oracleBase = 2,
  eventId = 'btc/usd',
  strikePrice: number,
  maxGain: Value,
  premium: Value,
  feePerByte: number,
  roundingInterval: number,
  networkName: string,
): OrderOffer {
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

  const contractSize = Value.fromBitcoin(1); // Adjust this value as needed
  const orderOffer = buildLongCallOrderOffer(
    oracleInfo.announcement,
    contractSize,
    strikePrice,
    maxGain,
    premium,
    feePerByte,
    roundingInterval,
    networkName,
  );

  return orderOffer;
}

export function generateOracleAttestation(
  outcome,
  oracle: Oracle,
  base = 2,
  nbDigits = 18,
  eventId = 'btc/usd',
): OracleAttestation {
  const oracleInfo = oracle.GetOracleInfo();

  const outcomes = outcome.toString(base).padStart(nbDigits, '0').split('');

  const sigs: Buffer[] = [];
  for (let i = 0; i < nbDigits; i++) {
    const m = math
      .taggedHash('DLC/oracle/attestation/v0', outcomes[i].toString())
      .toString('hex');
    sigs.push(Buffer.from(oracle.GetSignature(m, i + 1), 'hex'));
  }

  const oracleAttestation = new OracleAttestation();
  oracleAttestation.eventId = eventId;
  oracleAttestation.oraclePubkey = Buffer.from(oracleInfo.publicKey, 'hex');
  oracleAttestation.signatures = sigs;
  oracleAttestation.outcomes = outcomes;

  return oracleAttestation;
}

export function generateEnumOracleAttestation(
  outcome: string,
  oracle: Oracle,
  eventId = 'trump-vs-kamala',
): OracleAttestation {
  const oracleInfo = oracle.GetOracleInfo();

  const sigs: Buffer[] = [];

  // Spec-compliant: sign the tagged hash of the outcome as UTF-8 bytes
  // This matches what dlcdevkit expects: H(H(tag) || H(tag) || outcome_bytes)
  const m = math
    .taggedHash('DLC/oracle/attestation/v0', Buffer.from(outcome, 'utf8'))
    .toString('hex');
  sigs.push(Buffer.from(oracle.GetSignature(m), 'hex'));

  const oracleAttestation = new OracleAttestation();
  oracleAttestation.eventId = eventId;
  oracleAttestation.oraclePubkey = Buffer.from(oracleInfo.publicKey, 'hex');
  oracleAttestation.signatures = sigs;
  oracleAttestation.outcomes = [outcome];

  return oracleAttestation;
}

export function generateDdkCompatibleEnumOracleAttestation(
  outcome: string,
  oracle: Oracle,
  eventId = 'test',
): OracleAttestation {
  const oracleInfo = oracle.GetOracleInfo();

  const sigs: Buffer[] = [];

  // For DDK compatibility: The oracle must sign the tagged attestation message
  // DDK expects the signature on: H(H("DLC/oracle/attestation/v0") || H("DLC/oracle/attestation/v0") || outcome_bytes)
  const m = math
    .taggedHash('DLC/oracle/attestation/v0', Buffer.from(outcome, 'utf8'))
    .toString('hex');

  sigs.push(Buffer.from(oracle.GetSignature(m), 'hex'));

  const oracleAttestation = new OracleAttestation();
  oracleAttestation.eventId = eventId;
  oracleAttestation.oraclePubkey = Buffer.from(oracleInfo.publicKey, 'hex');
  oracleAttestation.signatures = sigs;
  oracleAttestation.outcomes = [outcome];

  return oracleAttestation;
}

export const DEFAULT_NUM_OFFER_INPUTS = 2;
export const DEFAULT_NUM_ACCEPT_INPUTS = 3;

export const calculateNetworkFees = (feeRate: bigint): number => {
  const input = new FundingInput();
  input.maxWitnessLen = 108;
  input.redeemScript = Buffer.from('', 'hex');

  const fakeSPK = Buffer.from(
    '0014663117d27e78eb432505180654e603acb30e8a4a',
    'hex',
  );

  const offerInputs = Array.from(
    { length: DEFAULT_NUM_OFFER_INPUTS },
    () => input,
  );

  const acceptInputs = Array.from(
    { length: DEFAULT_NUM_ACCEPT_INPUTS },
    () => input,
  );

  const finalizer = new DualFundingTxFinalizer(
    offerInputs,
    fakeSPK,
    fakeSPK,
    acceptInputs,
    fakeSPK,
    fakeSPK,
    feeRate,
  );

  return Number(finalizer.offerFees + finalizer.acceptFees);
};

const buildPayoutFunction = (
  maxLossPayout: bigint,
  maxLossOutcome: bigint,
  minLossOutcome: bigint,
  belowThresholdPayout: bigint,
  aboveOrEqualThresholdPayout: bigint,
  thresholdOutcome: bigint,
  oracleBase: number,
  oracleDigits: number,
): { payoutFunction: PayoutFunction } => {
  // Max outcome limited by the oracle
  const maxOutcome = BigInt(
    new BN(oracleBase).pow(oracleDigits).minus(1).toString(10),
  );

  const payoutCurveMaxLoss = new PolynomialPayoutCurve([
    { outcome: new BN(0), payout: new BN(Number(maxLossPayout)) },
    {
      outcome: new BN(Number(maxLossOutcome)),
      payout: new BN(Number(maxLossPayout)),
    },
  ]);

  const payoutCurveLoss = new PolynomialPayoutCurve([
    {
      outcome: new BN(Number(maxLossOutcome)),
      payout: new BN(Number(maxLossPayout)),
    },
    {
      outcome: new BN(Number(minLossOutcome)),
      payout: new BN(Number(belowThresholdPayout)),
    },
  ]);

  // payout for outcomes below threshold
  const payoutCurveBelowThreshold = new PolynomialPayoutCurve([
    {
      outcome: new BN(Number(minLossOutcome)),
      payout: new BN(Number(belowThresholdPayout)),
    },
    {
      outcome: new BN(Number(thresholdOutcome) - 1),
      payout: new BN(Number(belowThresholdPayout)),
    },
  ]);

  // payout line
  const payoutCurve = new PolynomialPayoutCurve([
    {
      outcome: new BN(Number(thresholdOutcome) - 1),
      payout: new BN(Number(belowThresholdPayout)),
    },
    {
      outcome: new BN(Number(thresholdOutcome)),
      payout: new BN(Number(aboveOrEqualThresholdPayout)),
    },
  ]);

  // payout for outcomes above or equal to x
  const payoutCurveAboveOrEqualThreshold = new PolynomialPayoutCurve([
    {
      outcome: new BN(Number(thresholdOutcome)),
      payout: new BN(Number(aboveOrEqualThresholdPayout)),
    },
    {
      outcome: new BN(Number(maxOutcome)),
      payout: new BN(Number(aboveOrEqualThresholdPayout)),
    },
  ]);

  const payoutFunction = new PayoutFunction();

  payoutFunction.payoutFunctionPieces.push({
    endPoint: {
      eventOutcome: maxLossOutcome,
      outcomePayout: maxLossPayout,
      extraPrecision: 0,
    },
    payoutCurvePiece: payoutCurveMaxLoss.toPayoutCurvePiece(),
  });

  payoutFunction.payoutFunctionPieces.push({
    endPoint: {
      eventOutcome: minLossOutcome,
      outcomePayout: belowThresholdPayout,
      extraPrecision: 0,
    },
    payoutCurvePiece: payoutCurveLoss.toPayoutCurvePiece(),
  });

  payoutFunction.payoutFunctionPieces.push({
    endPoint: {
      eventOutcome: thresholdOutcome - BigInt(1),
      outcomePayout: belowThresholdPayout,
      extraPrecision: 0,
    },
    payoutCurvePiece: payoutCurveBelowThreshold.toPayoutCurvePiece(),
  });

  payoutFunction.payoutFunctionPieces.push({
    endPoint: {
      eventOutcome: thresholdOutcome,
      outcomePayout: aboveOrEqualThresholdPayout,
      extraPrecision: 0,
    },
    payoutCurvePiece: payoutCurve.toPayoutCurvePiece(),
  });

  payoutFunction.payoutFunctionPieces.push({
    endPoint: {
      eventOutcome: maxOutcome,
      outcomePayout: aboveOrEqualThresholdPayout,
      extraPrecision: 0,
    },
    payoutCurvePiece: payoutCurveAboveOrEqualThreshold.toPayoutCurvePiece(),
  });

  // Set the last endpoint
  payoutFunction.lastEndpoint = {
    eventOutcome: maxOutcome,
    outcomePayout: aboveOrEqualThresholdPayout,
    extraPrecision: 0,
  };

  return {
    payoutFunction,
  };
};

export const EnginePayout = { buildPayoutFunction };
