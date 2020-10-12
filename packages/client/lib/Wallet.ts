import Client from './Client'

export default class Dlc {
  client: Client;

  constructor (client?: Client) {
    this.client = client
  }

  async buildSweepTransaction (externalChangeAddress: string, feePerByte: number, outputs: Output[], fixedInputs: Input[]) {
    return this.client.getMethod('buildSweepTransaction')(externalChangeAddress, feePerByte, outputs, fixedInputs)
  }

  async sendSweepTransaction (externalChangeAddress: string, feePerByte: number, outputs: Output[], fixedInputs: Input[]) {
    return this.client.getMethod('sendSweepTransaction')(externalChangeAddress, feePerByte, outputs, fixedInputs)
  }
}

interface Input {
  txid: string,
  vout: number,
  address: string,
  label: string,
  scriptPubKey: string,
  amount: number,
  confirmations: number,
  spendable: boolean,
  solvable: boolean,
  safe: boolean,
  satoshis: number,
  value: number,
  derivationPath: string
}

interface Output {
  to: string,
  value: number
}
