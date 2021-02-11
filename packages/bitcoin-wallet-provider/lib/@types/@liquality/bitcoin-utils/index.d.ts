declare module '@liquality/bitcoin-utils' {
  function decodeRawTransaction(hex: string, network?: any): any;
  function normalizeTransactionObject(tx: any, fee: any, block?: any): any;
  function selectCoins(utxos: any, targets: any, feePerByte: any, fixedInputs?: any): any;
}
