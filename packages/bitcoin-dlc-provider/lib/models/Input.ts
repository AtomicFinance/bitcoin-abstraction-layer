export default class Input {
  constructor(
    readonly txid: string,
    readonly vout: number,
    readonly address: string,
    readonly label: string,
    readonly scriptPubKey: string,
    readonly amount: number, // in BTC
    readonly satoshis: number, // in sats
    readonly value: number, // in BTC
    readonly derivationPath?: string,
    readonly confirmations?: number,
    readonly spendable?: boolean,
    readonly solvable?: boolean,
    readonly safe?: boolean,
  ) {}
}
