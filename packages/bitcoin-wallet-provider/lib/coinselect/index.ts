import coinselectFn from 'coinselect';
import accumulativeFn from 'coinselect/accumulative.js';
import blackjackFn from 'coinselect/blackjack.js';
import breakFn from 'coinselect/break.js';
import splitFn from 'coinselect/split.js';
import type { CoinSelectFunction, Utxo, CoinSelectResult } from './types.js';
import { CoinSelectMode } from '@atomicfinance/types/dist/models/Input';

export { coinselectFn, accumulativeFn, blackjackFn, breakFn, splitFn };
export type { CoinSelectFunction, Utxo, CoinSelectResult };

export const getCoinSelectFunction = (
  coinSelectMode: CoinSelectMode,
): CoinSelectFunction => {
  switch (coinSelectMode) {
    case CoinSelectMode.Accumulative:
      return accumulativeFn;
    case CoinSelectMode.Blackjack:
      return blackjackFn;
    case CoinSelectMode.Break:
      return breakFn;
    case CoinSelectMode.Split:
      return splitFn;
    default:
      return coinselectFn;
  }
};
