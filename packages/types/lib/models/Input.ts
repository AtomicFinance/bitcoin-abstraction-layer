import * as bT from '../bitcoin';
import Amount from './Amount';
import Utxo from './Utxo';

/**
 * Input supplementation modes for DLC operations
 */
export enum InputSupplementationMode {
  None = 'none', // Use exactly these inputs, no supplementation
  Optional = 'optional', // Try to supplement, fallback if fails
  Required = 'required', // Must supplement or throw error
}

/**
 * Coinselect method (https://github.com/bitcoinjs/coinselect)
 */
export enum CoinSelectMode {
  Coinselect = 'coinselect', // Blackjack, with Accumulative fallback
  Accumulative = 'accumulative', // Accumulative - accumulates inputs until the target value (+fees) is reached, skipping detrimental inputs
  Blackjack = 'blackjack', // Blackjack - accumulates inputs until the target value (+fees) is matched, does not accumulate inputs that go over the target value (within a threshold)
  Break = 'break', // Break - breaks the input values into equal denominations of output (as provided)
  Split = 'split', // Split - splits the input values evenly between all outputs, any provided output with .value remains unchanged
}

/**
 * DLC-specific input information for splice transactions
 */
export interface DlcInputInfo {
  localFundPubkey: string;
  remoteFundPubkey: string;
  contractId: string;
}

/**
 * Class for interfacing with inputs/utxos in Liquality Chainify
 * https://github.com/liquality/chainify
 *
 * These inputs can have different fields for value
 * satoshis (sats): https://github.com/liquality/chainify/blob/dev/packages/bitcoin-esplora-api-provider/lib/BitcoinEsploraApiProvider.js#L65
 * amount (btc): https://github.com/liquality/chainify/blob/dev/packages/bitcoin-esplora-api-provider/lib/BitcoinEsploraApiProvider.js#L74
 * value (sats): https://github.com/liquality/chainify/blob/dev/packages/bitcoin-wallet-provider/lib/BitcoinWalletProvider.js#L331
 *
 * This will be fixed once typescript branch is merged:
 * https://github.com/liquality/chainify/tree/typescript
 * satoshis and amount will not be necessary, only value
 * https://github.com/liquality/chainify/blob/typescript/packages/types/lib/bitcoin.ts#L46
 *
 * Extended to support DLC inputs for splice transactions.
 */
export default class Input {
  constructor(
    readonly txid: string,
    readonly vout: number,
    readonly address: string,
    readonly amount: number, // in BTC
    readonly value: number, // in sats
    readonly derivationPath?: string,
    readonly maxWitnessLength?: number,
    readonly redeemScript?: string,
    readonly inputSerialId?: bigint,
    readonly scriptPubKey?: string,
    readonly label?: string,
    readonly confirmations?: number,
    readonly spendable?: boolean,
    readonly solvable?: boolean,
    readonly safe?: boolean,
    readonly dlcInput?: DlcInputInfo, // DLC-specific information for splice transactions
  ) {}

  toUtxo(): Utxo {
    let amount: Amount;
    if (this.value) {
      amount = Amount.FromSatoshis(this.value);
    } else if (this.amount) {
      amount = Amount.FromBitcoin(this.amount);
    } else {
      amount = Amount.FromSatoshis(0);
    }

    return {
      txid: this.txid,
      vout: this.vout,
      amount,
      address: this.address,
      derivationPath: this.derivationPath,
      maxWitnessLength: this.maxWitnessLength ? this.maxWitnessLength : 108,
      inputSerialId: this.inputSerialId,
      toJSON: Utxo.prototype.toJSON,
      toInput: Utxo.prototype.toInput,
      toTxInputInfo: Utxo.prototype.toTxInputInfo,
    };
  }

  /**
   * Check if this input contains DLC information (for splice transactions)
   */
  isDlcInput(): boolean {
    return !!this.dlcInput;
  }

  static fromUTXO(utxo: bT.UTXO): Input {
    const amount: Amount = Amount.FromSatoshis(utxo.value);

    return new Input(
      utxo.txid,
      utxo.vout,
      utxo.address,
      amount.GetBitcoinAmount(),
      utxo.value,
    );
  }

  /**
   * Create a DLC input for splice transactions
   */
  static createDlcInput(
    txid: string,
    vout: number,
    multisigAddress: string,
    amount: number, // in BTC
    value: number, // in sats
    localFundPubkey: string,
    remoteFundPubkey: string,
    contractId: string,
    inputSerialId?: bigint,
  ): Input {
    return new Input(
      txid,
      vout,
      multisigAddress,
      amount,
      value,
      undefined, // DLC inputs don't have derivation paths
      220, // DLC witness length for 2-of-2 multisig P2WSH
      undefined, // redeemScript
      inputSerialId,
      undefined, // scriptPubKey
      undefined, // label
      undefined, // confirmations
      undefined, // spendable
      undefined, // solvable
      undefined, // safe
      {
        localFundPubkey,
        remoteFundPubkey,
        contractId,
      },
    );
  }
}
