import { Messages, PayoutRequest } from '@atomicfinance/types';
import {
  DlcAccept,
  DlcClose,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  MessageType,
} from '@node-dlc/messaging';
import randomBytes from 'randombytes';

export const asyncForEach = async (
  array: any,
  callback: any,
): Promise<void> => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

export function generateSerialId(): bigint {
  return randomBytes(4).reduce((acc, num, i) => acc + num ** i, 0);
}

export function generateSerialIds(count: number): bigint[] {
  return Array.from({ length: count }, () => generateSerialId());
}

export function checkTypes(types: ICheckTypesRequest): ICheckTypesResponse {
  const { _dlcOffer, _dlcAccept, _dlcSign, _dlcClose, _dlcTxs } = types;
  if (_dlcOffer && _dlcOffer.type !== MessageType.DlcOffer)
    throw Error('DlcOffer must be V0');
  if (_dlcAccept && _dlcAccept.type !== MessageType.DlcAccept)
    throw Error('DlcAccept must be V0');
  if (_dlcSign && _dlcSign.type !== MessageType.DlcSign)
    throw Error('DlcSign must be V0');
  if (_dlcClose && _dlcClose.type !== MessageType.DlcClose)
    throw Error('DlcClose must be V0');
  if (_dlcTxs && _dlcTxs.type !== MessageType.DlcTransactionsV0)
    throw Error('DlcTransactions must be V0');

  let dlcOffer: DlcOffer;
  let dlcAccept: DlcAccept;
  let dlcSign: DlcSign;
  let dlcClose: DlcClose;
  let dlcTxs: DlcTransactions;

  if (_dlcOffer) dlcOffer = _dlcOffer as DlcOffer;
  if (_dlcAccept) dlcAccept = _dlcAccept as DlcAccept;
  if (_dlcSign) dlcSign = _dlcSign as DlcSign;
  if (_dlcClose) dlcClose = _dlcClose as DlcClose;
  if (_dlcTxs) dlcTxs = _dlcTxs as DlcTransactions;

  return { dlcOffer, dlcAccept, dlcSign, dlcClose, dlcTxs };
}

export function outputsToPayouts(
  outputs: PayoutGroup[],
  rValuesMessagesList: Messages[],
  localCollateral: bigint,
  remoteCollateral: bigint,
  payoutLocal: boolean,
): OutputsToPayoutsResponse {
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
}

export interface ICheckTypesRequest {
  _dlcOffer?: DlcOffer;
  _dlcAccept?: DlcAccept;
  _dlcSign?: DlcSign;
  _dlcClose?: DlcClose;
  _dlcTxs?: DlcTransactions;
}

export interface ICheckTypesResponse {
  dlcOffer?: DlcOffer;
  dlcAccept?: DlcAccept;
  dlcSign?: DlcSign;
  dlcClose?: DlcClose;
  dlcTxs?: DlcTransactions;
}

interface PayoutGroup {
  payout: bigint;
  groups: number[][];
}

interface OutputsToPayoutsResponse {
  payouts: PayoutRequest[];
  messagesList: Messages[];
}
