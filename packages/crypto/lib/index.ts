import bech32 from 'bech32';
import base58 from 'bs58';
import cryptoHash from 'crypto-hashing';

const isHex = (hex: string): boolean => {
  if (!hex.match(/([0-9]|[a-f])/gim)) return false;

  const buf = Buffer.from(hex, 'hex').toString('hex');

  return buf === hex.toLowerCase();
};

/**
 * Ensure message is in buffer format.
 * @param {string} message - any string.
 * @return {string} Returns Buffer.
 */
const ensureBuffer = (message: string | Buffer | any): Buffer | boolean => {
  if (Buffer.isBuffer(message)) return message;

  switch (typeof message) {
    case 'string':
      message = isHex(message)
        ? Buffer.from(message, 'hex')
        : Buffer.from(message);
      break;
    case 'object':
      message = Buffer.from(JSON.stringify(message));
      break;
  }

  return Buffer.isBuffer(message) ? message : false;
};

/**
 * Get hash of a message in hex.
 * @param {!string} algorithm - Hashing algorithm.
 * @param {!string|Buffer} message - Message to be hashed.
 * @return {string} Returns the hash of a string.
 */
const hashToHex = (algorithm: string, message: string | Buffer): string => {
  return cryptoHash(algorithm, ensureBuffer(message)).toString('hex');
};

/**
 * Get hash160 of message.
 * @param {!string|Buffer} message - message in string or Buffer.
 * @return {string} Returns the hash160 of a string.
 */
const hash160 = (message: Buffer): string => {
  return hashToHex('hash160', message);
};

/**
 * Get sha256 of message.
 * @param {!string|Buffer} message - message in string or Buffer.
 * @return {string} Returns the sha256 of a string.
 */
const sha256 = (message: string | Buffer): string => {
  return hashToHex('sha256', message);
};

/**
 * Get ripemd160 of message.
 * @param {!string|Buffer} message - message in string or Buffer.
 * @return {string} Returns the ripemd160 of a string.
 */
const ripemd160 = (message: string | Buffer): string => {
  return hashToHex('ripemd160', message);
};

/**
 * Pad a hex string with '0'
 * @param {string} hex - The hex string to pad.
 * @param {number} lengthBytes - The length of the final string in bytes
 * @return {string} Returns a padded string with length greater or equal to the given length
 *  rounded up to the nearest even number.
 */
const padHexStart = (hex: string, lengthBytes?: number): string => {
  let lengthString = lengthBytes * 2 || hex.length;
  lengthString += lengthString % 2;

  return hex.padStart(lengthString, '0');
};

export {
  /**
   * Base58 object with decode, decodeUnsafe, and encode functions.
   */
  base58,
  /**
   * Get bech32 of message.
   * @param {!string} message - any string.
   * @return {string} Returns the bech32 of a string.
   */
  bech32,
  sha256,
  ripemd160,
  hash160,
  ensureBuffer,
  padHexStart,
  isHex,
};
