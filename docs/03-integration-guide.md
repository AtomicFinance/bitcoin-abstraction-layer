# Integration Guide for Web Extensions

This guide will help you integrate the Chain, Wallet, and DLC classes into your web extension. These classes provide a set of methods that allow you to interact with the DLC and blockchain.

After you've set up BAL providers in the [02-getting-started.md](./02-getting-started.md) section, in order to allow apps to start using your web extension as a DLC Signer, you'll want to expose the following methods. 

### [Chain.ts](../packages/client/lib/Chain.ts)

The [Chain](../packages/client/lib/Chain.ts) class provides methods for interacting with the blockchain. Here are the methods you should expose:

```ts
- generateBlock(numberOfBlocks: number): Promise<void>
- getBlockByHash(blockHash: string, includeTx = false): Promise<Block>
- getBlockByNumber(blockNumber: number, includeTx = false): Promise<Block>
- getBlockHeight(): Promise<number>
- getTransactionByHash(txHash: string): Promise<Transaction>
- getBalance(addresses: (string | Address)[]): Promise<BigNumber>
- sendTransaction(options: SendOptions): Promise<Transaction>
- sendSweepTransaction(address: Address | string, fee?: number): Promise<Transaction>
- updateTransactionFee(tx: string | Transaction, newFee: number): Promise<Transaction>
- sendBatchTransaction(transactions: SendOptions[]): Promise<Transaction>
- sendRawTransaction(rawTransaction: string): Promise<string>
- getFees(): Promise<FeeDetails>
```

### [Wallet.ts](../packages/client/lib/Wallet.ts)

The [Wallet](../packages/client/lib/Wallet.ts) class provides methods for managing the wallet. Here are the methods you should expose:

```ts
- getAddresses(startingIndex?: number, numAddresses?: number, change?: boolean): Promise<Address[]>
- getUsedAddresses(numAddressPerCall?: number): Promise<Address[]>
- getUnusedAddress(change?: boolean, numAddressPerCall?: number): Promise<Address>
- signMessage(message: string, from: string): Promise<string>
- getConnectedNetwork(): Promise<any>
- isWalletAvailable(): Promise<boolean>
- findAddress(addresses: string[])
- createMultisig(m: number, pubkeys: string[]): CreateMultisigResponse
- buildMultisigPSBT(m: number, pubkeys: string[], inputs: Input[], outputs: Output[]): string
- walletProcessPSBT(psbtString: string): Promise<string>
- finalizePSBT(psbtString: string): Transaction
- buildSweepTransactionWithSetOutputs(externalChangeAddress: string, feePerByte: number, outputs: Output[], fixedInputs: Input[])
- sendSweepTransactionWithSetOutputs(externalChangeAddress: string, feePerByte: number, outputs: Output[], fixedInputs: Input[])
```

### [DLC.ts](../packages/client/lib/Dlc.ts)

The [DLC](../packages/client/lib/Dlc.ts) class provides methods for creating and managing Discreet Log Contracts (DLCs). Here are the methods you should expose:

```ts
- isOfferer(dlcOffer: DlcOffer, dlcAccept: DlcAccept): Promise<boolean>
- createDlcTxs(dlcOffer: DlcOffer, dlcAccept: DlcAccept): Promise<CreateDlcTxsResponse>
- createDlcOffer(contractInfo: ContractInfo, offerCollateralSatoshis: bigint, feeRatePerVb: bigint, cetLocktime: number, refundLocktime: number, fixedInputs?: IInput[]): Promise<DlcOffer>
- acceptDlcOffer(dlcOffer: DlcOffer, fixedInputs?: IInput[]): Promise<AcceptDlcOfferResponse>
- signDlcAccept(dlcOffer: DlcOffer, dlcAccept: DlcAccept): Promise<SignDlcAcceptResponse>
- finalizeDlcSign(dlcOffer: DlcOffer, dlcAccept: DlcAccept, dlcSign: DlcSign, dlcTxs: DlcTransactions): Promise<Tx>
- execute(dlcOffer: DlcOffer, dlcAccept: DlcAccept, dlcSign: DlcSign, dlcTxs: DlcTransactions, oracleAttestation: OracleAttestationV0, isOfferer?: boolean): Promise<Tx>
- refund(dlcOffer: DlcOffer, dlcAccept: DlcAccept, dlcSign: DlcSign, dlcTxs: DlcTransactions): Promise<Tx>
```


To expose these methods, you can create a JavaScript API in your web extension that calls these methods when invoked. This will allow other scripts in your web extension to interact with the DLCs.

Please note that you will need to handle the promises returned by these methods appropriately, as they are asynchronous and may take some time to resolve.