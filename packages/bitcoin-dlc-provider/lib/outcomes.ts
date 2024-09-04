import {
  HyperbolaPayoutCurve,
  PolynomialPayoutCurve,
  roundPayout,
} from '@node-dlc/core';
import {
  ContractDescriptorV1,
  ContractInfoV0,
  ContractInfoV1,
  DigitDecompositionEventDescriptorV0,
  DlcOffer,
  HyperbolaPayoutCurvePiece,
  MessageType,
  OracleAttestationV0,
  PayoutFunctionV0,
  PolynomialPayoutCurvePiece,
} from '@node-dlc/messaging';
import assert from 'assert';
import BigNumber from 'bignumber.js';

import {
  GetContractOraclePairs,
  GetIndicesFromPayouts,
  GetPayouts,
} from './payouts';
import { checkTypes } from './utils';

export const FindOutcomeIndexFromPolynomialPayoutCurvePiece = async (
  _dlcOffer: DlcOffer,
  contractDescriptor: ContractDescriptorV1,
  contractOraclePairIndex: number,
  polynomialPayoutCurvePiece: PolynomialPayoutCurvePiece,
  oracleAttestation: OracleAttestationV0,
  outcome: bigint,
): Promise<FindOutcomeResponse> => {
  const { dlcOffer } = checkTypes({ _dlcOffer });

  const polynomialCurve = PolynomialPayoutCurve.fromPayoutCurvePiece(
    polynomialPayoutCurvePiece,
  );

  const payouts = polynomialPayoutCurvePiece.points.map((point) =>
    Number(point.outcomePayout),
  );
  const minPayout = Math.min(...payouts);
  const maxPayout = Math.max(...payouts);

  const clampBN = (val: BigNumber) =>
    BigNumber.max(minPayout, BigNumber.min(val, maxPayout));

  const payout = clampBN(polynomialCurve.getPayout(outcome));

  const payoutResponses = GetPayouts(dlcOffer);
  const payoutIndexOffset = GetIndicesFromPayouts(payoutResponses)[
    contractOraclePairIndex
  ].startingMessagesIndex;

  const { payoutGroups } = payoutResponses[contractOraclePairIndex];

  const intervalsSorted = [
    ...contractDescriptor.roundingIntervals.intervals,
  ].sort((a, b) => Number(b.beginInterval) - Number(a.beginInterval));

  const interval = intervalsSorted.find(
    (interval) => Number(outcome) >= Number(interval.beginInterval),
  );

  const roundedPayout = BigInt(
    clampBN(
      new BigNumber(roundPayout(payout, interval.roundingMod).toString()),
    ).toString(),
  );

  const outcomesFormatted = oracleAttestation.outcomes.map((outcome) =>
    parseInt(outcome),
  );

  let index = 0;
  let groupIndex = -1;
  let groupLength = 0;

  for (const payoutGroup of payoutGroups) {
    if (payoutGroup.payout === roundedPayout) {
      groupIndex = payoutGroup.groups.findIndex((group) => {
        return group.every((msg, i) => msg === outcomesFormatted[i]);
      });
      if (groupIndex === -1)
        throw Error(
          'Failed to Find OutcomeIndex From PolynomialPayoutCurvePiece. \
Payout Group found but incorrect group index',
        );
      index += groupIndex;
      groupLength = payoutGroup.groups[groupIndex].length;
      break;
    } else {
      index += payoutGroup.groups.length;
    }
  }

  if (groupIndex === -1)
    throw Error(
      'Failed to Find OutcomeIndex From PolynomialPayoutCurvePiece. \
Payout Group not found',
    );

  return { index: payoutIndexOffset + index, groupLength };
};

