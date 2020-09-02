import * as Utils from "../utils/Utils";
import bitcoin from '../services/chainClient'
import { SchnorrSignRequest } from 'cfd-dlc-js-wasm'
import OracleInfo from "./OracleInfo";

export default class Oracle {
  readonly name: string;
  readonly kValue: string;
  readonly rValue: string;
  readonly publicKey: string;
  readonly privateKey: string;

  constructor(name: string) {
    this.name = name;
    let keyPair = Utils.CreateKeyPair();
    this.privateKey = keyPair.privkey;
    this.publicKey = keyPair.pubkey;
    keyPair = Utils.CreateKeyPair();
    this.kValue = keyPair.privkey;
    this.rValue = bitcoin.finance.dlc.GetSchnorrPublicNonce({ kValue: this.kValue }).hex;
  }

  // Returns the public information for the Oracle.
  public GetOracleInfo() {
    return new OracleInfo(this.name, this.rValue, this.publicKey);
  }

  // Sign a given message using the private key and the R value.
  public GetSignature(message: string) {
    const signRequest: SchnorrSignRequest = {
      privkey: this.privateKey,
      kValue: this.kValue,
      message,
    };

    return bitcoin.finance.dlc.SchnorrSign(signRequest).hex;
  }
}
