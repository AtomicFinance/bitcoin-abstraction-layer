import { Network as BitcoinJsLibNetwork } from 'bitcoinjs-lib';
import { Network } from './@types/@liquality/types';
import * as networks from '@liquality/bitcoin-networks';

export interface BitcoinNetwork extends Network, BitcoinJsLibNetwork {}

const bitcoin: BitcoinNetwork = {
  ...networks.bitcoin,
  chainHash: Buffer.from(
    '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
    'hex',
  ),
};

const bitcoin_testnet: BitcoinNetwork = {
  ...networks.bitcoin_testnet,
  chainHash: Buffer.from(
    '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943',
    'hex',
  ),
};

const bitcoin_regtest: BitcoinNetwork = {
  ...networks.bitcoin_regtest,
  chainHash: Buffer.from(
    '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206',
    'hex',
  ),
};

const BitcoinNetworks = {
  bitcoin,
  bitcoin_testnet,
  bitcoin_regtest,
};

export default BitcoinNetworks;
