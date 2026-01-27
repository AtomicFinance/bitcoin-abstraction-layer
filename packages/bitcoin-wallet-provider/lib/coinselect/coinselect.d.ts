declare module 'coinselect' {
  import type { CoinSelectFunction } from './types.js';
  const coinselectFn: CoinSelectFunction;
  export default coinselectFn;
}

declare module 'coinselect/accumulative.js' {
  import type { CoinSelectFunction } from './types.js';
  const accumulativeFn: CoinSelectFunction;
  export default accumulativeFn;
}

declare module 'coinselect/blackjack.js' {
  import type { CoinSelectFunction } from './types.js';
  const blackjackFn: CoinSelectFunction;
  export default blackjackFn;
}

declare module 'coinselect/break.js' {
  import type { CoinSelectFunction } from './types.js';
  const breakFn: CoinSelectFunction;
  export default breakFn;
}

declare module 'coinselect/split.js' {
  import type { CoinSelectFunction } from './types.js';
  const splitFn: CoinSelectFunction;
  export default splitFn;
}
