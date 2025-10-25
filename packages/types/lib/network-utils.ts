import { BitcoinNetwork } from 'bitcoin-network';

export type DdkNetworkString = 'bitcoin' | 'testnet' | 'regtest';

/**
 * Convert BitcoinNetwork object to DDK-compatible network string
 */
export function bitcoinNetworkToDdkString(
  network: BitcoinNetwork | string,
): DdkNetworkString {
  if (typeof network === 'string') {
    if (!isDdkNetworkString(network)) {
      throw new Error(
        `Invalid network string: ${network}. ` +
          `Expected one of: bitcoin, testnet, regtest`,
      );
    }
    return network as DdkNetworkString;
  }

  const mapping: Record<string, DdkNetworkString> = {
    bitcoin: 'bitcoin',
    bitcoin_testnet: 'testnet',
    bitcoin_regtest: 'regtest',
  };

  const result = mapping[network.name];
  if (!result) {
    throw new Error(
      `Unsupported network: ${network.name}. ` +
        `Expected one of: bitcoin, bitcoin_testnet, bitcoin_regtest`,
    );
  }

  return result;
}

/**
 * Type guard to check if a network string is valid for DDK
 */
export function isDdkNetworkString(value: string): value is DdkNetworkString {
  return ['bitcoin', 'testnet', 'regtest'].includes(value);
}
