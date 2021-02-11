declare module 'bip-schnorr' {
  export module math {
    export function taggedHash(tag: string, msg: Buffer | string): Buffer;
  }
}
