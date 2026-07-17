/* eslint-env mocha */

import { Address } from '@atomicfinance/types';
import { generateMnemonic } from 'bip39';
import { BitcoinNetworks } from 'bitcoin-network';
import { Transaction } from 'bitcoinjs-lib';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { BitcoinJsWalletProvider } from '../../lib';

const { expect } = chai.use(chaiAsPromised);
chai.config.truncateThreshold = 0;

describe('Bitcoin Wallet provider', () => {
  const mnemonic = generateMnemonic(256);
  let provider: BitcoinJsWalletProvider;

  beforeEach(() => {
    provider = new BitcoinJsWalletProvider({
      network: BitcoinNetworks.bitcoin_regtest,
      baseDerivationPath: `m/84'/${BitcoinNetworks.bitcoin_regtest.coinType}'/0`,
      mnemonic,
    });
  });

  describe('getDerivationCache', () => {
    it('should return derived addresses', async () => {
      const addresses = await provider.getAddresses(0, 1);
      const addressesFromDerivationCache = await provider.getDerivationCache();

      expect(addresses[0]).to.equal(
        addressesFromDerivationCache[addresses[0].derivationPath],
      );
    });
  });

  describe('setDerivationCache', () => {
    let addressesActual: Address[];
    let addressesFromDerivationCacheExpected: { [index: string]: Address };
    let newProvider;

    beforeEach(async () => {
      addressesActual = await provider.getAddresses(0, 1);
      addressesFromDerivationCacheExpected = provider.getDerivationCache();
    });

    it('should import to new client', async () => {
      newProvider = new BitcoinJsWalletProvider({
        network: BitcoinNetworks.bitcoin_regtest,
        baseDerivationPath: `m/84'/${BitcoinNetworks.bitcoin_regtest.coinType}'/0`,
        mnemonic,
      });
      await newProvider.setDerivationCache(
        addressesFromDerivationCacheExpected,
      );

      const addressesFromDerivationCacheActual = provider.getDerivationCache();
      const addressesExpected = await newProvider.getAddresses(0, 1);

      expect(addressesExpected[0]).to.equal(addressesActual[0]);
      expect(addressesFromDerivationCacheExpected).to.equal(
        addressesFromDerivationCacheActual,
      );
    });

    it("should fail if mnemonic doesn't match", async () => {
      newProvider = new BitcoinJsWalletProvider({
        network: BitcoinNetworks.bitcoin_regtest,
        baseDerivationPath: `m/84'/${BitcoinNetworks.bitcoin_regtest.coinType}'/0`,
        mnemonic: generateMnemonic(256),
      });
      await expect(
        newProvider.setDerivationCache(addressesFromDerivationCacheExpected),
      ).to.eventually.be.rejected;
    });
  });

  describe('_buildSweepTransaction', () => {
    const feeRate = 10;
    const taprootDestination =
      'bcrt1p7yu5dsly83jg5tkxcljsa30vnpdpl22wr6rty98t6x6p6ekz2gkqcckz99';

    const expectFeeWithinEstimate = (fee: number, tx: Transaction) => {
      const expectedFee = Math.ceil(tx.virtualSize() * feeRate);
      expect(fee).to.be.at.least(expectedFee);
      expect(fee).to.be.at.most(expectedFee + feeRate);
    };

    const mockSweepInputs = async (values: number[]) => {
      const addresses = await provider.getAddresses(0, values.length);
      const inputs = addresses.map((address, index) => ({
        txid: Buffer.alloc(32, index + 1).toString('hex'),
        vout: 0,
        value: values[index],
        address: address.address,
        derivationPath: address.derivationPath,
      }));

      provider.getInputsForAmount = async () => ({
        inputs,
        outputs: [],
        change: undefined,
        fee: 0,
      });

      return inputs;
    };

    it('sweeps one P2WPKH input with no change output', async () => {
      const inputs = await mockSweepInputs([100000]);
      const [destination] = await provider.getAddresses(10, 1);

      const { hex, fee } = await provider._buildSweepTransaction(
        destination.address,
        feeRate,
      );
      const tx = Transaction.fromHex(hex);
      const inputValue = inputs.reduce(
        (total, input) => total + input.value,
        0,
      );

      expect(tx.outs).to.have.length(1);
      expect(tx.outs[0].value).to.equal(inputValue - fee);
      expectFeeWithinEstimate(fee, tx);
    });

    it('sweeps multiple P2WPKH inputs with no change output', async () => {
      const inputs = await mockSweepInputs([100000, 200000, 300000]);
      const [destination] = await provider.getAddresses(10, 1);

      const { hex, fee } = await provider._buildSweepTransaction(
        destination.address,
        feeRate,
      );
      const tx = Transaction.fromHex(hex);
      const inputValue = inputs.reduce(
        (total, input) => total + input.value,
        0,
      );

      expect(tx.ins).to.have.length(3);
      expect(tx.outs).to.have.length(1);
      expect(tx.outs[0].value).to.equal(inputValue - fee);
      expectFeeWithinEstimate(fee, tx);
    });

    it('sweeps one P2WPKH input to a P2TR output with no change output', async () => {
      const inputs = await mockSweepInputs([100000]);

      const { hex, fee } = await provider._buildSweepTransaction(
        taprootDestination,
        feeRate,
      );
      const tx = Transaction.fromHex(hex);
      const inputValue = inputs.reduce(
        (total, input) => total + input.value,
        0,
      );

      expect(tx.outs).to.have.length(1);
      expect(tx.outs[0].script.length).to.equal(34);
      expect(tx.outs[0].value).to.equal(inputValue - fee);
      expectFeeWithinEstimate(fee, tx);
    });

    it('sweeps multiple P2WPKH inputs to a P2TR output with no change output', async () => {
      const inputs = await mockSweepInputs([100000, 200000, 300000]);

      const { hex, fee } = await provider._buildSweepTransaction(
        taprootDestination,
        feeRate,
      );
      const tx = Transaction.fromHex(hex);
      const inputValue = inputs.reduce(
        (total, input) => total + input.value,
        0,
      );

      expect(tx.ins).to.have.length(3);
      expect(tx.outs).to.have.length(1);
      expect(tx.outs[0].script.length).to.equal(34);
      expect(tx.outs[0].value).to.equal(inputValue - fee);
      expectFeeWithinEstimate(fee, tx);
    });

    it('rejects P2WPKH sweeps that cannot cover fees', async () => {
      await mockSweepInputs([100]);
      const [destination] = await provider.getAddresses(10, 1);

      await expect(
        provider._buildSweepTransaction(destination.address, feeRate),
      ).to.eventually.be.rejectedWith('Not enough balance');
    });

    it('rejects P2WPKH sweeps with a dust output', async () => {
      await mockSweepInputs([1500]);
      const [destination] = await provider.getAddresses(10, 1);

      await expect(
        provider._buildSweepTransaction(destination.address, feeRate),
      ).to.eventually.be.rejectedWith('Not enough balance');
    });

    it('rejects sweep coin selection that returns change', async () => {
      const inputs = await mockSweepInputs([100000]);
      const [destination] = await provider.getAddresses(10, 1);
      provider.getInputsForAmount = async () => ({
        inputs,
        outputs: [],
        change: { value: 1000 },
        fee: 0,
      });

      await expect(
        provider._buildSweepTransaction(destination.address, feeRate),
      ).to.eventually.be.rejectedWith(
        'There should not be any change for sweeping transaction',
      );
    });
  });
});
