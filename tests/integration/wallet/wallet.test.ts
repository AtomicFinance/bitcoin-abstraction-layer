import 'mocha';

import { generateMnemonic } from 'bip39';
import * as cfdDlcJs from 'cfd-dlc-js';
import * as cfdJs from 'cfd-js';
import { expect } from 'chai';

import BitcoinCfdProvider from '../../../packages/bitcoin-cfd-provider/lib';
import BitcoinDlcProvider from '../../../packages/bitcoin-dlc-provider/lib';
import { BitcoinJsWalletProvider } from '../../../packages/bitcoin-js-wallet-provider';
import { Client } from '../../../packages/client/lib';
import Provider from '../../../packages/provider';
import { Address, bitcoin, Input, Output } from '../../../packages/types';
import { chains, getInput, mockedBitcoinRpcProvider, network } from '../common';
import * as fixtures from '../fixtures/wallet.json';

const chain = chains.bitcoinWithJs;
const alice = chain.client;
const bob = chains.bitcoinWithJs2.client;
const frank = chains.bitcoinWithJs5.client; // custom starting addressIndex provided

describe('wallet provider', () => {
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
      const n = Object.keys(blacklist).length - 1;
      expect(Object.keys(blacklist)[n]).to.equal(unusedAddress.address);
    });
  });

  describe('getAddress with addressIndex', () => {
    it('should get address at custom derivation path', async () => {
      const unusedAddress = await frank.wallet.getUnusedAddress();
      expect(unusedAddress.derivationPath).to.equal("m/84'/1'/0'/0/100");
    });

    it('should get change address at custom derivation path', async () => {
      const unusedAddress = await frank.wallet.getUnusedAddress(true);
      expect(unusedAddress.derivationPath).to.equal("m/84'/1'/0'/1/100");
    });
  });

  describe('createMultisig (m-of-n)', () => {
    it('should create 2-of-2 multisig', async () => {
      const { address, redeemScript } = await alice.wallet.createMultisig(
        2,
        fixtures['2of3'].pubkeys,
      );

      expect(address).to.equal(fixtures['2of3'].address);
      expect(redeemScript).to.equal(fixtures['2of3'].redeemScript);
    });
    it('should create 2-of-4 multisig', async () => {
      const { address, redeemScript } = await alice.wallet.createMultisig(
        2,
        fixtures['2of4'].pubkeys,
      );

      expect(address).to.equal(fixtures['2of4'].address);
      expect(redeemScript).to.equal(fixtures['2of4'].redeemScript);
    });

    it('should fail if m > n', async () => {
      await expect(() => alice.wallet.createMultisig(2, [])).to.throw(Error);
    });
    it('should fail if pubkeys are invalid', async () => {
      await expect(() =>
        alice.wallet.createMultisig(2, fixtures.invalidPubkeys),
      ).to.throw(Error);
    });
  });

  describe('Full 2-of-3 multisig PSBT creation and signing process', () => {
    let aliceaddress1: Address;
    let aliceaddress2: Address;
    let bobaddress1: Address;
    let input: Input;
    let output: Output;
    let m: number;
    let pubkeys: string[];
    let address: string;
    let psbt: string;
    let psbtSigned: string;
    let psbtFinalized;

    before(async () => {
      aliceaddress1 = await alice.wallet.getUnusedAddress();
      aliceaddress2 = await alice.wallet.getUnusedAddress();
      bobaddress1 = await bob.wallet.getUnusedAddress();
      m = 2;
      pubkeys = [
        aliceaddress1.publicKey,
        aliceaddress2.publicKey,
        bobaddress1.publicKey,
      ];

      ({ address } = await alice.wallet.createMultisig(m, pubkeys));

      // import address, fund address, create input
      input = await getInput(alice, address);
      output = {
        to: 'bcrt1qr8u6q95nq8cxszvkhgr4hw5ap4dej6p0dysyk2',
        value: 200000000 - 200000,
      };
    });

    it('should buildMultisigPSBT', async () => {
      psbt = await alice.wallet.buildMultisigPSBT(
        m,
        pubkeys,
        [input],
        [output],
      );
    });

    it('should fail buildMultisigPSBT if no inputs', async () => {
      await expect(() =>
        alice.wallet.buildMultisigPSBT(m, pubkeys, [], [output]),
      ).to.throw(Error);
    });

    it('should fail buildMultisigPSBT if no outputs', async () => {
      await expect(() =>
        alice.wallet.buildMultisigPSBT(m, pubkeys, [input], []),
      ).to.throw(Error);
    });

    it('should fail buildMultisigPSBT if inputpubkey doesnt match', async () => {
      // import address, fund address, create input
      const badinput: Input = await getInput(
        alice,
        'bcrt1q36cr95ljct23nh3fkx0tspjulwpne4zukudfjjnkp3ac9vm43ztq8pz05y',
      );
      await expect(() =>
        alice.wallet.buildMultisigPSBT(2, pubkeys, [badinput], [output]),
      ).to.throw(Error);
    });

    it('should process and sign PSBT', async () => {
      psbtSigned = await alice.wallet.walletProcessPSBT(psbt);
      expect(psbtSigned).to.not.be.empty;
    });

    it('should fail walletProcessPSBT if non p2wsh inputs provided', async () => {
      try {
        await alice.wallet.walletProcessPSBT(fixtures['non-p2wsh-psbt']);
      } catch (e) {
        expect(e).to.be.an('Error');
      }
    });

    it('should finalizePSBT', async () => {
      psbtFinalized = alice.wallet.finalizePSBT(psbtSigned);
      expect(psbtFinalized.complete).to.be.true;
    });

    it('should sendRawTransaction', async () => {
      await expect(() =>
        alice.chain.sendRawTransaction(psbtFinalized.hex),
      ).to.not.throw(Error);
    });
  });

  describe.skip('setUnusedAddressesBlacklist', () => {
    it('should import blacklist addresses', async () => {
      const mnemonic = generateMnemonic(256);

      const carol = new Client();
      carol.addProvider((mockedBitcoinRpcProvider() as unknown) as Provider);
      carol.addProvider(
        new BitcoinJsWalletProvider({
          network,
          mnemonic,
          baseDerivationPath: `m/84'/${network.coinType}'/0'`,
          addressType: bitcoin.AddressType.BECH32,
        }) as any,
      );
      carol.addProvider(new BitcoinCfdProvider(cfdJs));
      carol.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));

      const carolUnusedAddress = await carol.wallet.getUnusedAddress();
      const carolAddresses = await carol.wallet.getAddresses(0, 2);
      const carolBlacklist = await carol.getMethod(
        'getUnusedAddressesBlacklist',
      )();

      const dave = new Client();
      carol.addProvider((mockedBitcoinRpcProvider() as unknown) as Provider);
      dave.addProvider(
        new BitcoinJsWalletProvider({
          network,
          mnemonic,
          baseDerivationPath: `m/84'/${network.coinType}'/0'`,
          addressType: bitcoin.AddressType.BECH32,
        }) as any,
      );
      dave.addProvider(new BitcoinCfdProvider(cfdJs));
      dave.addProvider(new BitcoinDlcProvider(network, cfdDlcJs));

      await dave.getMethod('setUnusedAddressesBlacklist')(carolBlacklist);

      const daveUnusedAddress = await dave.wallet.getUnusedAddress();
      const daveAddresses = await dave.wallet.getAddresses(0, 2);

      expect(carolUnusedAddress).to.not.deep.equal(daveUnusedAddress);
      expect(carolAddresses).to.deep.equal(daveAddresses);
      expect(carolAddresses[0]).to.deep.equal(carolUnusedAddress);
      expect(carolAddresses[1]).to.deep.equal(daveUnusedAddress);
    });
  });

  describe('findAddress', () => {
    it('should find change or non change addresses', async () => {
      const firstThirtyNonChangeAddresses = await alice.wallet.getAddresses(
        0,
        30,
        false,
      );
      const firstThirtyChangeAddresses = await alice.wallet.getAddresses(
        0,
        30,
        true,
      );
      const nonChangeAddress =
        firstThirtyNonChangeAddresses[firstThirtyNonChangeAddresses.length - 1];
      const changeAddress =
        firstThirtyChangeAddresses[firstThirtyChangeAddresses.length - 1];

      const foundNonChangeAddress = await alice.wallet.findAddress([
        nonChangeAddress.address,
      ]);

      const foundChangeAddress = await alice.wallet.findAddress([
        changeAddress.address,
      ]);

      expect(nonChangeAddress.address).to.equal(foundNonChangeAddress.address);
      expect(changeAddress.address).to.equal(foundChangeAddress.address);
    });
  });
});
