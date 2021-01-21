import { AdaptorPair } from '../cfdDlcJsTypes';

export default class SignMessage {
  constructor(
    readonly contractId: string,
    readonly fundTxSignatures: string[],
    readonly cetAdaptorPairs: AdaptorPair[],
    readonly refundSignature: string,
    readonly utxoPublicKeys: string[]
  ) {}
}
