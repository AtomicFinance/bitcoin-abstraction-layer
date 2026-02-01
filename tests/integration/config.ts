import { BitcoinNetworks } from 'bitcoin-network';
import * as dotenv from 'dotenv';
import findConfig from 'find-config';

dotenv.config({ path: findConfig('.env') });

export default {
  bitcoin: {
    rpc: {
      host: 'http://localhost:18443',
      username: process.env.RPC_USER || 'admin1',
      password: process.env.RPC_PASS || '123',
    },
    network: BitcoinNetworks.bitcoin_regtest,
    value: 1000000,
    mineBlocks: true,
  },
  timeout: 240000, // No timeout
};
