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
    readonly maxWitnessLength: number,
    readonly derivationPath?: string,
    readonly inputSerialId?: bigint | number,
  ) {}

  public toInput(): Input {
    return new Input(
      this.txid,
      this.vout,
      this.address,
      this.amount.GetBitcoinAmount(),
      this.amount.GetSatoshiAmount(),
      this.derivationPath,
      this.maxWitnessLength,
      undefined, // redeemScript
      this.inputSerialId ? BigInt(this.inputSerialId) : undefined,
      undefined, // scriptPubKey
      undefined, // label
      undefined, // confirmations
      undefined, // spendable
      undefined, // solvable
      undefined, // safe
      undefined, // dlcInput - regular UTXOs don't have DLC info
    );
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
  derivationPath?: string;
  maxWitnessLength: number;
  inputSerialId?: bigint | number;
}
