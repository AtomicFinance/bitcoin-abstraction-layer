import Provider from '@atomicfinance/provider';
import { Address, bitcoin, DdkInterface } from '@atomicfinance/types';
import { BitcoinNetwork } from 'bitcoin-network';
import { networks, payments } from 'bitcoinjs-lib';

const BITCOIN_NETWORK_TO_DDK_NETWORK = {
  bitcoin: 'mainnet',
  bitcoin_testnet: 'testnet',
  bitcoin_regtest: 'regtest',
};

type DerivationCache = { [index: string]: Address };

export default class BitcoinDdkAddressDerivationProvider extends Provider {
  _ddk: DdkInterface;
  _mnemonic: string;
  _baseDerivationPath: string;
  _derivationCache: DerivationCache;
  _seed: Buffer | null;
  _network: BitcoinNetwork;
  _addressType: bitcoin.AddressType;

  constructor(
    options: {
      network: BitcoinNetwork;
      mnemonic: string;
      addressType?: bitcoin.AddressType;
      baseDerivationPath: string;
    },
    ddk: DdkInterface,
  ) {
    const {
      network: bitcoinNetwork,
      mnemonic,
      addressType = bitcoin.AddressType.BECH32,
      baseDerivationPath,
    } = options;
    const addressTypes = Object.values(bitcoin.AddressType);
    if (!addressTypes.includes(addressType)) {
      throw new Error(`addressType must be one of ${addressTypes.join(',')}`);
    }

    super();

    this._baseDerivationPath = baseDerivationPath;
    this._ddk = ddk;
    this._derivationCache = {};
    this._mnemonic = mnemonic;
    this._network = bitcoinNetwork;
    this._addressType = addressType;
    this._seed = null;
  }

  getDdkDerivationCache() {
    return this._derivationCache;
  }

  async getSeed() {
    if (this._seed) {
      return this._seed;
    }

    // Use DDK's mnemonic to seed conversion
    const seed = this._ddk.convertMnemonicToSeed(this._mnemonic);
    this._seed = seed;
    return this._seed;
  }

  async setDdkDerivationCache(derivationCache: DerivationCache) {
    const address = await this.getDerivationPathAddress(
      Object.keys(derivationCache)[0],
    );
    if (derivationCache[address.derivationPath!].address !== address.address) {
      throw new Error(
        `derivationCache at ${address.derivationPath} does not match`,
      );
    }
    this._derivationCache = derivationCache;
  }

  async getDerivationPathAddress(path: string) {
    if (path in this._derivationCache) {
      return this._derivationCache[path];
    }

    const seed = await this.getSeed();
    const subPath = path.replace(this._baseDerivationPath + '/', '');
    const networkName =
      BITCOIN_NETWORK_TO_DDK_NETWORK[this._network.name] || 'mainnet';

    // Use DDK's new clean API (v0.3.23+)
    // Step 1: Create master extended key from seed
    const masterXpriv = this._ddk.createExtkeyFromSeed(seed, networkName);

    // Step 2: Derive base path from master
    const baseXpriv = this._ddk.createExtkeyFromParentPath(
      masterXpriv,
      this._baseDerivationPath.replace('m/', ''), // Remove 'm/' prefix
    );

    // Step 3: Derive final path from base
    const derivedXpriv = this._ddk.createExtkeyFromParentPath(
      baseXpriv,
      subPath,
    );

    // Step 4: Extract public key directly
    const publicKey = this._ddk.getPubkeyFromExtkey(derivedXpriv, networkName);

    const address = this.getAddressFromPublicKey(publicKey);

    const addressObject = new Address({
      address,
      publicKey: publicKey.toString('hex'),
      derivationPath: path,
    });

    this._derivationCache[path] = addressObject;
    return addressObject;
  }

  async getAddresses(startingIndex = 0, numAddresses = 1, change = false) {
    if (numAddresses < 1) {
      throw new Error('You must return at least one address');
    }

    const lastIndex = startingIndex + numAddresses;
    const changeVal = change ? '1' : '0';

    const addresses: Address[] = [];

    for (
      let currentIndex = startingIndex;
      currentIndex < lastIndex;
      currentIndex++
    ) {
      const subPath = changeVal + '/' + currentIndex;
      const path = this._baseDerivationPath + '/' + subPath;
      addresses.push(await this.getDerivationPathAddress(path));
    }

    return addresses;
  }

  getAddressFromPublicKey(publicKey: Buffer): string {
    return this.getPaymentVariantFromPublicKey(publicKey).address;
  }

  getPaymentVariantFromPublicKey(publicKey: Buffer): { address?: string } {
    // Convert network name to bitcoinjs-lib network
    let bjsNetwork;
    if (this._network.name === 'bitcoin') {
      bjsNetwork = networks.bitcoin;
    } else if (this._network.name === 'bitcoin_testnet') {
      bjsNetwork = networks.testnet;
    } else if (this._network.name === 'bitcoin_regtest') {
      bjsNetwork = networks.regtest;
    }

    if (this._addressType === bitcoin.AddressType.LEGACY) {
      return payments.p2pkh({
        pubkey: publicKey,
        network: bjsNetwork,
      });
    } else if (this._addressType === bitcoin.AddressType.P2SH_SEGWIT) {
      return payments.p2sh({
        redeem: payments.p2wpkh({
          pubkey: publicKey,
          network: bjsNetwork,
        }),
        network: bjsNetwork,
      });
    } else if (this._addressType === bitcoin.AddressType.BECH32) {
      return payments.p2wpkh({
        pubkey: publicKey,
        network: bjsNetwork,
      });
    }
  }
}
