import { Address } from '@liquality/types';
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

  quickFindAddress(addresses: string[]);
}

interface Output {
  to?: string;
  value: number;
}
