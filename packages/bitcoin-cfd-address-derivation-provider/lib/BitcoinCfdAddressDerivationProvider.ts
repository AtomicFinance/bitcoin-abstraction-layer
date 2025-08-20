import Provider from '@atomicfinance/provider';
import { Address, bitcoin } from '@atomicfinance/types';
import { BIP32Factory } from 'bip32';
import { mnemonicToSeedSync } from 'bip39';
import { networks } from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

const BITCOIN_NETWORK_TO_CFD_NETWORK = {
  bitcoin: 'mainnet',
  bitcoin_testnet: 'testnet',
  bitcoin_regtest: 'regtest',
};

type DerivationCache = { [index: string]: Address };

const bip32 = BIP32Factory(ecc);

export default class BitcoinCfdAddressDerivationProvider extends Provider {
  _cfd: any;
  _mnemonic: string;
  _baseDerivationPath: string;
  _derivationCache: DerivationCache;
  _baseNode: any;
  _seed: any;
  _network: any;

  constructor(options: any, cfd: any) {
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

    const network = BITCOIN_NETWORK_TO_CFD_NETWORK[bitcoinNetwork.name];

    super();

    this._baseDerivationPath = baseDerivationPath;
    this._cfd = cfd;
    this._derivationCache = {};
    this._mnemonic = mnemonic;
    this._network = network;
  }

  getCfdDerivationCache() {
    return this._derivationCache;
  }

  async baseNode() {
    if (this._baseNode) {
      return this._baseNode;
    }

    // Use bitcoinjs-lib for consistent BIP32 derivation
    const seed = mnemonicToSeedSync(this._mnemonic);
    this._seed = seed;

    // Convert network to bitcoinjs-lib format
    let bjsNetwork;
    if (this._network === 'mainnet') {
      bjsNetwork = networks.bitcoin;
    } else if (this._network === 'testnet') {
      bjsNetwork = networks.testnet;
    } else if (this._network === 'regtest') {
      bjsNetwork = networks.regtest;
    }

    // Create master node and derive base path
    const masterNode = bip32.fromSeed(seed, bjsNetwork);
    const baseNode = masterNode.derivePath(this._baseDerivationPath);

    this._baseNode = baseNode;
    return this._baseNode;
  }

  async setCfdDerivationCache(derivationCache: DerivationCache) {
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

    const baseNode = await this.baseNode();
    const subPath = path.replace(this._baseDerivationPath + '/', '');

    // Use bitcoinjs-lib for derivation (ensures compatibility)
    const derivedNode = baseNode.derivePath(subPath);
    const publicKey = derivedNode.publicKey;

    const address = this.getMethod('getAddressFromPublicKey')(publicKey);

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
}
