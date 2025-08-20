/* eslint-env mocha */
import * as ddkJs from '@bennyblader/ddk-ts';
import { generateMnemonic } from 'bip39';
import * as cfdJs from 'cfd-js';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import BitcoinCfdAddressDerivationProvider from '../../../packages/bitcoin-cfd-address-derivation-provider/lib';
import BitcoinCfdProvider from '../../../packages/bitcoin-cfd-provider/lib';
import BitcoinDdkAddressDerivationProvider from '../../../packages/bitcoin-ddk-address-derivation-provider/lib';
import { BitcoinJsWalletProvider } from '../../../packages/bitcoin-js-wallet-provider/dist';
import { BitcoinRpcProvider } from '../../../packages/bitcoin-rpc-provider/dist';
import { Client } from '../../../packages/client/dist';
import Provider from '../../../packages/provider/lib';
import { bitcoin } from '../../../packages/types/dist';
import config from '../config';

const { expect } = chai;
chai.use(chaiAsPromised);

const { network, rpc } = config.bitcoin;

function mockedBitcoinRpcProvider(): BitcoinRpcProvider {
  const bitcoinRpcProvider = new BitcoinRpcProvider({
    uri: rpc.host,
    username: rpc.username,
    password: rpc.password,
    network,
  });
  // Mock Fee Per Byte to prevent from changing
  bitcoinRpcProvider.getFeePerByte = async () => 3;
  return bitcoinRpcProvider;
}