export const FindOutcomeIndexFromHyperbolaPayoutCurvePiece = async (
  _dlcOffer: DlcOffer,
  contractDescriptor: ContractDescriptorV1,
  contractOraclePairIndex: number,
  hyperbolaPayoutCurvePiece: HyperbolaPayoutCurvePiece,
  oracleAttestation: OracleAttestationV0,
  outcome: bigint,
): Promise<FindOutcomeResponse> => {
  const { dlcOffer } = checkTypes({ _dlcOffer });

  const hyperbolaCurve = HyperbolaPayoutCurve.fromPayoutCurvePiece(
    hyperbolaPayoutCurvePiece,
  );

  const clampBN = (val: BigNumber) =>
    BigNumber.max(
      0,
      BigNumber.min(val, dlcOffer.contractInfo.totalCollateral.toString()),
    );

  const payout = clampBN(hyperbolaCurve.getPayout(outcome));

  const payoutResponses = GetPayouts(dlcOffer);
  const payoutIndexOffset = GetIndicesFromPayouts(payoutResponses)[
    contractOraclePairIndex
  ].startingMessagesIndex;

  const { payoutGroups } = payoutResponses[contractOraclePairIndex];

  const intervalsSorted = [
    ...contractDescriptor.roundingIntervals.intervals,
  ].sort((a, b) => Number(b.beginInterval) - Number(a.beginInterval));

  const interval = intervalsSorted.find(
    (interval) => Number(outcome) >= Number(interval.beginInterval),
  );

  const roundedPayout = BigInt(
    clampBN(
      new BigNumber(roundPayout(payout, interval.roundingMod).toString()),
    ).toString(),
  );

  const outcomesFormatted = oracleAttestation.outcomes.map((outcome) =>
    parseInt(outcome),
  );

  let index = 0;
  let groupIndex = -1;
  let groupLength = 0;
  const payoutGroupFound = false;

  for (const [i, payoutGroup] of payoutGroups.entries()) {
    if (payoutGroup.payout === roundedPayout) {
      groupIndex = payoutGroup.groups.findIndex((group) => {
        return group.every((msg, i) => msg === outcomesFormatted[i]);
      });
      if (groupIndex !== -1) {
        index += groupIndex;
        groupLength = payoutGroup.groups[groupIndex].length;
        break;
      }
    } else if (
      payoutGroup.payout === BigInt(Math.round(Number(payout.toString())))
    ) {
      // Edge case to account for case where payout is maximum payout for DLC
      // But rounded payout does not round down
      if (payoutGroups[i - 1].payout === roundedPayout) {
        // Ensure that the previous payout group causes index to be incremented
        index += payoutGroups[i - 1].groups.length;
      }

      groupIndex = payoutGroup.groups.findIndex((group) => {
        return group.every((msg, i) => msg === outcomesFormatted[i]);
      });
      if (groupIndex !== -1) {
        index += groupIndex;
        groupLength = payoutGroup.groups[groupIndex].length;
        break;
      }
    } else {
      index += payoutGroup.groups.length;
    }
  }

  if (groupIndex === -1) {
    if (payoutGroupFound) {
      throw Error(
        'Failed to Find OutcomeIndex From HyperbolaPayoutCurvePiece. \
Payout Group found but incorrect group index',
      );
    } else {
      throw Error(
        'Failed to Find OutcomeIndex From HyperbolaPayoutCurvePiece. \
Payout Group not found',
      );
    }
  }

  return { index: payoutIndexOffset + index, groupLength };
};

