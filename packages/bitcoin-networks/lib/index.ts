import { Network } from '@atomicfinance/types';
import { Network as BitcoinJsLibNetwork, networks } from 'bitcoinjs-lib';

export interface BitcoinNetwork extends Network, BitcoinJsLibNetwork {}

const bitcoin: BitcoinNetwork = {
  name: 'bitcoin',
  ...networks.bitcoin,
  coinType: '0',
  isTestnet: false,
};

const bitcoin_testnet: BitcoinNetwork = {
  name: 'bitcoin_testnet',
  ...networks.testnet,
  coinType: '1',
  isTestnet: true,
};

const bitcoin_regtest: BitcoinNetwork = {
  name: 'bitcoin_regtest',
  ...networks.regtest,
  coinType: '1',
  isTestnet: true,
};

const BitcoinNetworks = {
  bitcoin,
  bitcoin_testnet,
  bitcoin_regtest,
};

export { BitcoinNetworks };

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
