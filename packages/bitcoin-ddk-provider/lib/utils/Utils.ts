import { Messages, PayoutRequest } from '@atomicfinance/types';
import {
  DlcAccept,
  DlcClose,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  FundingInput,
  MessageType,
} from '@node-dlc/messaging';
import { BitcoinNetwork } from 'bitcoin-network';
import { payments } from 'bitcoinjs-lib';
import { Payment } from 'bitcoinjs-lib';
import randomBytes from 'randombytes';

export const asyncForEach = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: any,
): Promise<void> => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

export function generateSerialId(): bigint {
  return randomBytes(4).reduce((acc, num, i) => acc + num ** i, 0);
}

export function generateSerialIds(count: number): bigint[] {
  return Array.from({ length: count }, () => generateSerialId());
}

export function checkTypes(types: ICheckTypesRequest): ICheckTypesResponse {
  const { _dlcOffer, _dlcAccept, _dlcSign, _dlcClose, _dlcTxs } = types;
  if (_dlcOffer && _dlcOffer.type !== MessageType.DlcOffer)
    throw Error('DlcOffer must be V0');
  if (_dlcAccept && _dlcAccept.type !== MessageType.DlcAccept)
    throw Error('DlcAccept must be V0');
  if (_dlcSign && _dlcSign.type !== MessageType.DlcSign)
    throw Error('DlcSign must be V0');
  if (_dlcClose && _dlcClose.type !== MessageType.DlcClose)
    throw Error('DlcClose must be V0');
  if (_dlcTxs && _dlcTxs.type !== MessageType.DlcTransactionsV0)
    throw Error('DlcTransactions must be V0');

  let dlcOffer: DlcOffer;
  let dlcAccept: DlcAccept;
  let dlcSign: DlcSign;
  let dlcClose: DlcClose;
  let dlcTxs: DlcTransactions;

  if (_dlcOffer) dlcOffer = _dlcOffer as DlcOffer;
  if (_dlcAccept) dlcAccept = _dlcAccept as DlcAccept;
  if (_dlcSign) dlcSign = _dlcSign as DlcSign;
  if (_dlcClose) dlcClose = _dlcClose as DlcClose;
  if (_dlcTxs) dlcTxs = _dlcTxs as DlcTransactions;

  return { dlcOffer, dlcAccept, dlcSign, dlcClose, dlcTxs };
}

export function outputsToPayouts(
  outputs: PayoutGroup[],
  rValuesMessagesList: Messages[],
  localCollateral: bigint,
  remoteCollateral: bigint,
  payoutLocal: boolean,
): OutputsToPayoutsResponse {
  const payouts: PayoutRequest[] = [];
  const messagesList: Messages[] = [];

  outputs.forEach((output: PayoutGroup) => {
    const { payout, groups } = output;
    const payoutAmount: bigint = payout;

    groups.forEach((group: number[]) => {
      const messages = [];
      for (let i = 0; i < group.length; i++) {
        const digit: number = group[i];
        messages.push(rValuesMessagesList[i].messages[digit]);
      }

      const local = payoutLocal
        ? payoutAmount
        : localCollateral + remoteCollateral - payoutAmount;
      const remote = payoutLocal
        ? localCollateral + remoteCollateral - payoutAmount
        : payoutAmount;
      payouts.push({ local, remote });
      messagesList.push({ messages });
    });
  });

  return { payouts, messagesList };
}

export interface ICheckTypesRequest {
  _dlcOffer?: DlcOffer;
  _dlcAccept?: DlcAccept;
  _dlcSign?: DlcSign;
  _dlcClose?: DlcClose;
  _dlcTxs?: DlcTransactions;
}

export interface ICheckTypesResponse {
  dlcOffer?: DlcOffer;
  dlcAccept?: DlcAccept;
  dlcSign?: DlcSign;
  dlcClose?: DlcClose;
  dlcTxs?: DlcTransactions;
}

interface PayoutGroup {
  payout: bigint;
  groups: number[][];
}

interface OutputsToPayoutsResponse {
  payouts: PayoutRequest[];
  messagesList: Messages[];
}

/**
 * Orders public keys lexicographically for consistent multisig script creation.
 * This ensures deterministic ordering regardless of which party creates the script.
 *
 * @param pubkey1 First public key buffer
 * @param pubkey2 Second public key buffer
 * @returns Array of public keys in lexicographic order [smaller, larger]
 */
export function orderPubkeysLexicographically(
  pubkey1: Buffer,
  pubkey2: Buffer,
): [Buffer, Buffer] {
  return Buffer.compare(pubkey1, pubkey2) === -1
    ? [pubkey1, pubkey2]
    : [pubkey2, pubkey1];
}

