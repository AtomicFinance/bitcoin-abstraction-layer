import * as cfdjs from 'cfd-js';

import OracleInfo from '../../../packages/types/lib/models/OracleInfo';
import * as CfdUtils from '../utils/Utils';

export default class Oracle {
  readonly name: string;
  readonly kValues: string[];
  readonly rValues: string[];
  readonly publicKey: string;
  readonly privateKey: string;

  constructor(name: string, significantDigits = 1) {
    this.name = name;

    const kValues = [];
    const rValues = [];
    let keyPair;
    for (let i = 0; i < significantDigits; i++) {
      keyPair = CfdUtils.CreateKeyPair();
      const kValue = keyPair.privkey;
      const rValue = CfdUtils.GetSchnorrPubkeyFromPrivkey(kValue);
      kValues.push(keyPair.privkey);
      rValues.push(rValue);
    }

    keyPair = CfdUtils.CreateKeyPair();
    this.privateKey = keyPair.privkey;
    this.publicKey = CfdUtils.GetSchnorrPubkeyFromPrivkey(this.privateKey);
    this.kValues = kValues;
    this.rValues = rValues;
  }

  // Returns the public information for the Oracle.
  public GetOracleInfo(): OracleInfo {
    return new OracleInfo(this.name, this.rValues, this.publicKey);
  }

  // Sign a given message using the private key and the R value.
  public GetSignature(message: string, significantDigit = 1) {
    const signRequest: cfdjs.SchnorrSignRequest = {
      privkey: this.privateKey,
      message,
      nonceOrAux: this.kValues[significantDigit - 1],
      isNonce: true,
      isHashed: true,
    };

    return cfdjs.SchnorrSign(signRequest).hex;
  }
}
