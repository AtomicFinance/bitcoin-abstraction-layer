import { BitcoinNetworks } from 'bitcoin-networks';

export default {
  bitcoin: {
    rpc: {
      host: 'http://localhost:8332',
      username: '__cookie__',
      password:
        '8499841bd51b8edf1247fc47d016f1aa46f8b7acdc8699a06bb22ad34c396b86',
    },
    network: BitcoinNetworks.bitcoin,
    value: 1000000,
    mineBlocks: true,
  },
  timeout: 240000, // No timeout
};
// __cookie__:fa81babcfb7e897ee9bdd457093114c9eb0bbf0e27697b03d1e33bd22ede7b48
