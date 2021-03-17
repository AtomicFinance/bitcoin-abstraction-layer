import Utxo, { UtxoJSON } from './Utxo';

export default class PartyInputs {
  constructor(
    readonly fundPublicKey: string,
    readonly changeAddress: string,
    readonly finalAddress: string,
    readonly utxos: Utxo[]
  ) {}

  public GetTotalInputAmount() {
    return this.utxos.reduce<number>(
      (prev, cur) => prev + cur.amount.GetSatoshiAmount(),
      0
    );
  }

  toJSON(): PartyInputsJSON {
    const utxosJSON: UtxoJSON[] = [];
    for (let i = 0; i < this.utxos.length; i++) {
      const utxo = this.utxos[i].toJSON();
      utxosJSON.push(utxo);
    }

    return Object.assign({}, this, {
      fundPublicKey: this.fundPublicKey,
      changeAddress: this.changeAddress,
      finalAddress: this.finalAddress,
      utxos: utxosJSON,
    });
  }

  static fromJSON(json: PartyInputsJSON): PartyInputs {
    let partyInputs = Object.create(PartyInputs.prototype);
    if (!json) return;

    const utxos: Utxo[] = [];

    for (let i = 0; i < json.utxos.length; i++) {
      const utxo = Utxo.fromJSON(json.utxos[i]);
      utxos.push(utxo);
    }

    return Object.assign(partyInputs, json, {
      fundPublicKey: json.fundPublicKey,
      changeAddress: json.changeAddress,
      finalAddress: json.finalAddress,
      utxos,
    });
  }

  static reviver(key: string, value: any): any {
    return key === '' ? PartyInputs.fromJSON(value) : value;
  }
}

export interface PartyInputsJSON {
  fundPublicKey: string;
  changeAddress: string;
  finalAddress: string;
  utxos: UtxoJSON[];
}
