export default {
  bitcoin: {
    rpc: {
      host: 'http://localhost:18443',
      username: 'bitcoin',
      password: 'local321'
    },
    api: 'http://localhost:8094/regtest/api',
    network: 'bitcoin_regtest',
    value: 1000000,
    mineBlocks: true,
    kibaConnector: {
      port: 3334
    }
  },
  timeout: 240000 // No timeout
}
