import Amount, { AmountJSON } from './Amount';

export default class Utxo {
  constructor(
    readonly txid: string,
    readonly vout: number,
    readonly value: number,
    readonly amount: Amount,
    readonly address: string,
    readonly derivationPath?: string,
    readonly maxWitnessLength?: number,
  ) {}

  toJSON(): UtxoJSON {
    return Object.assign({}, this, {
      txid: this.txid,
      vout: this.vout,
      value: this.value,
      amount: this.amount.toJSON(),
      address: this.address,
      derivationPath: this.derivationPath,
      maxWitnessLength: this.maxWitnessLength,
    });
  }

  static fromJSON(json: UtxoJSON): Utxo {
    const utxo = Object.create(Utxo.prototype);
    return Object.assign(utxo, json, {
      txid: json.txid,
      vout: json.vout,
      amount: Amount.fromJSON(json.amount),
      address: json.address,
      derivationPath: json.derivationPath,
      maxWitnessLength: json.maxWitnessLength,
    });
  }

  static reviver(key: string, value: any): any {
    return key === '' ? Utxo.fromJSON(value) : value;
  }
}

export interface UtxoJSON {
  txid: string;
  vout: number;
  amount: AmountJSON;
  address: string;
  derivationPath: string;
  maxWitnessLength: number;
}
