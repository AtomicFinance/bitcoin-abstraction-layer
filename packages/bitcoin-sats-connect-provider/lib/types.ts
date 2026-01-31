import {
  Address,
  DdkInterface,
  DdkOracleInfo,
  DdkTransaction,
} from '@atomicfinance/types';

// DDK types re-exported for convenience
export type { DdkInterface, DdkOracleInfo, DdkTransaction };

// Additional types we need
export interface Input {
  txid: string;
  vout: number;
  address: string;
  value: number;
  txHex?: string; // Full transaction hex needed for DDK
  derivationPath?: string;
}

// Address purposes (matching sats-connect)
export enum AddressPurpose {
  Payment = 'payment',
  Ordinals = 'ordinals',
}

// Extended Address interface for our provider
export interface SatsConnectAddress extends Address {
  purpose?: AddressPurpose;
}

// SatsConnect response type
export interface SatsConnectResponse<T> {
  status: 'success' | 'error';
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

// DLC Sign result interface
export interface SignDlcResult {
  fundingTransaction: string;
  refundTransaction: string;
  cetTransactions: string[];
}

export interface SatsConnectWalletAddress {
  address: string;
  publicKey: string;
  purpose: AddressPurpose;
  addressType?: string;
  derivationPath?: string;
}

export interface BitcoinSatsConnectProviderOptions {
  esploraUrl?: string;
  network?: import('bitcoin-network').BitcoinNetwork;
  wallet?: WalletInterface;
}

// Wallet interface that both SatsConnect and our emulator implement
export interface WalletInterface {
  request<T>(method: string, params?: unknown): Promise<SatsConnectResponse<T>>;
}

// DLC Sign Offer parameters
export interface DlcSignOfferParams {
  fundingTransaction: {
    psbt: string;
    signInputs?: Record<string, number[]>;
  };
  refundTransaction: {
    psbt: string;
    signInputs?: Record<string, number[]>;
  };
  cetTransactions: Array<{
    psbt: string;
    adaptorPoint: string;
  }>;
  // DDK-specific data for adaptor signature creation
  cets?: DdkTransaction[];
  oracleInfo?: DdkOracleInfo[];
  fundingScriptPubkey?: Buffer;
  fundOutputValue?: bigint;
  messages?: Buffer[][][];
}

// Response from dlc_signOffer
export interface DlcSignOfferResult {
  fundingTransaction: string; // Base64 signed PSBT
  refundTransaction: string; // Base64 signed PSBT
  cetTransactions: string[]; // Base64 adaptor signatures
}
