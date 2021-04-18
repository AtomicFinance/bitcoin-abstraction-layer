import 'mocha';
import { expect } from 'chai';
import { chains, mockedBitcoinRpcProvider, network } from '../common';
// import Client from '@liquality/client';
import BitcoinJsWalletProvider from '@liquality/bitcoin-js-wallet-provider';
import { bitcoin } from '@liquality/types';
import { Client as FinanceClient } from '../../../packages/client/lib';
import BitcoinCfdProvider from '../../../packages/bitcoin-cfd-provider/lib';
import BitcoinDlcProvider from '../../../packages/bitcoin-dlc-provider/lib';
import BitcoinWalletProvider from '../../../packages/bitcoin-wallet-provider/lib';
import * as cfdJs from 'cfd-js';
import * as cfdDlcJs from 'cfd-dlc-js';
import { generateMnemonic } from 'bip39';

const chain = chains.bitcoinWithJs;
const alice = chain.client;

const bob = chains.bitcoinWithJs2.client;

describe.skip('wallet provider', () => {
  describe('getUnusedAddress', () => {
    it('should not return the same address twice', async () => {
      const unusedAddress = await alice.wallet.getUnusedAddress();
      const unusedAddress2 = await alice.wallet.getUnusedAddress();
      expect(unusedAddress).not.to.deep.equal(unusedAddress2);
    });
  });

  describe('getUnusedAddressesBlacklist', () => {
    it('should output used addresses', async () => {
      const unusedAddress = await bob.wallet.getUnusedAddress();
      const blacklist = await bob.getMethod('getUnusedAddressesBlacklist')();
      expect(Object.keys(blacklist)[0]).to.equal(unusedAddress.address);
    });
  });

  describe('setUnusedAddressesBlacklist', () => {
    it('should import blacklist addresses', async () => {
      const mnemonic = generateMnemonic(256);

      // const carol = new Client();
      const carol = new FinanceClient();
      // carol.finance = carolFinance;
      carol.addProvider(mockedBitcoinRpcProvider());
      carol.addProvider(
        new BitcoinJsWalletProvider({
          network,
          mnemonic,
          addressType: bitcoin.AddressType.BECH32,
        }) as any,
      );
      carol.addProvider(new BitcoinCfdProvider(cfdJs));
      carol.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));
      carol.addProvider(new BitcoinWalletProvider(network));

      const carolUnusedAddress = await carol.wallet.getUnusedAddress();
      const carolAddresses = await carol.wallet.getAddresses(0, 2);
      const carolBlacklist = await carol.getMethod(
        'getUnusedAddressesBlacklist',
      )();

      // const carol = new Client();
      const dave = new FinanceClient();
      // carol.finance = carolFinance;
      dave.addProvider(mockedBitcoinRpcProvider());
      dave.addProvider(
        new BitcoinJsWalletProvider({
          network,
          mnemonic,
          addressType: bitcoin.AddressType.BECH32,
        }) as any,
      );
      dave.addProvider(new BitcoinCfdProvider(cfdJs));
      dave.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));
      dave.addProvider(new BitcoinWalletProvider(network));

      await dave.getMethod('setUnusedAddressesBlacklist')(carolBlacklist);

      const daveUnusedAddress = await dave.wallet.getUnusedAddress();
      const daveAddresses = await dave.wallet.getAddresses(0, 2);

      expect(carolUnusedAddress).to.not.deep.equal(daveUnusedAddress);
      expect(carolAddresses).to.deep.equal(daveAddresses);
      expect(carolAddresses[0]).to.deep.equal(carolUnusedAddress);
      expect(carolAddresses[1]).to.deep.equal(daveUnusedAddress);
    });
  });
});
