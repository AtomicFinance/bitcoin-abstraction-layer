import BitcoinNetworks from '../../packages/bitcoin-networks/lib';

export default {
  bitcoin: {
    rpc: {
      host: 'http://localhost:18443',
      username: 'bitcoin',
      password: 'local321',
    },
    network: BitcoinNetworks.bitcoin_regtest,
    value: 1000000,
    mineBlocks: true,
  },
  timeout: 240000, // No timeout
};
