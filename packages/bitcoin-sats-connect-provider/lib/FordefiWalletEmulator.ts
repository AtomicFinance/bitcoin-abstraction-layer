import { AdaptorSignature, DdkInterface } from '@atomicfinance/types';
import * as ecc from '@bitcoin-js/tiny-secp256k1-asmjs';
import { fromSeed } from 'bip32';
import { mnemonicToSeedSync } from 'bip39';
import { BitcoinNetwork } from 'bitcoin-network';
import { payments, Psbt } from 'bitcoinjs-lib';
import { ECPairFactory, ECPairInterface } from 'ecpair';

import {
  AddressPurpose,
  DlcSignOfferResult,
  EmulatorDlcSignOfferParams,
  SatsConnectResponse,
  SatsConnectWalletAddress,
  WalletInterface,
} from './types';

const ECPair = ECPairFactory(ecc);

interface FordefiWalletEmulatorOptions {
  network: BitcoinNetwork;
  ddk: DdkInterface; // DDK instance for adaptor signature creation
  // Either provide a privateKey directly...
  privateKey?: string; // Hex format (64 chars) or WIF format
  // ...or provide mnemonic + derivation path for HD wallet
  mnemonic?: string;
  baseDerivationPath?: string; // e.g., "m/84'/0'/0'"
}

/**
 * Emulates Fordefi wallet's dlc_signOffer functionality locally using DDK.
 * This allows testing DLC flows without needing an actual Fordefi wallet.
 *
 * The emulator implements:
 * - getAddresses: Returns wallet addresses
 * - dlc_signOffer: Signs funding, refund, and creates CET adaptor signatures using DDK
 * - signPsbt: Standard PSBT signing
 */
export class FordefiWalletEmulator implements WalletInterface {
  private _keyPair: ECPairInterface;
  private _network: BitcoinNetwork;
  private _address: string;
  private _publicKey: Buffer;
  private _ddk: DdkInterface;

  constructor(options: FordefiWalletEmulatorOptions) {
    const { network, privateKey, mnemonic, baseDerivationPath, ddk } = options;
    this._network = network;
    this._ddk = ddk;

    // Initialize key pair from either privateKey or mnemonic
    if (privateKey) {
      // Parse private key (hex or WIF format)
      this._keyPair = this._parsePrivateKey(privateKey, network);
    } else if (mnemonic && baseDerivationPath) {
      // Derive key from mnemonic
      this._keyPair = this._deriveKeyFromMnemonic(
        mnemonic,
        baseDerivationPath,
        network,
      );
    } else {
      throw new Error(
        'Either privateKey or (mnemonic + baseDerivationPath) must be provided',
      );
    }

    this._publicKey = this._keyPair.publicKey;

    // Generate P2WPKH address
    const p2wpkh = payments.p2wpkh({
      pubkey: this._publicKey,
      network: this._network,
    });
    this._address = p2wpkh.address!;
  }

  /**
   * Derives a key pair from a mnemonic at the first receive address (index 0)
   */
  private _deriveKeyFromMnemonic(
    mnemonic: string,
    baseDerivationPath: string,
    network: BitcoinNetwork,
  ): ECPairInterface {
    const seed = mnemonicToSeedSync(mnemonic);
    const root = fromSeed(seed, network);
    // Derive to the first receive address: baseDerivationPath/0/0
    const child = root.derivePath(`${baseDerivationPath}/0/0`);

    if (!child.privateKey) {
      throw new Error('Failed to derive private key from mnemonic');
    }

    return ECPair.fromPrivateKey(child.privateKey, { network });
  }

  private _parsePrivateKey(
    privateKey: string,
    network: BitcoinNetwork,
  ): ECPairInterface {
    // Check if WIF format (starts with 5, K, L, c, or 9 and is ~52 chars)
    if (
      privateKey.length >= 51 &&
      privateKey.length <= 52 &&
      /^[5KLc9]/.test(privateKey)
    ) {
      return ECPair.fromWIF(privateKey, network);
    }

    // Otherwise treat as hex (with or without 0x prefix)
    let hexKey = privateKey;
    if (hexKey.startsWith('0x')) {
      hexKey = hexKey.slice(2);
    }

    if (hexKey.length !== 64) {
      throw new Error(
        'Private key must be 64 hex characters or valid WIF format',
      );
    }

    return ECPair.fromPrivateKey(Buffer.from(hexKey, 'hex'), { network });
  }

