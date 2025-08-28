import Provider from '@atomicfinance/provider';
import { Address, bitcoin } from '@atomicfinance/types';
import { BitcoinNetwork } from 'bitcoin-network';
import { networks, payments } from 'bitcoinjs-lib';

const BITCOIN_NETWORK_TO_CFD_NETWORK = {
  bitcoin: 'mainnet',
  bitcoin_testnet: 'testnet',
  bitcoin_regtest: 'regtest',
};

type DerivationCache = { [index: string]: Address };

export default class BitcoinCfdAddressDerivationProvider extends Provider {
  _cfd: any;
  _mnemonic: string;
  _baseDerivationPath: string;
  _derivationCache: DerivationCache;
  _baseExtkey: any;
  _seed: any;
  _network: any; // CFD network string (mainnet, testnet, regtest)
  _bitcoinNetwork: BitcoinNetwork; // Full BitcoinNetwork object
  _addressType: bitcoin.AddressType;

  constructor(
    options: {
      network: BitcoinNetwork;
      mnemonic: string;
      addressType?: bitcoin.AddressType;
      baseDerivationPath: string;
    },
    cfd: any,
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

    const network = BITCOIN_NETWORK_TO_CFD_NETWORK[bitcoinNetwork.name];

    super();

    this._baseDerivationPath = baseDerivationPath;
    this._cfd = cfd;
    this._derivationCache = {};
    this._mnemonic = mnemonic;
    this._network = network; // CFD network string
    this._bitcoinNetwork = bitcoinNetwork; // Full BitcoinNetwork object
    this._addressType = addressType;
    this._baseExtkey = null; // Initialize
    this._seed = null; // Initialize
  }

  getCfdDerivationCache() {
    return this._derivationCache;
  }

  async baseExtkey() {
    if (this._baseExtkey) {
      return this._baseExtkey;
    }

    const { seed } = await this._cfd.ConvertMnemonicToSeed({
      mnemonic: this._mnemonic.split(' '),
      passphrase: '',
      strictCheck: true,
      language: 'en',
    });

    this._seed = seed;

    const { extkey } = await this._cfd.CreateExtkeyFromSeed({
      seed,
      network: this._network,
      extkeyType: 'extPrivkey',
    });

    const { extkey: baseExtkey } = await this._cfd.CreateExtkeyFromParentPath({
      extkey,
      network: this._network,
      extkeyType: 'extPrivkey',
      path: this._baseDerivationPath,
    });

    this._baseExtkey = baseExtkey;
    return this._baseExtkey;
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

    const baseExtkey = await this.baseExtkey();
    const subPath = path.replace(this._baseDerivationPath + '/', '');

    const { extkey: subExtkey } = await this._cfd.CreateExtkeyFromParentPath({
      extkey: baseExtkey,
      network: this._network,
      extkeyType: 'extPrivkey',
      path: subPath,
    });

    const { pubkey: _publicKey } = await this._cfd.GetPubkeyFromExtkey({
      extkey: subExtkey,
      network: this._network,
    });

    const publicKey = Buffer.from(_publicKey, 'hex');

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
    if (this._network === 'mainnet') {
      bjsNetwork = networks.bitcoin;
    } else if (this._network === 'testnet') {
      bjsNetwork = networks.testnet;
    } else if (this._network === 'regtest') {
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
