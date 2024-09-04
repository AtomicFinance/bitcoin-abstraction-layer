import {
  GetPayoutsResponse,
  Messages,
  PayoutRequest,
} from '@atomicfinance/types';
import {
  groupByIgnoringDigits,
  HyperbolaPayoutCurve,
  PolynomialPayoutCurve,
} from '@node-dlc/core';
import {
  ContractDescriptor,
  ContractDescriptorV1,
  ContractInfo,
  ContractInfoV0,
  ContractInfoV1,
  DigitDecompositionEventDescriptorV0,
  DlcOffer,
  DlcOfferV0,
  HyperbolaPayoutCurvePiece,
  MessageType,
  OracleEventV0,
  OracleInfoV0,
  PayoutFunctionV0,
} from '@node-dlc/messaging';

import { checkTypes } from './utils';

export const GetContractOraclePairs = (
  _contractInfo: ContractInfo,
): { contractDescriptor: ContractDescriptor; oracleInfo: OracleInfoV0 }[] => {
  switch (_contractInfo.type) {
    case MessageType.ContractInfoV0: {
      const contractInfo = _contractInfo as ContractInfoV0;
      return [
        {
          contractDescriptor: contractInfo.contractDescriptor,
          oracleInfo: contractInfo.oracleInfo,
        },
      ];
    }
    case MessageType.ContractInfoV1: {
      return (_contractInfo as ContractInfoV1).contractOraclePairs;
    }
    default:
      throw Error('ContractInfo must be V0 or V1');
  }
};

export const outputsToPayouts = (
  outputs: PayoutGroup[],
  rValuesMessagesList: Messages[],
  localCollateral: bigint,
  remoteCollateral: bigint,
  payoutLocal: boolean,
): OutputsToPayoutsResponse => {
  const payouts: PayoutRequest[] = [];
  const messagesList: Messages[] = [];

  outputs.forEach((output: PayoutGroup) => {
    const { payout, groups } = output;
    const payoutAmount: bigint = payout;

    groups.forEach((group: number[]) => {
      const messages = [];
      for (let i = 0; i < group.length; i++) {
        const digit: number = group[i];
        messages.push(rValuesMessagesList[i].messages[digit]);
      }

      const local = payoutLocal
        ? payoutAmount
        : localCollateral + remoteCollateral - payoutAmount;
      const remote = payoutLocal
        ? localCollateral + remoteCollateral - payoutAmount
        : payoutAmount;
      payouts.push({ local, remote });
      messagesList.push({ messages });
    });
  });

  return { payouts, messagesList };
};

export const GenerateEnumMessages = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  oracleEvent: OracleEventV0,
): Messages[] => {
  throw Error('Only DigitDecomposition Oracle Events supported');
};

export const GenerateDigitDecompositionMessages = (
  oracleEvent: OracleEventV0,
): Messages[] => {
  const oracleNonces = oracleEvent.oracleNonces;
  const eventDescriptor = oracleEvent.eventDescriptor as DigitDecompositionEventDescriptorV0;

  const messagesList: Messages[] = [];
  oracleNonces.forEach(() => {
    const messages = [];
    for (let i = 0; i < eventDescriptor.base; i++) {
      const m = i.toString();
      messages.push(m);
    }
    messagesList.push({ messages });
  });

  return messagesList;
};

export const GenerateMessages = (oracleInfo: OracleInfoV0): Messages[] => {
  const oracleEvent = oracleInfo.announcement.oracleEvent;

  switch (oracleEvent.eventDescriptor.type) {
    case MessageType.EnumEventDescriptorV0:
      return GenerateEnumMessages(oracleEvent);
    case MessageType.DigitDecompositionEventDescriptorV0:
      return GenerateDigitDecompositionMessages(oracleEvent);
    default:
      throw Error('EventDescriptor must be Enum or DigitDecomposition');
  }
};

/**
 * TODO: Add GetPayoutFromOutcomes
 *
 * private GetPayoutsFromOutcomes(
 *   contractDescriptor: ContractDescriptorV0,
 *   totalCollateral: bigint,
 * ): PayoutRequest[] {}
 */

