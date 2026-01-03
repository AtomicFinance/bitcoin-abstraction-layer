export interface Utxo {
  value: number;
}

export interface CoinSelectResult {
  inputs?: Utxo[];
  outputs?: Utxo[];
  fee: number;
}

export type CoinSelectFunction = (
  utxos: Utxo[],
  targets: Utxo[],
  feeRate: number,
) => CoinSelectResult;