describe('Address Derivation Provider Comparison', () => {
  let cfdClient: Client;
  let ddkClient: Client;
  let testMnemonic: string;
  let baseDerivationPath: string;

  before(async () => {
    // Use a fixed mnemonic for consistent testing
    testMnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    baseDerivationPath = `m/84'/${network.coinType}'/0'`;
  });

  beforeEach(async () => {
    // Initialize both clients with the same configuration
    const providerOptions = {
      network,
      mnemonic: testMnemonic,
      addressType: bitcoin.AddressType.BECH32,
      baseDerivationPath,
    };

    // Set up CFD client
    cfdClient = new Client();
    cfdClient.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);
    cfdClient.addProvider(new BitcoinJsWalletProvider(providerOptions) as any);
    cfdClient.addProvider(new BitcoinCfdProvider(cfdJs));
    cfdClient.addProvider(
      new BitcoinCfdAddressDerivationProvider(providerOptions, cfdJs),
    );

    // Set up DDK client
    ddkClient = new Client();
    ddkClient.addProvider(mockedBitcoinRpcProvider() as unknown as Provider);

    const bitcoinJsWalletProviderDdk = new BitcoinJsWalletProvider(
      providerOptions,
    ) as any;
    const ddkAddressDerivationProvider =
      new BitcoinDdkAddressDerivationProvider(providerOptions, ddkJs);

    // Override getDerivationPathAddress like in lygos-app
    bitcoinJsWalletProviderDdk.getDerivationPathAddress =
      ddkAddressDerivationProvider.getDerivationPathAddress.bind(
        ddkAddressDerivationProvider,
      );

    ddkClient.addProvider(bitcoinJsWalletProviderDdk);
    ddkClient.addProvider(ddkAddressDerivationProvider);
  });

  describe('Single Address Generation', () => {
    it('should generate identical addresses for the same derivation path', async () => {
      const derivationPath = `${baseDerivationPath}/0/0`;

      const cfdAddress = await cfdClient.getMethod('getDerivationPathAddress')(
        derivationPath,
      );
      const ddkAddress = await ddkClient.getMethod('getDerivationPathAddress')(
        derivationPath,
      );

      expect(cfdAddress.address).to.equal(ddkAddress.address);
      expect(cfdAddress.publicKey).to.equal(ddkAddress.publicKey);
      expect(cfdAddress.derivationPath).to.equal(ddkAddress.derivationPath);
    });

    it('should generate identical addresses for different derivation indices', async () => {
      const testCases = [
        `${baseDerivationPath}/0/0`,
        `${baseDerivationPath}/0/1`,
        `${baseDerivationPath}/0/5`,
        `${baseDerivationPath}/0/10`,
        `${baseDerivationPath}/1/0`,
        `${baseDerivationPath}/1/1`,
      ];

      for (const derivationPath of testCases) {
        const cfdAddress = await cfdClient.getMethod(
          'getDerivationPathAddress',
        )(derivationPath);
        const ddkAddress = await ddkClient.getMethod(
          'getDerivationPathAddress',
        )(derivationPath);

        expect(cfdAddress.address).to.equal(
          ddkAddress.address,
          `Addresses differ for path: ${derivationPath}`,
        );
        expect(cfdAddress.publicKey).to.equal(
          ddkAddress.publicKey,
          `Public keys differ for path: ${derivationPath}`,
        );
        expect(cfdAddress.derivationPath).to.equal(
          ddkAddress.derivationPath,
          `Derivation paths differ for path: ${derivationPath}`,
        );
      }
    });
  });

  describe('Multiple Address Generation', () => {
    it('should generate identical addresses for multiple derivation paths', async () => {
      const testPaths = [
        `${baseDerivationPath}/0/0`,
        `${baseDerivationPath}/0/1`,
        `${baseDerivationPath}/0/5`,
        `${baseDerivationPath}/1/0`,
        `${baseDerivationPath}/1/1`,
      ];

      for (const derivationPath of testPaths) {
        const cfdAddress = await cfdClient.getMethod(
          'getDerivationPathAddress',
        )(derivationPath);
        const ddkAddress = await ddkClient.getMethod(
          'getDerivationPathAddress',
        )(derivationPath);

        expect(cfdAddress.address).to.equal(
          ddkAddress.address,
          `Addresses differ for path: ${derivationPath}`,
        );
        expect(cfdAddress.publicKey).to.equal(
          ddkAddress.publicKey,
          `Public keys differ for path: ${derivationPath}`,
        );
        expect(cfdAddress.derivationPath).to.equal(
          ddkAddress.derivationPath,
          `Derivation paths differ for path: ${derivationPath}`,
        );
      }
    });
  });

  describe('Caching Behavior', () => {
    it('should produce identical cached results', async () => {
      const derivationPath = `${baseDerivationPath}/0/0`;

      // Generate addresses first time (should cache)
      const cfdAddress1 = await cfdClient.getMethod('getDerivationPathAddress')(
        derivationPath,
      );
      const ddkAddress1 = await ddkClient.getMethod('getDerivationPathAddress')(
        derivationPath,
      );

      // Generate addresses second time (should use cache)
      const cfdAddress2 = await cfdClient.getMethod('getDerivationPathAddress')(
        derivationPath,
      );
      const ddkAddress2 = await ddkClient.getMethod('getDerivationPathAddress')(
        derivationPath,
      );

      // First generation should match
      expect(cfdAddress1.address).to.equal(ddkAddress1.address);
      expect(cfdAddress1.publicKey).to.equal(ddkAddress1.publicKey);

      // Cached results should match original
      expect(cfdAddress2.address).to.equal(cfdAddress1.address);
      expect(ddkAddress2.address).to.equal(ddkAddress1.address);

      // Cached results should match between providers
      expect(cfdAddress2.address).to.equal(ddkAddress2.address);
      expect(cfdAddress2.publicKey).to.equal(ddkAddress2.publicKey);
    });
  });

  describe('Different Networks', () => {
    it(`should generate identical addresses on current network`, async () => {
      const testPath = `m/84'/${network.coinType}'/0'`;

      const providerOptions = {
        network,
        mnemonic: testMnemonic,
        addressType: bitcoin.AddressType.BECH32,
        baseDerivationPath: testPath,
      };

      // Set up temporary clients for this network
      const cfdClientNet = new Client();
      cfdClientNet.addProvider(
        mockedBitcoinRpcProvider() as unknown as Provider,
      );
      cfdClientNet.addProvider(
        new BitcoinJsWalletProvider(providerOptions) as any,
      );
      cfdClientNet.addProvider(new BitcoinCfdProvider(cfdJs));
      cfdClientNet.addProvider(
        new BitcoinCfdAddressDerivationProvider(providerOptions, cfdJs),
      );

      const ddkClientNet = new Client();
      ddkClientNet.addProvider(
        mockedBitcoinRpcProvider() as unknown as Provider,
      );

      const bitcoinJsWalletProviderDdkNet = new BitcoinJsWalletProvider(
        providerOptions,
      ) as any;
      const ddkAddressDerivationProviderNet =
        new BitcoinDdkAddressDerivationProvider(providerOptions, ddkJs);

      // Override getDerivationPathAddress like in lygos-app
      bitcoinJsWalletProviderDdkNet.getDerivationPathAddress =
        ddkAddressDerivationProviderNet.getDerivationPathAddress.bind(
          ddkAddressDerivationProviderNet,
        );

      ddkClientNet.addProvider(bitcoinJsWalletProviderDdkNet);
      ddkClientNet.addProvider(ddkAddressDerivationProviderNet);

      const derivationPath = `${testPath}/0/0`;

      const cfdAddress = await cfdClientNet.getMethod(
        'getDerivationPathAddress',
      )(derivationPath);
      const ddkAddress = await ddkClientNet.getMethod(
        'getDerivationPathAddress',
      )(derivationPath);

      expect(cfdAddress.address).to.equal(ddkAddress.address);
      expect(cfdAddress.publicKey).to.equal(ddkAddress.publicKey);
      expect(cfdAddress.derivationPath).to.equal(ddkAddress.derivationPath);
    });
  });

  describe('Random Mnemonic Test', () => {
    it('should generate identical addresses with randomly generated mnemonics', async () => {
      // Test with multiple random mnemonics to ensure consistency across different seeds
      for (let i = 0; i < 3; i++) {
        const randomMnemonic = generateMnemonic(256);

        const providerOptions = {
          network,
          mnemonic: randomMnemonic,
          addressType: bitcoin.AddressType.BECH32,
          baseDerivationPath,
        };

        // Set up temporary clients for this random mnemonic
        const cfdClientRandom = new Client();
        cfdClientRandom.addProvider(
          mockedBitcoinRpcProvider() as unknown as Provider,
        );
        cfdClientRandom.addProvider(
          new BitcoinJsWalletProvider(providerOptions) as any,
        );
        cfdClientRandom.addProvider(new BitcoinCfdProvider(cfdJs));
        cfdClientRandom.addProvider(
          new BitcoinCfdAddressDerivationProvider(providerOptions, cfdJs),
        );

        const ddkClientRandom = new Client();
        ddkClientRandom.addProvider(
          mockedBitcoinRpcProvider() as unknown as Provider,
        );

        const bitcoinJsWalletProviderDdkRandom = new BitcoinJsWalletProvider(
          providerOptions,
        ) as any;
        const ddkAddressDerivationProviderRandom =
          new BitcoinDdkAddressDerivationProvider(providerOptions, ddkJs);

        // Override getDerivationPathAddress like in lygos-app
        bitcoinJsWalletProviderDdkRandom.getDerivationPathAddress =
          ddkAddressDerivationProviderRandom.getDerivationPathAddress.bind(
            ddkAddressDerivationProviderRandom,
          );

        ddkClientRandom.addProvider(bitcoinJsWalletProviderDdkRandom);
        ddkClientRandom.addProvider(ddkAddressDerivationProviderRandom);

        // Test a couple of derivation paths
        const testPaths = [
          `${baseDerivationPath}/0/0`,
          `${baseDerivationPath}/0/1`,
        ];

        for (const path of testPaths) {
          const cfdAddress = await cfdClientRandom.getMethod(
            'getDerivationPathAddress',
          )(path);
          const ddkAddress = await ddkClientRandom.getMethod(
            'getDerivationPathAddress',
          )(path);

          expect(cfdAddress.address).to.equal(
            ddkAddress.address,
            `Random mnemonic ${i}, path ${path} addresses differ`,
          );
          expect(cfdAddress.publicKey).to.equal(
            ddkAddress.publicKey,
            `Random mnemonic ${i}, path ${path} public keys differ`,
          );
          expect(cfdAddress.derivationPath).to.equal(
            ddkAddress.derivationPath,
            `Random mnemonic ${i}, path ${path} derivation paths differ`,
          );
        }
      }
    });
  });
});
