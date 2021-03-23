export default class Input {
  constructor(
    readonly txid: string,
    readonly vout: number,
    readonly address: string,
    readonly label: string,
    readonly scriptPubKey: string,
    readonly amount: number,
    // readonly confirmations: number,
    // readonly spendable: boolean,
    // readonly solvable: boolean,
    // readonly safe: boolean,
    readonly satoshis: number,
    readonly value: number,
    readonly derivationPath: string,
  ) {}
}
