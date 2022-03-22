import { BitcoinNetwork } from '@liquality/bitcoin-networks';

export const chainHashFromNetwork = (network: BitcoinNetwork): Buffer => {
  switch (network.name) {
    case 'bitcoin':
      return Buffer.from(
        '6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000',
        'hex',
      );
    case 'bitcoin_testnet':
      return Buffer.from(
        '43497fd7f826957108f4a30fd9cec3aeba79972084e90ead01ea330900000000',
        'hex',
      );
    case 'bitcoin_regtest':
      return Buffer.from(
        '06226e46111a0b59caaf126043eb5bbf28c34f3a5e332a1fc7b2b73cf188910f',
        'hex',
      );
    default:
      throw Error('Provided network not supported');
  }
};
