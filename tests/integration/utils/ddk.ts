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

/**
 * The engine as a counterparty still on ddk-dlc 1.x runs it: new contracts
 * are built under the fee rule before ddk-dlc 2.0.0-rc.4.
 */
export function legacyFeeRuleEngine(engine = ddkEngine()): DdkInterface {
  return {
    ...engine,
    createDlcTransactions: (...args) =>
      engine.createDlcTransactionsWithFeeRule(
        ...args,
        engine.FeeRule.OwnPayoutOnly,
      ),
    createSplicedDlcTransactions: (...args) =>
      engine.createSplicedDlcTransactionsWithFeeRule(
        ...args,
        engine.FeeRule.OwnPayoutOnly,
      ),
  };
}
