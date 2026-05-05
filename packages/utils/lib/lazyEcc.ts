/**
 * Lazy accessors for `@bitcoin-js/tiny-secp256k1-asmjs` and the matching
 * `ECPair` factory.
 *
 * Why this exists: cold-start measurements showed ~3.8 s of unlock time
 * spent inside two top-level `const ECPair = ECPairFactory(ecc)` calls
 * across the providers. The cost has two sources:
 *
 *   1. Module-eval of `secp256k1.asm.js` (32k+ lines). On Hermes there is
 *      no AOT for asm.js, so parse + eval blocks the JS thread.
 *   2. ECPair's factory runs a validation pass (~150 secp256k1 ops)
 *      against the supplied `ecc` impl every time it's called. With
 *      Hermes interpreting asm.js at ~10 ms/op, that's ~1.6 s per call
 *      EVEN AFTER the module cache is warm.
 *
 * Both costs were paid on the unlock-screen critical path because the
 * providers ran `ECPairFactory(ecc)` at module top level. By routing
 * everything through these lazy getters, cold start does zero secp256k1
 * work; the first signing/verification operation pays a one-time bill,
 * which is acceptable because it lands on a user-initiated action.
 *
 * Usage in providers:
 *   - Replace `import * as ecc from '@bitcoin-js/tiny-secp256k1-asmjs'`
 *     and `const ECPair = ECPairFactory(ecc)` with imports from here.
 *   - Replace `ecc.verify(...)` with `getEcc().verify(...)`.
 *   - Replace `ECPair.fromWIF(...)` with `getECPair().fromWIF(...)`.
 *
 * The `require()` calls are deliberate \u2014 a static `import` would
 * re-introduce module-eval at the top of this file, defeating the point.
 */

import type { ECPairAPI, TinySecp256k1Interface } from 'ecpair';

let _ecc: TinySecp256k1Interface | null = null;
let _ECPair: ECPairAPI | null = null;

/**
 * Returns the (cached) `@bitcoin-js/tiny-secp256k1-asmjs` module. First
 * call triggers asm.js parse/eval; subsequent calls are O(1).
 */
export function getEcc(): TinySecp256k1Interface {
  if (_ecc) return _ecc;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _ecc = require('@bitcoin-js/tiny-secp256k1-asmjs');
  return _ecc;
}

/**
 * Returns the (cached) `ECPair` factory bound to `getEcc()`. First call
 * triggers ECPair's secp256k1 validation pass (~1.6 s on Hermes);
 * subsequent calls are O(1).
 */
export function getECPair(): ECPairAPI {
  if (_ECPair) return _ECPair;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ECPairFactory } = require('ecpair');
  _ECPair = ECPairFactory(getEcc());
  return _ECPair;
}
