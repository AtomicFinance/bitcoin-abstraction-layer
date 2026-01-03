import coinselectFn from 'coinselect';
import accumulativeFn from 'coinselect/accumulative.js';
import blackjackFn from 'coinselect/blackjack.js';
import breakFn from 'coinselect/break.js';
import splitFn from 'coinselect/split.js';
import type { Utxo, CoinSelectResult } from './types.js';
import { CoinSelectMode } from '@atomicfinance/types/dist/models/Input';

export const runCoinSelect = (
  coinSelectMode: CoinSelectMode,
  utxos: Utxo[],
  targets: Utxo[],
  feeRate: number,
): CoinSelectResult => {
  switch (coinSelectMode) {
    case CoinSelectMode.Accumulative:
      return accumulativeFn(utxos, targets, feeRate);
    case CoinSelectMode.Blackjack:
      return blackjackFn(utxos, targets, feeRate);
    case CoinSelectMode.Break:
      // Break expects a single output object, not an array
      return breakFn(utxos, targets[0], feeRate);
    case CoinSelectMode.Split:
      return splitFn(utxos, targets, feeRate);
    default:
      // Default is coinselect with blackjack + accumulative fallback
      return coinselectFn(utxos, targets, feeRate);
  }
};