export const FindOutcomeIndex = async (
  _dlcOffer: DlcOffer,
  oracleAttestation: OracleAttestationV0,
): Promise<FindOutcomeResponse> => {
  const { dlcOffer } = checkTypes({ _dlcOffer });

  const contractOraclePairs = GetContractOraclePairs(dlcOffer.contractInfo);

  const contractOraclePairIndex = contractOraclePairs.findIndex(
    ({ oracleInfo }) =>
      oracleInfo.announcement.oracleEvent.eventId === oracleAttestation.eventId,
  );

  assert(
    contractOraclePairIndex !== -1,
    'OracleAttestation must be for an existing OracleEvent',
  );

  const contractOraclePair = contractOraclePairs[contractOraclePairIndex];

  const {
    contractDescriptor: _contractDescriptor,
    oracleInfo,
  } = contractOraclePair;

  assert(
    _contractDescriptor.type === MessageType.ContractDescriptorV1,
    'ContractDescriptor must be V1',
  );

  const contractDescriptor = _contractDescriptor as ContractDescriptorV1;
  const _payoutFunction = contractDescriptor.payoutFunction;

  assert(
    _payoutFunction.type === MessageType.PayoutFunctionV0,
    'PayoutFunction must be V0',
  );

  const eventDescriptor = oracleInfo.announcement.oracleEvent
    .eventDescriptor as DigitDecompositionEventDescriptorV0;
  const payoutFunction = _payoutFunction as PayoutFunctionV0;

  const base = eventDescriptor.base;

  const outcome: number = [...oracleAttestation.outcomes]
    .reverse()
    .reduce((acc, val, i) => acc + Number(val) * base ** i, 0);

  const piecesSorted = payoutFunction.pieces.sort(
    (a, b) => Number(a.endpoint) - Number(b.endpoint),
  );

  const piece = piecesSorted.find((piece) => outcome < piece.endpoint);

  switch (piece.payoutCurvePiece.type) {
    case MessageType.PolynomialPayoutCurvePiece:
      return FindOutcomeIndexFromPolynomialPayoutCurvePiece(
        dlcOffer,
        contractDescriptor,
        contractOraclePairIndex,
        piece.payoutCurvePiece as PolynomialPayoutCurvePiece,
        oracleAttestation,
        BigInt(outcome),
      );
    case MessageType.HyperbolaPayoutCurvePiece:
      return FindOutcomeIndexFromHyperbolaPayoutCurvePiece(
        dlcOffer,
        contractDescriptor,
        contractOraclePairIndex,
        piece.payoutCurvePiece as HyperbolaPayoutCurvePiece,
        oracleAttestation,
        BigInt(outcome),
      );
    case MessageType.OldHyperbolaPayoutCurvePiece:
      return FindOutcomeIndexFromHyperbolaPayoutCurvePiece(
        dlcOffer,
        contractDescriptor,
        contractOraclePairIndex,
        piece.payoutCurvePiece as HyperbolaPayoutCurvePiece,
        oracleAttestation,
        BigInt(outcome),
      );
    default:
      throw Error('Must be Hyperbola or Polynomial curve piece');
  }
};

export const ValidateEvent = (
  _dlcOffer: DlcOffer,
  oracleAttestation: OracleAttestationV0,
): void => {
  const { dlcOffer } = checkTypes({
    _dlcOffer,
  });

  switch (dlcOffer.contractInfo.type) {
    case MessageType.ContractInfoV0: {
      const contractInfo = dlcOffer.contractInfo as ContractInfoV0;
      switch (contractInfo.contractDescriptor.type) {
        case MessageType.ContractDescriptorV0:
          throw Error('ContractDescriptorV0 not yet supported');
        case MessageType.ContractDescriptorV1: {
          const oracleInfo = contractInfo.oracleInfo;
          if (
            oracleInfo.announcement.oracleEvent.eventId !==
            oracleAttestation.eventId
          )
            throw Error('Incorrect Oracle Attestation. Event Id must match.');
          break;
        }
        default:
          throw Error('ConractDescriptor must be V0 or V1');
      }
      break;
    }
    case MessageType.ContractInfoV1: {
      const contractInfo = dlcOffer.contractInfo as ContractInfoV1;
      const attestedOracleEvent = contractInfo.contractOraclePairs.find(
        ({ oracleInfo }) =>
          oracleInfo.announcement.oracleEvent.eventId ===
          oracleAttestation.eventId,
      );

      if (!attestedOracleEvent)
        throw Error('Oracle event of attestation not found.');

      break;
    }
    default:
      throw Error('ContractInfo must be V0 or V1');
  }
};

interface FindOutcomeResponse {
  index: number;
  groupLength: number;
}