export const GetPayoutsFromPayoutFunction = (
  _dlcOffer: DlcOffer,
  contractDescriptor: ContractDescriptorV1,
  oracleInfo: OracleInfoV0,
  totalCollateral: bigint,
): GetPayoutsResponse => {
  if (_dlcOffer.type !== MessageType.DlcOfferV0)
    throw Error('DlcOffer must be V0');
  const dlcOffer = _dlcOffer as DlcOfferV0;
  if (contractDescriptor.payoutFunction.type !== MessageType.PayoutFunctionV0)
    throw Error('PayoutFunction must be V0');
  const payoutFunction = contractDescriptor.payoutFunction as PayoutFunctionV0;
  if (payoutFunction.pieces.length === 0)
    throw Error('PayoutFunction must have at least once PayoutCurvePiece');
  if (payoutFunction.pieces.length > 1)
    throw Error('More than one PayoutCurvePiece not supported');
  const payoutCurvePiece = payoutFunction.pieces[0]
    .payoutCurvePiece as HyperbolaPayoutCurvePiece;
  if (
    payoutCurvePiece.type !== MessageType.HyperbolaPayoutCurvePiece &&
    payoutCurvePiece.type !== MessageType.OldHyperbolaPayoutCurvePiece
  )
    throw Error('Must be HyperbolaPayoutCurvePiece');
  if (payoutCurvePiece.b !== BigInt(0) || payoutCurvePiece.c !== BigInt(0))
    throw Error('b and c HyperbolaPayoutCurvePiece values must be 0');
  const eventDescriptor = oracleInfo.announcement.oracleEvent
    .eventDescriptor as DigitDecompositionEventDescriptorV0;
  if (eventDescriptor.type !== MessageType.DigitDecompositionEventDescriptorV0)
    throw Error('Only DigitDecomposition Oracle Events supported');

  const roundingIntervals = contractDescriptor.roundingIntervals;
  const cetPayouts = HyperbolaPayoutCurve.computePayouts(
    payoutFunction,
    totalCollateral,
    roundingIntervals,
  );

  const payoutGroups: PayoutGroup[] = [];
  cetPayouts.forEach((p) => {
    payoutGroups.push({
      payout: p.payout,
      groups: groupByIgnoringDigits(
        p.indexFrom,
        p.indexTo,
        eventDescriptor.base,
        contractDescriptor.numDigits,
      ),
    });
  });

  const rValuesMessagesList = GenerateMessages(oracleInfo);

  const { payouts, messagesList } = outputsToPayouts(
    payoutGroups,
    rValuesMessagesList,
    dlcOffer.offerCollateralSatoshis,
    dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateralSatoshis,
    true,
  );

  return { payouts, payoutGroups, messagesList };
};

export const GetPayoutsFromPolynomialPayoutFunction = (
  _dlcOffer: DlcOffer,
  contractDescriptor: ContractDescriptorV1,
  oracleInfo: OracleInfoV0,
  totalCollateral: bigint,
): GetPayoutsResponse => {
  if (_dlcOffer.type !== MessageType.DlcOfferV0)
    throw Error('DlcOffer must be V0');
  const dlcOffer = _dlcOffer as DlcOfferV0;
  if (contractDescriptor.payoutFunction.type !== MessageType.PayoutFunctionV0)
    throw Error('PayoutFunction must be V0');
  const payoutFunction = contractDescriptor.payoutFunction as PayoutFunctionV0;
  if (payoutFunction.pieces.length === 0)
    throw Error('PayoutFunction must have at least once PayoutCurvePiece');
  for (const piece of payoutFunction.pieces) {
    if (piece.payoutCurvePiece.type !== MessageType.PolynomialPayoutCurvePiece)
      throw Error('Must be PolynomialPayoutCurvePiece');
  }
  const eventDescriptor = oracleInfo.announcement.oracleEvent
    .eventDescriptor as DigitDecompositionEventDescriptorV0;
  if (eventDescriptor.type !== MessageType.DigitDecompositionEventDescriptorV0)
    throw Error('Only DigitDecomposition Oracle Events supported');

  const roundingIntervals = contractDescriptor.roundingIntervals;
  const cetPayouts = PolynomialPayoutCurve.computePayouts(
    payoutFunction,
    totalCollateral,
    roundingIntervals,
  );

  const payoutGroups: PayoutGroup[] = [];
  cetPayouts.forEach((p) => {
    payoutGroups.push({
      payout: p.payout,
      groups: groupByIgnoringDigits(
        p.indexFrom,
        p.indexTo,
        eventDescriptor.base,
        contractDescriptor.numDigits,
      ),
    });
  });

  const rValuesMessagesList = GenerateMessages(oracleInfo);

  const { payouts, messagesList } = outputsToPayouts(
    payoutGroups,
    rValuesMessagesList,
    dlcOffer.offerCollateralSatoshis,
    dlcOffer.contractInfo.totalCollateral - dlcOffer.offerCollateralSatoshis,
    true,
  );

  return { payouts, payoutGroups, messagesList };
};

