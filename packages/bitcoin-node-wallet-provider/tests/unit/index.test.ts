/* eslint-env mocha */

import BigNumber from 'bignumber.js';
import { BitcoinNetworks } from 'bitcoin-networks';
import chai, { expect } from 'chai';

import bitcoinRpc from '../../../../tests/mock/bitcoin/rpc';
import mockJsonRpc from '../../../../tests/mock/mockJsonRpc';
import { Client } from '../../../client/lib';
import { BitcoinNodeWalletProvider } from '../../lib';

chai.config.truncateThreshold = 0;

describe('Bitcoin RPC provider', () => {
  let client: Client;
  let provider: BitcoinNodeWalletProvider;

  beforeEach(() => {
    client = new Client();
    provider = new BitcoinNodeWalletProvider({
      network: BitcoinNetworks.bitcoin,
      uri: 'http://localhost:8332',
      username: '__cookie__',
      password:
        'fa81babcfb7e897ee9bdd457093114c9eb0bbf0e27697b03d1e33bd22ede7b48',
    });
    client.addProvider(provider);

    mockJsonRpc('http://localhost:8332', bitcoinRpc, 100);
  });

  describe('signMessage', () => {
    it('should return signature', async () => {
      const sig = await provider.signMessage(
        'liquality',
        'mfZfUQ4RWLhJdFZr9m2oDXsbcZfuNfYDYi',
      );
      expect(sig).to.equal(
        '205bfd8bb8ccc907e3c5e832eccef1df619d52ea8785045ee9cb7b069e8785e7185d8a8d395666f1c441a7423325c1e4abfd4b9f33e851c60f99f8deb0165e3ef3',
      );
    });
  });

  describe('sendTransaction', () => {
    it('should return transaction', async () => {
      const tx = await provider.sendTransaction({
        to: '2MxxsHz5Y9KM847ttEoZNcmmaKSCQDa5Z23',
        value: new BigNumber(1000),
      });
      expect(tx.hash).to.equal(
        '8d2ef62766cb1c15744228335483d37a7addc2a2f88d47413527e55e212ef8cd',
      );
    });
  });
});
