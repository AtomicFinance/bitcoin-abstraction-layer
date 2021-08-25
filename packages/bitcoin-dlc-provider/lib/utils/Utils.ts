import { Messages, PayoutRequest } from '@atomicfinance/types';
import {
  DlcAccept,
  DlcAcceptV0,
  DlcClose,
  DlcCloseV0,
  DlcOffer,
  DlcOfferV0,
  DlcSign,
  DlcSignV0,
  DlcTransactions,
  DlcTransactionsV0,
  MessageType,
} from '@node-dlc/messaging';
import randomBytes from 'randombytes';

export async function asyncForEach(array: any, callback: any) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

export function generateSerialId(): bigint {
  return randomBytes(4).reduce((acc, num, i) => acc + num ** i, 0);
}

export function checkTypes(types: ICheckTypesRequest): ICheckTypesResponse {
  const { _dlcOffer, _dlcAccept, _dlcSign, _dlcClose, _dlcTxs } = types;
  if (_dlcOffer && _dlcOffer.type !== MessageType.DlcOfferV0)
    throw Error('DlcOffer must be V0');
  if (_dlcAccept && _dlcAccept.type !== MessageType.DlcAcceptV0)
    throw Error('DlcAccept must be V0');
  if (_dlcSign && _dlcSign.type !== MessageType.DlcSignV0)
    throw Error('DlcSign must be V0');
  if (_dlcClose && _dlcClose.type !== MessageType.DlcCloseV0)
    throw Error('DlcClose must be V0');
  if (_dlcTxs && _dlcTxs.type !== MessageType.DlcTransactionsV0)
    throw Error('DlcTransactions must be V0');

  let dlcOffer: DlcOfferV0;
  let dlcAccept: DlcAcceptV0;
  let dlcSign: DlcSignV0;
  let dlcClose: DlcCloseV0;
  let dlcTxs: DlcTransactionsV0;

  if (_dlcOffer) dlcOffer = _dlcOffer as DlcOfferV0;
  if (_dlcAccept) dlcAccept = _dlcAccept as DlcAcceptV0;
  if (_dlcSign) dlcSign = _dlcSign as DlcSignV0;
  if (_dlcClose) dlcClose = _dlcClose as DlcCloseV0;
  if (_dlcTxs) dlcTxs = _dlcTxs as DlcTransactionsV0;

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
  dlcOffer?: DlcOfferV0;
  dlcAccept?: DlcAcceptV0;
  dlcSign?: DlcSignV0;
  dlcClose?: DlcCloseV0;
  dlcTxs?: DlcTransactionsV0;
}

interface PayoutGroup {
  payout: bigint;
  groups: number[][];
}

interface OutputsToPayoutsResponse {
  payouts: PayoutRequest[];
  messagesList: Messages[];
}
