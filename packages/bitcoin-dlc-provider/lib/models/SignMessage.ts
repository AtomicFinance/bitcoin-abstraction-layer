export default class SignMessage {
  constructor(
    readonly contractId: string,
    readonly fundTxSignatures: string[],
    readonly cetSignatures: string[],
    readonly refundSignature: string,
    readonly utxoPublicKeys: string[]
  ) {}
}
