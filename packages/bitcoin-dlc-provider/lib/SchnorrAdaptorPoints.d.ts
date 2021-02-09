declare module 'schnorr-adaptor-points' {
  export function createAdaptorPoint(pubKeys: Buffer[], messages: Buffer[], rValues: Buffer[]): Buffer;
}