/**
 * Creates a 2-of-2 P2WSH multisig payment variant with lexicographically ordered pubkeys.
 * This is the standard pattern used for DLC funding scripts.
 *
 * @param pubkey1 First public key buffer
 * @param pubkey2 Second public key buffer
 * @param network Bitcoin network
 * @returns Payment variant with P2WSH multisig script
 */
export function createP2WSHMultisig(
  pubkey1: Buffer,
  pubkey2: Buffer,
  network: BitcoinNetwork,
): Payment {
  const orderedPubkeys = orderPubkeysLexicographically(pubkey1, pubkey2);

  const p2ms = payments.p2ms({
    m: 2,
    pubkeys: orderedPubkeys,
    network,
  });

  return payments.p2wsh({
    redeem: p2ms,
    network,
  });
}

export function createP2MSMultisig(
  pubkey1: Buffer,
  pubkey2: Buffer,
  network: BitcoinNetwork,
): Payment {
  const orderedPubkeys = orderPubkeysLexicographically(pubkey1, pubkey2);

  return payments.p2ms({
    m: 2,
    pubkeys: orderedPubkeys,
    network,
  });
}

/**
 * Creates a 2-of-2 P2WSH multisig payment variant from pre-ordered pubkeys.
 * Use this when you already have the pubkeys in the correct order.
 *
 * @param orderedPubkeys Array of public key buffers in the desired order
 * @param network Bitcoin network
 * @returns Payment variant with P2WSH multisig script
 */
export function createP2WSHMultisigFromOrdered(
  orderedPubkeys: Buffer[],
  network: BitcoinNetwork,
): Payment {
  const p2ms = payments.p2ms({
    m: 2,
    pubkeys: orderedPubkeys,
    network,
  });

  return payments.p2wsh({
    redeem: p2ms,
    network,
  });
}

/**
 * Creates a 2-of-2 multisig script (P2MS) from lexicographically ordered pubkeys.
 * Returns just the multisig script, not wrapped in P2WSH.
 *
 * @param pubkey1 First public key buffer
 * @param pubkey2 Second public key buffer
 * @param network Bitcoin network
 * @returns Multisig payment script
 */
export function createMultisigScript(
  pubkey1: Buffer,
  pubkey2: Buffer,
  network: BitcoinNetwork,
): Payment {
  const orderedPubkeys = orderPubkeysLexicographically(pubkey1, pubkey2);

  return payments.p2ms({
    m: 2,
    pubkeys: orderedPubkeys,
    network,
  });
}

/**
 * Helper function to ensure we have a Buffer object
 * Handles cases where Buffer objects have been serialized/deserialized
 */
export function ensureBuffer(
  bufferLike: Buffer | { type: string; data: number[] } | any,
): Buffer {
  if (Buffer.isBuffer(bufferLike)) {
    return bufferLike;
  }
  if (bufferLike && bufferLike.type === 'Buffer' && bufferLike.data) {
    return Buffer.from(bufferLike.data);
  }
  return bufferLike;
}

/**
 * Detect if signature is in compact format (64 bytes) or DER format
 * and convert compact to DER if needed, adding SIGHASH_ALL flag
 */
export function ensureDerSignature(signature: Buffer): Buffer {
  // If signature is 64 bytes, it's likely compact format (32-byte r + 32-byte s)
  if (signature.length === 64) {
    // Convert compact signature to DER format
    const r = signature.subarray(0, 32);
    const s = signature.subarray(32, 64);

    // Create DER encoding manually
    // DER format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S]

    // Remove leading zeros from r and s, but keep at least one byte
    let rBytes = r;
    while (
      rBytes.length > 1 &&
      rBytes[0] === 0x00 &&
      (rBytes[1] & 0x80) === 0
    ) {
      rBytes = rBytes.subarray(1);
    }

    let sBytes = s;
    while (
      sBytes.length > 1 &&
      sBytes[0] === 0x00 &&
      (sBytes[1] & 0x80) === 0
    ) {
      sBytes = sBytes.subarray(1);
    }

    // Add padding byte if high bit is set (to keep numbers positive)
    if ((rBytes[0] & 0x80) !== 0) {
      rBytes = Buffer.concat([Buffer.from([0x00]), rBytes]);
    }
    if ((sBytes[0] & 0x80) !== 0) {
      sBytes = Buffer.concat([Buffer.from([0x00]), sBytes]);
    }

    const totalLength = 2 + rBytes.length + 2 + sBytes.length;

    const derSignature = Buffer.concat([
      Buffer.from([0x30, totalLength]), // SEQUENCE tag and total length
      Buffer.from([0x02, rBytes.length]), // INTEGER tag and R length
      rBytes,
      Buffer.from([0x02, sBytes.length]), // INTEGER tag and S length
      sBytes,
      Buffer.from([0x01]), // SIGHASH_ALL flag
    ]);

    return derSignature;
  }

  // If it's already DER format, check if it has SIGHASH flag
  if (signature.length > 0 && signature[0] === 0x30) {
    // Check if it already has a SIGHASH flag (last byte should be 0x01 for SIGHASH_ALL)
    if (signature[signature.length - 1] !== 0x01) {
      // Add SIGHASH_ALL flag
      return Buffer.concat([signature, Buffer.from([0x01])]);
    }
    return signature;
  }

  // For other formats, return as-is
  return signature;
}

