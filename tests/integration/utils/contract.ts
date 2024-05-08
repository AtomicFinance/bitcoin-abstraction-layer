import { Value } from '@node-dlc/bitcoin';
import {
  buildLongCallOrderOffer,
  CoveredCall,
  DualFundingTxFinalizer,
  PolynomialPayoutCurve,
} from '@node-dlc/core';
import {
  ContractDescriptorV1,
  ContractInfoV0,
  DigitDecompositionEventDescriptorV0,
  FundingInputV0,
  OracleAnnouncementV0,
  OracleAttestationV0,
  OracleEventV0,
  OracleInfoV0,
  OrderOfferV0,
  PayoutFunctionV0,
  RoundingIntervalsV0,
} from '@node-dlc/messaging';
import BN from 'bignumber.js';
import { math } from 'bip-schnorr';

import Oracle from '../models/Oracle';

export function generateContractInfo(
  oracle: Oracle,
  numDigits = 18,
  oracleBase = 2,
  eventId = 'btc/usd',
  strikePrice = BigInt(4000),
  contractSize = BigInt(1000000), // TODO: this should probably be called collateral
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
        .taggedHash('DLC/oracle/announcement/v0', event.serialize())
        .toString('hex'),
    ),
    'hex',
  );

  announcement.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
  announcement.oracleEvent = event;

  const oracleInfo = new OracleInfoV0();
  oracleInfo.announcement = announcement;

  const { payoutFunction, totalCollateral } = CoveredCall.buildPayoutFunction(
    strikePrice,
    contractSize,
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

export function generateContractInfoCustomStrategyOracle(
  oracle: Oracle,
  numDigits = 18,
  oracleBase = 2,
  payoutFunction: PayoutFunctionV0,
  intervals: { beginInterval: bigint; roundingMod: bigint }[],
  totalCollateral: bigint,
  unit = 'BTC',
  eventId = 'strategyOutcome',
): { contractInfo: ContractInfoV0; totalCollateral: bigint } {
  const oliviaInfo = oracle.GetOracleInfo();

  const eventDescriptor = new DigitDecompositionEventDescriptorV0();
  eventDescriptor.base = oracleBase;
  eventDescriptor.isSigned = false;
  eventDescriptor.unit = unit;
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
        .taggedHash('DLC/oracle/announcement/v0', event.serialize())
        .toString('hex'),
    ),
    'hex',
  );

  announcement.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
  announcement.oracleEvent = event;

  const oracleInfo = new OracleInfoV0();
  oracleInfo.announcement = announcement;

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
): OrderOfferV0 {
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
        .taggedHash('DLC/oracle/announcement/v0', event.serialize())
        .toString('hex'),
    ),
    'hex',
  );

  announcement.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
  announcement.oracleEvent = event;

  const oracleInfo = new OracleInfoV0();
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

export const DEFAULT_NUM_OFFER_INPUTS = 2;
export const DEFAULT_NUM_ACCEPT_INPUTS = 3;

export const calculateNetworkFees = (feeRate: bigint): number => {
  const input = new FundingInputV0();
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
): { payoutFunction: PayoutFunctionV0 } => {
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

  const payoutFunction = new PayoutFunctionV0();
  payoutFunction.endpoint0 = BigInt(0);
  payoutFunction.endpointPayout0 = maxLossPayout;
  payoutFunction.extraPrecision0 = 0;

  payoutFunction.pieces.push({
    payoutCurvePiece: payoutCurveMaxLoss.toPayoutCurvePiece(),
    endpoint: maxLossOutcome,
    endpointPayout: maxLossPayout,
    extraPrecision: 0,
  });

  payoutFunction.pieces.push({
    payoutCurvePiece: payoutCurveLoss.toPayoutCurvePiece(),
    endpoint: minLossOutcome,
    endpointPayout: belowThresholdPayout,
    extraPrecision: 0,
  });

  payoutFunction.pieces.push({
    payoutCurvePiece: payoutCurveBelowThreshold.toPayoutCurvePiece(),
    endpoint: thresholdOutcome - BigInt(1),
    endpointPayout: belowThresholdPayout,
    extraPrecision: 0,
  });

  payoutFunction.pieces.push({
    payoutCurvePiece: payoutCurve.toPayoutCurvePiece(),
    endpoint: thresholdOutcome,
    endpointPayout: aboveOrEqualThresholdPayout,
    extraPrecision: 0,
  });

  payoutFunction.pieces.push({
    payoutCurvePiece: payoutCurveAboveOrEqualThreshold.toPayoutCurvePiece(),
    endpoint: maxOutcome,
    endpointPayout: aboveOrEqualThresholdPayout,
    extraPrecision: 0,
  });

  return {
    payoutFunction,
  };
};

export const EnginePayout = { buildPayoutFunction };
