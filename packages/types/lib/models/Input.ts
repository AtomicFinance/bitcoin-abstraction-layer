import { bitcoin as bT } from '@liquality/types';

import Amount from './Amount';
import Utxo from './Utxo';

/**
 * Class for interfacing with inputs/utxos in Liquality Chainify
 * https://github.com/liquality/chainify
 *
 * These inputs can have different fields for value
 * satoshis (sats): https://github.com/liquality/chainify/blob/dev/packages/bitcoin-esplora-api-provider/lib/BitcoinEsploraApiProvider.js#L65
 * amount (btc): https://github.com/liquality/chainify/blob/dev/packages/bitcoin-esplora-api-provider/lib/BitcoinEsploraApiProvider.js#L74
 * value (sats): https://github.com/liquality/chainify/blob/dev/packages/bitcoin-wallet-provider/lib/BitcoinWalletProvider.js#L331
 *
 * This will be fixed once typescript branch is merged:
 * https://github.com/liquality/chainify/tree/typescript
 * satoshis and amount will not be necessary, only value
 * https://github.com/liquality/chainify/blob/typescript/packages/types/lib/bitcoin.ts#L46
 */
export default class Input {
  constructor(
    readonly txid: string,
    readonly vout: number,
    readonly address: string,
    readonly amount: number, // in BTC
    readonly value: number, // in sats
    readonly derivationPath?: string,
    readonly maxWitnessLength?: number,
    readonly redeemScript?: string,
    readonly inputSerialId?: bigint,
    readonly scriptPubKey?: string,
    readonly label?: string,
    readonly confirmations?: number,
    readonly spendable?: boolean,
    readonly solvable?: boolean,
    readonly safe?: boolean,
  ) {}

  toUtxo(): Utxo {
    let amount: Amount;
    if (this.value) {
      amount = Amount.FromSatoshis(this.value);
    } else if (this.amount) {
      amount = Amount.FromBitcoin(this.amount);
    }

    return {
      txid: this.txid,
      vout: this.vout,
      amount,
      address: this.address,
      derivationPath: this.derivationPath,
      maxWitnessLength: this.maxWitnessLength ? this.maxWitnessLength : 108,
      toJSON: Utxo.prototype.toJSON,
      toInput: Utxo.prototype.toInput,
    };
  }

  static fromUTXO(utxo: bT.UTXO): Input {
    const amount: Amount = Amount.FromSatoshis(utxo.value);

    return {
      txid: utxo.txid,
      vout: utxo.vout,
      address: utxo.address,
      value: utxo.value,
      amount: amount.GetBitcoinAmount(),
      toUtxo: Input.prototype.toUtxo,
    };
  }
}