  /**
   * Main request handler that routes to appropriate methods
   */
  async request<T>(
    method: string,
    params?: unknown,
  ): Promise<SatsConnectResponse<T>> {
    try {
      switch (method) {
        case 'getAddresses':
          return this._getAddresses() as SatsConnectResponse<T>;

        case 'dlc_signOffer':
          return (await this._dlcSignOffer(
            params as EmulatorDlcSignOfferParams,
          )) as SatsConnectResponse<T>;

        case 'signPsbt':
          return (await this._signPsbt(
            params as { psbt: string; signInputs: Record<string, number[]> },
          )) as SatsConnectResponse<T>;

        case 'wallet_getAccount':
          return {
            status: 'success',
            result: { connected: true } as T,
          };

        default:
          return {
            status: 'error',
            error: {
              code: -1,
              message: `Unknown method: ${method}`,
            },
          };
      }
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: -1,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Returns wallet addresses (Payment and Ordinals both point to same address for simplicity)
   */
  private _getAddresses(): SatsConnectResponse<{
    addresses: SatsConnectWalletAddress[];
  }> {
    const addresses: SatsConnectWalletAddress[] = [
      {
        address: this._address,
        publicKey: this._publicKey.toString('hex'),
        purpose: AddressPurpose.Payment,
        addressType: 'p2wpkh',
      },
      {
        address: this._address,
        publicKey: this._publicKey.toString('hex'),
        purpose: AddressPurpose.Ordinals,
        addressType: 'p2wpkh',
      },
    ];

    return {
      status: 'success',
      result: { addresses },
    };
  }

  /**
   * Signs a PSBT with the wallet's private key
   */
  private async _signPsbt(params: {
    psbt: string;
    signInputs: Record<string, number[]>;
  }): Promise<SatsConnectResponse<{ psbt: string }>> {
    const psbt = Psbt.fromBase64(params.psbt, { network: this._network });

    // Get the input indexes we should sign
    const inputIndexes = params.signInputs[this._address] || [];

    for (const inputIndex of inputIndexes) {
      psbt.signInput(inputIndex, this._keyPair);
    }

    return {
      status: 'success',
      result: { psbt: psbt.toBase64() },
    };
  }

  /**
   * Implements Fordefi's dlc_signOffer method:
   * - Signs funding transaction inputs
   * - Signs refund transaction (multisig input)
   * - Creates adaptor signatures for all CETs using DDK
   *
   * Returns:
   * - fundingTransaction: Base64 signed PSBT
   * - refundTransaction: Base64 signed PSBT
   * - cetTransactions: Array of Base64 adaptor signatures
   */
  private async _dlcSignOffer(
    params: EmulatorDlcSignOfferParams,
  ): Promise<SatsConnectResponse<DlcSignOfferResult>> {
    // Validate required DDK params
    if (
      !params.cets ||
      !params.oracleInfo ||
      !params.fundingScriptPubkey ||
      params.fundOutputValue === undefined ||
      !params.messages
    ) {
      throw new Error(
        'Missing required DDK params (cets, oracleInfo, fundingScriptPubkey, fundOutputValue, messages)',
      );
    }

    // 1. Sign funding transaction
    const fundingPsbt = Psbt.fromBase64(params.fundingTransaction.psbt, {
      network: this._network,
    });
    const fundingInputIndexes =
      params.fundingTransaction.signInputs?.[this._address] || [];

    for (const inputIndex of fundingInputIndexes) {
      fundingPsbt.signInput(inputIndex, this._keyPair);
    }

    // 2. Sign refund transaction
    const refundPsbt = Psbt.fromBase64(params.refundTransaction.psbt, {
      network: this._network,
    });
    const refundInputIndexes = params.refundTransaction.signInputs?.[
      this._address
    ] || [0];

    for (const inputIndex of refundInputIndexes) {
      refundPsbt.signInput(inputIndex, this._keyPair);
    }

    // 3. Create adaptor signatures for CETs using DDK
    const adaptorSigs: AdaptorSignature[] =
      this._ddk.createCetAdaptorSigsFromOracleInfo(
        params.cets,
        params.oracleInfo,
        this._keyPair.privateKey!,
        params.fundingScriptPubkey,
        params.fundOutputValue,
        params.messages,
      );

    // Convert adaptor signatures to base64 format
    // DDK returns { signature: Buffer, proof: Buffer }
    // We concatenate signature + proof and base64 encode
    const cetAdaptorSignatures: string[] = adaptorSigs.map((adaptorSig) => {
      // Store encryptedSig (signature) and dleqProof (proof) separately as JSON
      // This matches how BitcoinSatsConnectProvider expects to receive them
      const combined = Buffer.concat([adaptorSig.signature, adaptorSig.proof]);
      return combined.toString('base64');
    });

    return {
      status: 'success',
      result: {
        fundingTransaction: fundingPsbt.toBase64(),
        refundTransaction: refundPsbt.toBase64(),
        cetTransactions: cetAdaptorSignatures,
      },
    };
  }

  /**
   * Get the wallet's address
   */
  getAddress(): string {
    return this._address;
  }

  /**
   * Get the wallet's public key
   */
  getPublicKey(): Buffer {
    return this._publicKey;
  }
}

export default FordefiWalletEmulator;
