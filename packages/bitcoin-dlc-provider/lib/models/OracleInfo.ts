export default class OracleInfo {
  constructor(
    readonly name: string,
    readonly rValue: string,
    readonly publicKey: string
  ) {}

  toJSON(): OracleInfoJSON {
    // copy all fields from `this` to an empty object and return in
    return Object.assign({}, this, {
      // convert fields that need converting
      name: this.name,
      rValue: this.rValue,
      publicKey: this.publicKey
    });
  }

  static fromJSON(json: OracleInfoJSON): OracleInfo {
    let oracleInfo = Object.create(OracleInfo.prototype);
    return Object.assign(oracleInfo, json, {
      name: json.name,
      rValue: json.rValue,
      publicKey: json.publicKey
    });
  }

  static reviver(key: string, value: any): any {
    return key === "" ? OracleInfo.fromJSON(value) : value;
  }
}

export interface OracleInfoJSON {
  name: string,
  rValue: string,
  publicKey: string
}
