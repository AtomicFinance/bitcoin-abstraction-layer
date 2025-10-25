/* eslint-env mocha */
import * as ddkJs from '@bennyblader/ddk-ts';
import { BitcoinNetwork, BitcoinNetworks } from 'bitcoin-network';
import { expect } from 'chai';

import BitcoinDdkProvider from '../../../packages/bitcoin-ddk-provider/lib';
import { DdkNetworkString } from '../../../packages/types';

describe('DDK Provider Network Handling', () => {
  describe('constructor network parameter', () => {
    it('should accept BitcoinNetwork object for regtest', () => {
      const provider = new BitcoinDdkProvider(
        BitcoinNetworks.bitcoin_regtest,
        ddkJs,
      );
      expect(provider).to.be.instanceOf(BitcoinDdkProvider);
    });

    it('should accept BitcoinNetwork object for testnet', () => {
      const provider = new BitcoinDdkProvider(
        BitcoinNetworks.bitcoin_testnet,
        ddkJs,
      );
      expect(provider).to.be.instanceOf(BitcoinDdkProvider);
    });

    it('should accept BitcoinNetwork object for mainnet', () => {
      const provider = new BitcoinDdkProvider(BitcoinNetworks.bitcoin, ddkJs);
      expect(provider).to.be.instanceOf(BitcoinDdkProvider);
    });

    it('should accept DdkNetworkString for regtest', () => {
      const provider = new BitcoinDdkProvider(
        'regtest' as DdkNetworkString,
        ddkJs,
      );
      expect(provider).to.be.instanceOf(BitcoinDdkProvider);
    });

    it('should accept DdkNetworkString for testnet', () => {
      const provider = new BitcoinDdkProvider(
        'testnet' as DdkNetworkString,
        ddkJs,
      );
      expect(provider).to.be.instanceOf(BitcoinDdkProvider);
    });

    it('should accept DdkNetworkString for mainnet', () => {
      const provider = new BitcoinDdkProvider(
        'bitcoin' as DdkNetworkString,
        ddkJs,
      );
      expect(provider).to.be.instanceOf(BitcoinDdkProvider);
    });

    it('should throw error for invalid network string', () => {
      expect(() => {
        new BitcoinDdkProvider('invalid' as DdkNetworkString, ddkJs);
      }).to.throw('Invalid network string: invalid');
    });

    it('should throw error for unsupported BitcoinNetwork', () => {
      const invalidNetwork = {
        name: 'invalid_network',
      } as unknown as BitcoinNetwork;
      expect(() => {
        new BitcoinDdkProvider(invalidNetwork, ddkJs);
      }).to.throw('Unsupported network: invalid_network');
    });
  });

  describe('GetCfdNetwork method', () => {
    it('should return correct network string for regtest BitcoinNetwork', async () => {
      const provider = new BitcoinDdkProvider(
        BitcoinNetworks.bitcoin_regtest,
        ddkJs,
      );
      const networkString = await provider.GetCfdNetwork();
      expect(networkString).to.equal('regtest');
    });

    it('should return correct network string for testnet BitcoinNetwork', async () => {
      const provider = new BitcoinDdkProvider(
        BitcoinNetworks.bitcoin_testnet,
        ddkJs,
      );
      const networkString = await provider.GetCfdNetwork();
      expect(networkString).to.equal('testnet');
    });

    it('should return correct network string for mainnet BitcoinNetwork', async () => {
      const provider = new BitcoinDdkProvider(BitcoinNetworks.bitcoin, ddkJs);
      const networkString = await provider.GetCfdNetwork();
      expect(networkString).to.equal('bitcoin');
    });

    it('should return correct network string for regtest DdkNetworkString', async () => {
      const provider = new BitcoinDdkProvider(
        'regtest' as DdkNetworkString,
        ddkJs,
      );
      const networkString = await provider.GetCfdNetwork();
      expect(networkString).to.equal('regtest');
    });

    it('should return correct network string for testnet DdkNetworkString', async () => {
      const provider = new BitcoinDdkProvider(
        'testnet' as DdkNetworkString,
        ddkJs,
      );
      const networkString = await provider.GetCfdNetwork();
      expect(networkString).to.equal('testnet');
    });

    it('should return correct network string for mainnet DdkNetworkString', async () => {
      const provider = new BitcoinDdkProvider(
        'bitcoin' as DdkNetworkString,
        ddkJs,
      );
      const networkString = await provider.GetCfdNetwork();
      expect(networkString).to.equal('bitcoin');
    });
  });

  describe('network conversion utilities', () => {
    it('should handle network conversion consistently', async () => {
      // Test that both string and object inputs produce the same result
      const providerFromObject = new BitcoinDdkProvider(
        BitcoinNetworks.bitcoin_regtest,
        ddkJs,
      );
      const providerFromString = new BitcoinDdkProvider(
        'regtest' as DdkNetworkString,
        ddkJs,
      );

      const networkFromObject = await providerFromObject.GetCfdNetwork();
      const networkFromString = await providerFromString.GetCfdNetwork();

      expect(networkFromObject).to.equal(networkFromString);
      expect(networkFromObject).to.equal('regtest');
    });

    it('should handle all network types consistently', async () => {
      const testCases = [
        {
          object: BitcoinNetworks.bitcoin,
          string: 'bitcoin',
          expected: 'bitcoin',
        },
        {
          object: BitcoinNetworks.bitcoin_testnet,
          string: 'testnet',
          expected: 'testnet',
        },
        {
          object: BitcoinNetworks.bitcoin_regtest,
          string: 'regtest',
          expected: 'regtest',
        },
      ];

      for (const testCase of testCases) {
        const providerFromObject = new BitcoinDdkProvider(
          testCase.object,
          ddkJs,
        );
        const providerFromString = new BitcoinDdkProvider(
          testCase.string as DdkNetworkString,
          ddkJs,
        );

        const networkFromObject = await providerFromObject.GetCfdNetwork();
        const networkFromString = await providerFromString.GetCfdNetwork();

        expect(networkFromObject).to.equal(testCase.expected);
        expect(networkFromString).to.equal(testCase.expected);
        expect(networkFromObject).to.equal(networkFromString);
      }
    });
  });
});
