import { DdkInterface } from '../../../packages/types';

/** The ddk engine that `load-ddk.mjs` imported before the specs loaded. */
export function ddkEngine(): DdkInterface {
  const ddk = (globalThis as { __balTestDdk?: DdkInterface }).__balTestDdk;
  if (!ddk) {
    throw new Error(
      'ddk engine not loaded: run mocha with --require tests/integration/utils/load-ddk.mjs',
    );
  }
  return ddk;
}
