/** */
export interface InnerErrorResponse {
  code: number;
  type: string;
  message: string;
}

/** */
export interface ErrorResponse {
  error: InnerErrorResponse;
}

/** */
export interface TxInRequest {
  txid: string;
  vout: number;
  sequence?: number;
}

/** */
export interface TxOutRequest {
  address: string;
  amount: bigint | number;
  directLockingScript?: string;
}
