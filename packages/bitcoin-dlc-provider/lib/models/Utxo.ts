import Amount, { AmountJSON } from "./Amount";

export default class Utxo {
  constructor(
    readonly txid: string,
    readonly vout: number,
    readonly amount: Amount,
    readonly address: string,
    readonly derivationPath: string
  ) {}

  toJSON(): UtxoJSON {
    console.log('this.amount',)
    // copy all fields from `this` to an empty object and return in
    return Object.assign({}, this, {
      // convert fields that need converting
      txid: this.txid,
      vout: this.vout,
      amount: this.amount.toJSON(),
      address: this.address,
      derivationPath: this.derivationPath
    });
  }

  static fromJSON(json: UtxoJSON): Utxo {
    let utxo = Object.create(Utxo.prototype);
    return Object.assign(utxo, json, {
      txid: json.txid,
      vout: json.vout,
      amount: Amount.fromJSON(json.amount),
      address: json.address,
      derivationPath: json.derivationPath
    });
  }

  static reviver(key: string, value: any): any {
    return key === "" ? Utxo.fromJSON(value) : value;
  }
}

export interface UtxoJSON {
  txid: string,
  vout: number,
  amount: AmountJSON,
  address: string,
  derivationPath: string
}
