export class BaseError extends Error {
  [key: string]: unknown;

  constructor(
    msg?: string | Record<string, unknown>,
    props?: Record<string, unknown>,
  ) {
    super();

    // Let all properties be enumerable for easier serialization.
    if (msg && typeof msg === 'object') {
      props = msg;
      msg = undefined;
    } else {
      this.message = typeof msg === 'string' ? msg : '';
    }

    // Name has to be an own property (or on the prototype a single step up) for
    // the stack to be printed with the correct name.
    if (props) {
      Object.assign(this, props);
    }

    if (!Object.prototype.hasOwnProperty.call(this, 'name')) {
      this.name = Object.prototype.hasOwnProperty.call(
        Object.getPrototypeOf(this),
        'name',
      )
        ? this.name
        : this.constructor.name;
    }

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Ensure 'name' property is not enumerable
    Object.defineProperty(this, 'name', {
      value: 'StandardError',
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
}

function createError(name: string) {
  const Error = class extends BaseError {};
  Error.prototype.name = name;
  return Error;
}

export const StandardError = createError('StandardError');
export const ProviderNotFoundError = createError('ProviderNotFoundError');
export const InvalidProviderError = createError('InvalidProviderError');
export const DuplicateProviderError = createError('DuplicateProviderError');
export const NoProviderError = createError('NoProviderError');
export const UnsupportedMethodError = createError('UnsupportedMethodError');
export const UnimplementedMethodError = createError('UnimplementedMethodError');
export const InvalidProviderResponseError = createError(
  'InvalidProviderResponseError',
);
export const PendingTxError = createError('PendingTxError');
export const TxNotFoundError = createError('TxNotFoundError');
export const TxFailedError = createError('TxFailedError');
export const BlockNotFoundError = createError('BlockNotFoundError');
export const InvalidDestinationAddressError = createError(
  'InvalidDestinationAddressError',
);
export const WalletError = createError('WalletError');
export const NodeError = createError('NodeError');
export const InvalidSecretError = createError('InvalidSecretError');
export const InvalidAddressError = createError('InvalidAddressError');
export const InvalidExpirationError = createError('InvalidExpirationError');
export const InsufficientBalanceError = createError('InsufficientBalanceError');
