import Amount, { AmountJSON } from './Amount';
import Input from './Input';

/**
 * Class for interfacing with utxos in CFD DLC JS
 * https://github.com/atomicfinance/cfd-dlc-js.git#v0.0.18
 */
export default class Utxo {
  constructor(
    readonly txid: string,
    readonly vout: number,
    readonly amount: Amount,
    readonly address: string,
    readonly derivationPath: string,
    readonly maxWitnessLength: number,
    readonly inputSerialId?: bigint | number,
  ) {}

  public toInput(): Input {
    return {
      txid: this.txid,
      vout: this.vout,
      address: this.address,
      amount: this.amount.GetBitcoinAmount(),
      value: this.amount.GetSatoshiAmount(),
      derivationPath: this.derivationPath,
      maxWitnessLength: this.maxWitnessLength,
      inputSerialId: BigInt(this.inputSerialId),
      toUtxo: Input.prototype.toUtxo,
    };
  }

  public toJSON(): UtxoJSON {
    return Object.assign({}, this, {
      txid: this.txid,
      vout: this.vout,
      amount: this.amount.toJSON(),
      address: this.address,
      derivationPath: this.derivationPath,
      maxWitnessLength: this.maxWitnessLength,
      inputSerialId: this.inputSerialId,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  inputSerialId?: bigint | number;
}
