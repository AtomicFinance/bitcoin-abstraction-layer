import { OracleInfo } from '../../../../packages/bitcoin-dlc-provider/lib'

import { SchnorrSignRequest } from "cfd-dlc-js-wasm";

import { CreateKeyPairRequest, CreateKeyPairResponse } from 'cfd-js-wasm'

export default class Oracle {
  readonly name: string;
  readonly client: any;
  kValue: string;
  rValue: string;
  publicKey: string;
  privateKey: string;

  constructor(client: any, name: string) {
    this.client = client;
    this.name = name;
  }

  public static async build(client: any, name: string): Promise<Oracle> {
    const oracle = new Oracle(client, name)
    console.log('test4')
    
    const keyPairRequest: CreateKeyPairRequest = { wif: false }
    let keyPair: CreateKeyPairResponse = await oracle.client.finance.getMethod('CreateKeyPair')(keyPairRequest);
    console.log('keyPair', keyPair)
    // oracle.privateKey = keyPair.privkey;
    // oracle.publicKey = keyPair.pubkey;
    // keyPair = await oracle.client.finance.getMethod('CreateKeyPair')({ wif: false});
    // oracle.kValue = keyPair.privkey;
    // console.log('kvalue', oracle.kValue)
    // oracle.rValue = await oracle.client.finance.getMethod('GetSchnorrPublicNonce')({ kValue: oracle.kValue }).hex;
    // console.log('rValue', oracle.rValue)

    return oracle
  }

  // Returns the public information for the Oracle.
  public GetOracleInfo() {
    return new OracleInfo(this.name, this.rValue, this.publicKey);
  }

  // Sign a given message using the private key and the R value.
  public async GetSignature(message: string) {
    const signRequest: SchnorrSignRequest = {
      privkey: this.privateKey,
      kValue: this.kValue,
      message,
    };

    return (await this.client.finance.getMethod('SchnorrSign')(signRequest)).hex;
  }
}
