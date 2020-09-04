import { SchnorrSignRequest } from 'cfd-dlc-js-wasm'
import OracleInfo from "./OracleInfo";
import BitcoinDlcProvider from '../BitcoinDlcProvider'

export default class Oracle {
  readonly name: string;
  readonly kValue: string;
  readonly rValue: string;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly client: BitcoinDlcProvider;

  constructor(client: BitcoinDlcProvider, name: string) {
    this.client = client;
    this.name = name;
    let keyPair = this.client.getMethod('CreateKeyPair')({ wif: false });
    this.privateKey = keyPair.privkey;
    this.publicKey = keyPair.pubkey;
    keyPair = this.client.getMethod('CreateKeyPair')({ wif: false });
    this.kValue = keyPair.privkey;
    this.rValue = this.client.getMethod('GetSchnorrPublicNonce')({ kValue: this.kValue }).hex;
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

    return this.client.getMethod('SchnorrSign')(signRequest).hex;
  }
}