export const GetPayouts = (_dlcOffer: DlcOffer): GetPayoutsResponse[] => {
  const { dlcOffer } = checkTypes({ _dlcOffer });

  const contractInfo = dlcOffer.contractInfo;
  const totalCollateral = contractInfo.totalCollateral;
  const contractOraclePairs = GetContractOraclePairs(contractInfo);

  const payoutResponses = contractOraclePairs.map(
    ({ contractDescriptor, oracleInfo }) =>
      GetPayoutsFromContractDescriptor(
        dlcOffer,
        contractDescriptor,
        oracleInfo,
        totalCollateral,
      ),
  );

  return payoutResponses;
};

export const FlattenPayouts = (
  payoutResponses: GetPayoutsResponse[],
): GetPayoutsResponse => {
  return payoutResponses.reduce(
    (acc, { payouts, payoutGroups, messagesList }) => {
      return {
        payouts: acc.payouts.concat(payouts),
        payoutGroups: acc.payoutGroups.concat(payoutGroups),
        messagesList: acc.messagesList.concat(messagesList),
      };
    },
  );
};

export const GetIndicesFromPayouts = (
  payoutResponses: GetPayoutsResponse[],
): { startingMessagesIndex: number; startingPayoutGroupsIndex: number }[] => {
  return payoutResponses.reduce(
    (prev, acc) => {
      return prev.concat({
        startingMessagesIndex:
          prev[prev.length - 1].startingMessagesIndex + acc.messagesList.length,
        startingPayoutGroupsIndex:
          prev[prev.length - 1].startingPayoutGroupsIndex +
          acc.payoutGroups.length,
      });
    },
    [{ startingMessagesIndex: 0, startingPayoutGroupsIndex: 0 }],
  );
};

export const GetPayoutsFromContractDescriptor = (
  dlcOffer: DlcOfferV0,
  contractDescriptor: ContractDescriptor,
  oracleInfo: OracleInfoV0,
  totalCollateral: bigint,
): GetPayoutsResponse => {
  switch (contractDescriptor.type) {
    case MessageType.ContractDescriptorV0: {
      throw Error('ContractDescriptorV0 not yet supported');
    }
    case MessageType.ContractDescriptorV1:
      {
        const contractDescriptorV1 = contractDescriptor as ContractDescriptorV1;
        const payoutFunction = contractDescriptorV1.payoutFunction as PayoutFunctionV0;

        // TODO: add a better check for this
        const payoutCurvePiece = payoutFunction.pieces[0].payoutCurvePiece;

        switch (payoutCurvePiece.type) {
          case MessageType.HyperbolaPayoutCurvePiece:
            return GetPayoutsFromPayoutFunction(
              dlcOffer,
              contractDescriptor as ContractDescriptorV1,
              oracleInfo,
              totalCollateral,
            );
          case MessageType.OldHyperbolaPayoutCurvePiece:
            return GetPayoutsFromPayoutFunction(
              dlcOffer,
              contractDescriptor as ContractDescriptorV1,
              oracleInfo,
              totalCollateral,
            );
          case MessageType.PolynomialPayoutCurvePiece:
            return GetPayoutsFromPolynomialPayoutFunction(
              dlcOffer,
              contractDescriptor as ContractDescriptorV1,
              oracleInfo,
              totalCollateral,
            );
        }
      }
      break;
    default: {
      throw Error('ContractDescriptor must be V0 or V1');
    }
  }
};

interface PayoutGroup {
  payout: bigint;
  groups: number[][];
}

interface OutputsToPayoutsResponse {
  payouts: PayoutRequest[];
  messagesList: Messages[];
}