/**
 * Detect if signature is in DER format and convert to compact format (64 bytes)
 * by extracting r and s values, removing SIGHASH flag if present
 */
export function ensureCompactSignature(signature: Buffer): Buffer {
  // If signature is already 64 bytes, it's likely already compact format
  if (signature.length === 64) {
    return signature;
  }

  // Check if it's DER format (starts with 0x30)
  if (signature.length > 6 && signature[0] === 0x30) {
    let derSig = signature;

    // Remove SIGHASH flag if present (last byte is typically 0x01 for SIGHASH_ALL)
    if (signature[signature.length - 1] === 0x01) {
      derSig = signature.subarray(0, -1);
    }

    // Parse DER format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S]
    if (derSig[0] !== 0x30) {
      throw new Error('Invalid DER signature: missing SEQUENCE tag');
    }

    const totalLength = derSig[1];
    if (derSig.length < totalLength + 2) {
      throw new Error('Invalid DER signature: length mismatch');
    }

    let offset = 2;

    // Parse R value
    if (derSig[offset] !== 0x02) {
      throw new Error('Invalid DER signature: missing INTEGER tag for R');
    }
    offset++;

    const rLength = derSig[offset];
    offset++;

    if (offset + rLength > derSig.length) {
      throw new Error(
        'Invalid DER signature: R length exceeds signature length',
      );
    }

    let rBytes = derSig.subarray(offset, offset + rLength);
    offset += rLength;

    // Parse S value
    if (derSig[offset] !== 0x02) {
      throw new Error('Invalid DER signature: missing INTEGER tag for S');
    }
    offset++;

    const sLength = derSig[offset];
    offset++;

    if (offset + sLength > derSig.length) {
      throw new Error(
        'Invalid DER signature: S length exceeds signature length',
      );
    }

    let sBytes = derSig.subarray(offset, offset + sLength);

    // Remove leading zero padding from r and s (DER may pad to prevent negative interpretation)
    while (rBytes.length > 1 && rBytes[0] === 0x00) {
      rBytes = rBytes.subarray(1);
    }
    while (sBytes.length > 1 && sBytes[0] === 0x00) {
      sBytes = sBytes.subarray(1);
    }

    // Pad to 32 bytes each (compact format requires exactly 32 bytes for r and s)
    while (rBytes.length < 32) {
      rBytes = Buffer.concat([Buffer.from([0x00]), rBytes]);
    }
    while (sBytes.length < 32) {
      sBytes = Buffer.concat([Buffer.from([0x00]), sBytes]);
    }

    if (rBytes.length !== 32 || sBytes.length !== 32) {
      throw new Error('Invalid signature values: r or s exceeds 32 bytes');
    }

    // Combine r and s into 64-byte compact format
    return Buffer.concat([rBytes, sBytes]);
  }

  // For other formats, throw error as we can't convert
  throw new Error(
    'Unable to convert signature to compact format: unknown format',
  );
}

/**
 * Compute contract ID from fund transaction ID, output index, and temporary contract ID
 * Matches the Rust implementation in rust-dlc
 */
export function computeContractId(
  fundTxId: Buffer,
  fundOutputIndex: number,
  temporaryContractId: Buffer,
): Buffer {
  if (fundTxId.length !== 32) {
    throw new Error('Fund transaction ID must be 32 bytes');
  }
  if (temporaryContractId.length !== 32) {
    throw new Error('Temporary contract ID must be 32 bytes');
  }
  if (fundOutputIndex > 0xffff) {
    throw new Error('Fund output index must fit in 16 bits');
  }

  const result = Buffer.alloc(32);

  // XOR fund_tx_id with temporary_id, with byte order reversal for fund_tx_id
  for (let i = 0; i < 32; i++) {
    result[i] = fundTxId[31 - i] ^ temporaryContractId[i];
  }

  // XOR the fund output index into the last two bytes
  result[30] ^= (fundOutputIndex >> 8) & 0xff; // High byte
  result[31] ^= fundOutputIndex & 0xff; // Low byte

  return result;
}

export function sortFundingInputsBySerialId(
  inputs: FundingInput[],
): FundingInput[] {
  return inputs.sort(
    (a, b) => Number(a.inputSerialId) - Number(b.inputSerialId),
  );
}
