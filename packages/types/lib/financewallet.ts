import Input from './models/Input';

export interface FinanceWalletProvider {
  buildSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[],
  );

  getUnusedAddressesBlacklist();

  setUnusedAddressesBlacklist(unusedAddressesBlacklist);

  getUnusedAddress(change: boolean, numAddressPerCall: number);

  sendSweepTransactionWithSetOutputs(
    externalChangeAddress: string,
    feePerByte: number,
    _outputs: Output[],
    fixedInputs: Input[],
  );
}

interface Output {
  to?: string;
  value: number;
}
