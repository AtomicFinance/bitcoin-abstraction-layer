import {
  CoinSelectTarget,
  decodeRawTransaction,
  normalizeTransactionObject,
  selectCoins,
} from '@atomicfinance/bitcoin-utils';
import { InsufficientBalanceError } from '@atomicfinance/errors';
import Provider from '@atomicfinance/provider';
import {
  Address,
  BigNumber,
  bitcoin as bT,
  ChainProvider,
  InputSupplementationMode,
  SendOptions,
  Transaction,
  WalletProvider,
} from '@atomicfinance/types';
import { CoinSelectMode } from '@atomicfinance/types/dist/models/Input';
import { addressToString } from '@atomicfinance/utils';
import { dualFundingCoinSelect } from '@node-dlc/core';
import { BIP32Interface } from 'bip32';
import { BitcoinNetwork } from 'bitcoin-network';
import * as bitcoin from 'bitcoinjs-lib';
import memoize from 'memoizee';
import { runCoinSelect } from './coinselect';

const ADDRESS_GAP = 30;
const NONCHANGE_ADDRESS = 0;
const CHANGE_ADDRESS = 1;
const NONCHANGE_OR_CHANGE_ADDRESS = 2;

type UnusedAddressesBlacklist = {
  [address: string]: true;
};

export enum AddressSearchType {
  EXTERNAL,
  CHANGE,
  EXTERNAL_OR_CHANGE,
}

type DerivationCache = { [index: string]: Address };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = unknown> = new (...args: any[]) => T;

interface BitcoinWalletProviderOptions {
  network: BitcoinNetwork;
  baseDerivationPath: string;
  addressType?: bT.AddressType;
  addressIndex?: number;
  changeAddressIndex?: number;
}

export default <T extends Constructor<Provider>>(superclass: T) => {
  abstract class BitcoinWalletProvider
    extends superclass
    implements Partial<ChainProvider>, Partial<WalletProvider>
  {
    _network: BitcoinNetwork;
    _unusedAddressesBlacklist: UnusedAddressesBlacklist;
    _maxAddressesToDerive: number;
    _baseDerivationPath: string;
    _addressType: bT.AddressType;
    _addressIndex: number;
    _changeAddressIndex: number;
    _derivationCache: DerivationCache;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      const options = args[0] as BitcoinWalletProviderOptions;
      const {
        network,
        baseDerivationPath,
        addressType = bT.AddressType.BECH32,
        addressIndex = 0,
        changeAddressIndex = 0,
      } = options;
      const addressTypes = Object.values(bT.AddressType);
      if (!addressTypes.includes(addressType)) {
        throw new Error(`addressType must be one of ${addressTypes.join(',')}`);
      }

      super(options);

      this._baseDerivationPath = baseDerivationPath;
      this._network = network;
      this._addressType = addressType;
      this._addressIndex = addressIndex;
      this._changeAddressIndex = changeAddressIndex;
      this._derivationCache = {};
      this._unusedAddressesBlacklist = {};
      this._maxAddressesToDerive = 5000;
    }

    abstract baseDerivationNode(): Promise<BIP32Interface>;
    abstract _buildTransaction(
      targets: bT.OutputTarget[],
      feePerByte?: number,
      fixedInputs?: bT.Input[],
    ): Promise<{ hex: string; fee: number }>;
    abstract _buildSweepTransaction(
      externalChangeAddress: string,
      feePerByte?: number,
    ): Promise<{ hex: string; fee: number }>;
    abstract signPSBT(
      data: string,
      inputs: bT.PsbtInputTarget[],
    ): Promise<string>;
    abstract signBatchP2SHTransaction(
      inputs: [
        {
          inputTxHex: string;
          index: number;
          vout: { vSat: number };
          outputScript: Buffer;
        },
      ],
      addresses: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: any,
      lockTime?: number,
      segwit?: boolean,
    ): Promise<Buffer[]>;

    getDerivationCache() {
      return this._derivationCache;
    }

    async setDerivationCache(derivationCache: DerivationCache) {
      const address = await this.getDerivationPathAddress(
        Object.keys(derivationCache)[0],
      );
      if (derivationCache[address.derivationPath].address !== address.address) {
        throw new Error(
          `derivationCache at ${address.derivationPath} does not match`,
        );
      }
      this._derivationCache = derivationCache;
    }

    sendOptionsToOutputs(transactions: SendOptions[]): bT.OutputTarget[] {
      const targets: bT.OutputTarget[] = [];

      transactions.forEach((tx) => {
        if (tx.to && tx.value && tx.value.gt(0)) {
          targets.push({
            address: addressToString(tx.to),
            value: tx.value.toNumber(),
          });
        }

        if (tx.data) {
          const scriptBuffer = bitcoin.script.compile([
            bitcoin.script.OPS.OP_RETURN,
            Buffer.from(tx.data, 'hex'),
          ]);
          targets.push({
            value: 0,
            script: scriptBuffer,
          });
        }
      });

      return targets;
    }

    async buildTransaction(output: bT.OutputTarget, feePerByte: number) {
      return this._buildTransaction([output], feePerByte);
    }

    async buildBatchTransaction(outputs: bT.OutputTarget[]) {
      return this._buildTransaction(outputs);
    }

    async _sendTransaction(
      transactions: bT.OutputTarget[],
      feePerByte?: number,
    ) {
      const { hex, fee } = await this._buildTransaction(
        transactions,
        feePerByte,
      );
      await this.getMethod('sendRawTransaction')(hex);
      return normalizeTransactionObject(
        decodeRawTransaction(hex, this._network),
        fee,
      );
    }

    async sendTransaction(options: SendOptions) {
      return this._sendTransaction(
        this.sendOptionsToOutputs([options]),
        options.fee as number,
      );
    }

    async sendBatchTransaction(transactions: SendOptions[]) {
      return this._sendTransaction(this.sendOptionsToOutputs(transactions));
    }

    async buildSweepTransaction(
      externalChangeAddress: string,
      feePerByte: number,
    ) {
      return this._buildSweepTransaction(externalChangeAddress, feePerByte);
    }

    async sendSweepTransaction(
      externalChangeAddress: Address | string,
      feePerByte: number,
    ) {
      const { hex, fee } = await this._buildSweepTransaction(
        addressToString(externalChangeAddress),
        feePerByte,
      );
      await this.getMethod('sendRawTransaction')(hex);
      return normalizeTransactionObject(
        decodeRawTransaction(hex, this._network),
        fee,
      );
    }

    getUnusedAddressesBlacklist(): UnusedAddressesBlacklist {
      return this._unusedAddressesBlacklist;
    }

    setUnusedAddressesBlacklist(
      unusedAddressesBlacklist: UnusedAddressesBlacklist,
    ) {
      this._unusedAddressesBlacklist = unusedAddressesBlacklist;
    }

    setMaxAddressesToDerive(maxAddressesToDerive: number) {
      this._maxAddressesToDerive = maxAddressesToDerive;
    }

    getMaxAddressesToDerive() {
      return this._maxAddressesToDerive;
    }

    async updateTransactionFee(
      tx: Transaction<bitcoin.Transaction> | string,
      newFeePerByte: number,
    ) {
      const txHash = typeof tx === 'string' ? tx : tx.hash;
      const transaction: bT.Transaction = (
        await this.getMethod('getTransactionByHash')(txHash)
      )._raw;
      const fixedInputs = [transaction.vin[0]]; // TODO: should this pick more than 1 input? RBF doesn't mandate it

      const lookupAddresses = transaction.vout.map(
        (vout) => vout.scriptPubKey.addresses[0],
      );
      const changeAddress = await this.findAddress(lookupAddresses, true);
      const changeOutput = transaction.vout.find(
        (vout) => vout.scriptPubKey.addresses[0] === changeAddress.address,
      );

      let outputs = transaction.vout;
      if (changeOutput) {
        outputs = outputs.filter(
          (vout) =>
            vout.scriptPubKey.addresses[0] !==
            changeOutput.scriptPubKey.addresses[0],
        );
      }

      // TODO more checks?
      const transactions = outputs.map((output) => ({
        address: output.scriptPubKey.addresses[0],
        value: new BigNumber(output.value).times(1e8).toNumber(),
      }));
      const { hex, fee } = await this._buildTransaction(
        transactions,
        newFeePerByte,
        fixedInputs,
      );
      await this.getMethod('sendRawTransaction')(hex);
      return normalizeTransactionObject(
        decodeRawTransaction(hex, this._network),
        fee,
      );
    }

    async getUnusedAddress(change = false, numAddressPerCall = 100) {
      const addressType = change ? CHANGE_ADDRESS : NONCHANGE_ADDRESS;
      const key = change ? 'change' : 'nonChange';

      const address = await this._getUsedUnusedAddresses(
        numAddressPerCall,
        addressType,
      ).then(({ unusedAddress }) => unusedAddress[key]);
      this._unusedAddressesBlacklist[address.address] = true;

      return address;
    }

    async _getUsedUnusedAddresses(numAddressPerCall = 100, addressType) {
      const usedAddresses = [];
      const addressCountMap = { change: 0, nonChange: 0 };
      const unusedAddressMap = { change: null, nonChange: null };

      let addrList;
      let addressIndex = this._addressIndex;
      let changeAddressIndex = this._changeAddressIndex;
      let changeAddresses: Address[] = [];
      let nonChangeAddresses: Address[] = [];

      while (
        (addressType === NONCHANGE_OR_CHANGE_ADDRESS &&
          (addressCountMap.change < ADDRESS_GAP ||
            addressCountMap.nonChange < ADDRESS_GAP)) ||
        (addressType === NONCHANGE_ADDRESS &&
          addressCountMap.nonChange < ADDRESS_GAP) ||
        (addressType === CHANGE_ADDRESS && addressCountMap.change < ADDRESS_GAP)
      ) {
        addrList = [];

        if (
          (addressType === NONCHANGE_OR_CHANGE_ADDRESS ||
            addressType === CHANGE_ADDRESS) &&
          addressCountMap.change < ADDRESS_GAP
        ) {
          // Scanning for change addr
          changeAddresses = await this.client.wallet.getAddresses(
            changeAddressIndex,
            numAddressPerCall,
            true,
          );
          addrList = addrList.concat(changeAddresses);
        } else {
          changeAddresses = [];
        }

        if (
          (addressType === NONCHANGE_OR_CHANGE_ADDRESS ||
            addressType === NONCHANGE_ADDRESS) &&
          addressCountMap.nonChange < ADDRESS_GAP
        ) {
          // Scanning for non change addr
          nonChangeAddresses = await this.getAddresses(
            addressIndex,
            numAddressPerCall,
            false,
          );
          addrList = addrList.concat(nonChangeAddresses);
        }

        const transactionCounts = await this.getMethod(
          'getAddressTransactionCounts',
        )(addrList);

        for (const address of addrList) {
          const isUsed =
            transactionCounts[address.address] > 0 ||
            this._unusedAddressesBlacklist[address.address];
          const isChangeAddress = changeAddresses.find(
            (a) => address.address === a.address,
          );
          const key = isChangeAddress ? 'change' : 'nonChange';

          if (isUsed) {
            usedAddresses.push(address);
            addressCountMap[key] = 0;
            unusedAddressMap[key] = null;
          } else {
            addressCountMap[key]++;

            if (!unusedAddressMap[key]) {
              unusedAddressMap[key] = address;
            }
          }
        }

        addressIndex += numAddressPerCall;
        changeAddressIndex += numAddressPerCall;
      }

      let firstUnusedAddress;
      const indexNonChange = unusedAddressMap.nonChange
        ? unusedAddressMap.nonChange.index
        : Infinity;
      const indexChange = unusedAddressMap.change
        ? unusedAddressMap.change.index
        : Infinity;

      if (indexNonChange <= indexChange)
        firstUnusedAddress = unusedAddressMap.nonChange;
      else firstUnusedAddress = unusedAddressMap.change;

      return {
        usedAddresses,
        unusedAddress: unusedAddressMap,
        firstUnusedAddress,
      };
    }

    async getWalletAddress(address: string) {
      const foundAddress = await this.findAddress([address]);
      if (foundAddress) return foundAddress;

      throw new Error(`Wallet does not contain address: ${address}`);
    }

    getAddressFromPublicKey(publicKey: Buffer) {
      return this.getPaymentVariantFromPublicKey(publicKey).address;
    }

    getPaymentVariantFromPublicKey(publicKey: Buffer) {
      if (this._addressType === bT.AddressType.LEGACY) {
        return bitcoin.payments.p2pkh({
          pubkey: publicKey,
          network: this._network,
        });
      } else if (this._addressType === bT.AddressType.P2SH_SEGWIT) {
        return bitcoin.payments.p2sh({
          redeem: bitcoin.payments.p2wpkh({
            pubkey: publicKey,
            network: this._network,
          }),
          network: this._network,
        });
      } else if (this._addressType === bT.AddressType.BECH32) {
        return bitcoin.payments.p2wpkh({
          pubkey: publicKey,
          network: this._network,
        });
      }
    }

    async getDerivationPathAddress(path: string) {
      if (path in this._derivationCache) {
        return this._derivationCache[path];
      }

      const baseDerivationNode = await this.baseDerivationNode();
      const subPath = path.replace(this._baseDerivationPath + '/', '');
      const publicKey = baseDerivationNode.derivePath(subPath).publicKey;
      const address = this.getAddressFromPublicKey(publicKey);
      const addressObject = new Address({
        address,
        publicKey: publicKey.toString('hex'),
        derivationPath: path,
      });

      this._derivationCache[path] = addressObject;
      return addressObject;
    }

    /**
     * getAddresses is an optimized version of upstream CAL's getAddresses.
     * It removes the call to `asyncSetImmediate()`, speeding up the function by a factor of 6x.
     *
     * @param startingIndex
     * @param numAddresses
     * @param change
     * @returns {Promise<Address[]>}
     */
    async getAddresses(
      startingIndex = 0,
      numAddresses = 1,
      change = false,
    ): Promise<Address[]> {
      if (numAddresses < 1) {
        throw new Error('You must return at least one address');
      }

      const addresses = [];
      const lastIndex = startingIndex + numAddresses;
      const changeVal = change ? '1' : '0';

      for (
        let currentIndex = startingIndex;
        currentIndex < lastIndex;
        currentIndex++
      ) {
        const subPath = changeVal + '/' + currentIndex;
        const path = this._baseDerivationPath + '/' + subPath;
        const addressObject = await this.getDerivationPathAddress(path);
        addresses.push(addressObject);
      }

      return addresses;
    }

    /**
     * findAddress is an optimized version of upstream CAL's findAddress.
     *
     * It searches through both change and non-change addresses (if change arg is not provided) each iteration.
     *
     * This is in contrast to the original findAddress function which searches
     * through all non-change addresses before moving on to change addresses.
     *
     * @param addresses
     * @returns {Promise<Address>}
     */
    async findAddress(
      addresses: string[],
      change: boolean | null = null,
    ): Promise<Address> {
      const addressesPerCall = 20;
      let index = 0;

      while (index < this._maxAddressesToDerive) {
        const walletAddresses = [];

        if (change === null || change === false) {
          walletAddresses.push(
            ...(await this.getAddresses(index, addressesPerCall, false)),
          );
        }

        if (change === null || change === true) {
          walletAddresses.push(
            ...(await this.getAddresses(index, addressesPerCall, true)),
          );
        }

        const walletAddress = walletAddresses.find((walletAddr) =>
          addresses.find((addr) => walletAddr.address === addr),
        );

        if (walletAddress) {
          // Increment max addresses to derive by 100 if found within 100 addresses of maxAddressesToDerive
          this._maxAddressesToDerive = Math.max(
            this._maxAddressesToDerive,
            index + 100,
          );
          return walletAddress;
        }
        index += addressesPerCall;
      }
    }

    async getUsedAddresses(numAddressPerCall = 100) {
      return this._getUsedUnusedAddresses(
        numAddressPerCall,
        AddressSearchType.EXTERNAL_OR_CHANGE,
      ).then(({ usedAddresses }) => usedAddresses);
    }

    async withCachedUtxos(func: () => unknown) {
      const originalGetMethod = this.getMethod;
      const memoizedGetFeePerByte = memoize(this.getMethod('getFeePerByte'), {
        primitive: true,
      });
      const memoizedGetUnspentTransactions = memoize(
        this.getMethod('getUnspentTransactions'),
        { primitive: true },
      );
      const memoizedGetAddressTransactionCounts = memoize(
        this.getMethod('getAddressTransactionCounts'),
        {
          primitive: true,
        },
      );
      this.getMethod = (method: string, requestor: unknown = this) => {
        if (method === 'getFeePerByte') return memoizedGetFeePerByte;
        if (method === 'getUnspentTransactions')
          return memoizedGetUnspentTransactions;
        else if (method === 'getAddressTransactionCounts')
          return memoizedGetAddressTransactionCounts;
        else return originalGetMethod.bind(this)(method, requestor);
      };

      const result = await func.bind(this)();

      this.getMethod = originalGetMethod;

      return result;
    }

    async getTotalFee(opts: SendOptions, max: boolean) {
      const targets = this.sendOptionsToOutputs([opts]);
      if (!max) {
        const { fee } = await this.getInputsForAmount(
          targets,
          opts.fee as number,
        );
        return fee;
      } else {
        const { fee } = await this.getInputsForAmount(
          targets.filter((t) => !t.value),
          opts.fee as number,
          [],
          100,
          true,
        );
        return fee;
      }
    }

    async getTotalFees(transactions: SendOptions[], max: boolean) {
      const fees = await this.withCachedUtxos(async () => {
        const fees: { [index: number]: BigNumber } = {};
        for (const tx of transactions) {
          const fee = await this.getTotalFee(tx, max);
          fees[tx.fee as number] = new BigNumber(fee);
        }
        return fees;
      });
      return fees;
    }

    async getInputsForAmount(
      _targets: bT.OutputTarget[],
      feePerByte?: number,
      fixedInputs: bT.Input[] = [],
      numAddressPerCall = 100,
      sweep = false,
    ) {
      let addressIndex = 0;
      let changeAddresses: Address[] = [];
      let externalAddresses: Address[] = [];
      const addressCountMap = {
        change: 0,
        nonChange: 0,
      };

      const feePerBytePromise = this.getMethod('getFeePerByte')();
      let utxos: bT.UTXO[] = [];

      while (
        addressCountMap.change < ADDRESS_GAP ||
        addressCountMap.nonChange < ADDRESS_GAP
      ) {
        let addrList: Address[] = [];

        if (addressCountMap.change < ADDRESS_GAP) {
          // Scanning for change addr
          changeAddresses = await this.getAddresses(
            addressIndex,
            numAddressPerCall,
            true,
          );
          addrList = addrList.concat(changeAddresses);
        } else {
          changeAddresses = [];
        }

        if (addressCountMap.nonChange < ADDRESS_GAP) {
          // Scanning for non change addr
          externalAddresses = await this.getAddresses(
            addressIndex,
            numAddressPerCall,
            false,
          );
          addrList = addrList.concat(externalAddresses);
        }

        const fixedUtxos: bT.UTXO[] = [];
        if (fixedInputs.length > 0) {
          for (const input of fixedInputs) {
            const txHex = await this.getMethod('getRawTransactionByHash')(
              input.txid,
            );
            const tx = decodeRawTransaction(txHex, this._network);
            const value = new BigNumber(tx.vout[input.vout].value)
              .times(1e8)
              .toNumber();
            const address = tx.vout[input.vout].scriptPubKey.addresses[0];
            const walletAddress = await this.getWalletAddress(address);
            const utxo = {
              ...input,
              value,
              address,
              derivationPath: walletAddress.derivationPath,
            };
            fixedUtxos.push(utxo);
          }
        }

        if (!sweep || fixedUtxos.length === 0) {
          const _utxos: bT.UTXO[] = await this.getMethod(
            'getUnspentTransactions',
          )(addrList);
          utxos.push(
            ..._utxos.map((utxo) => {
              const addr = addrList.find((a) => a.address === utxo.address);
              return {
                ...utxo,
                derivationPath: addr.derivationPath,
              };
            }),
          );
        } else {
          utxos = fixedUtxos;
        }

        const utxoBalance = utxos.reduce((a, b) => a + (b.value || 0), 0);

        const transactionCounts: bT.AddressTxCounts = await this.getMethod(
          'getAddressTransactionCounts',
        )(addrList);

        if (!feePerByte) feePerByte = await feePerBytePromise;
        const minRelayFee = await this.getMethod('getMinRelayFee')();
        if (Number(feePerByte) < minRelayFee) {
          throw new Error(
            `Fee supplied (${feePerByte} sat/b) too low. Minimum relay fee is ${minRelayFee} sat/b`,
          );
        }

        let targets: CoinSelectTarget[];
        if (sweep) {
          const outputBalance = _targets.reduce(
            (a, b) => a + (b['value'] || 0),
            0,
          );

          const sweepOutputSize = 39;
          const paymentOutputSize =
            _targets.filter((t) => t.value && t.address).length * 39;
          const scriptOutputSize = _targets
            .filter((t) => !t.value && t.script)
            .reduce((size, t) => size + 39 + t.script.byteLength, 0);

          const outputSize =
            sweepOutputSize + paymentOutputSize + scriptOutputSize;
          const inputSize = utxos.length * 153;

          const sweepFee = feePerByte * (inputSize + outputSize);
          const amountToSend = new BigNumber(utxoBalance).minus(sweepFee);

          targets = _targets.map((target) => ({
            id: 'main',
            value: target.value,
            script: target.script,
          }));
          targets.push({
            id: 'main',
            value: amountToSend.minus(outputBalance).toNumber(),
          });
        } else {
          targets = _targets.map((target) => ({
            id: 'main',
            value: target.value,
            script: target.script,
          }));
        }

        const { inputs, outputs, change, fee } = selectCoins(
          utxos,
          targets,
          Math.ceil(feePerByte),
          fixedUtxos,
        );

        if (inputs && outputs) {
          return {
            inputs,
            change,
            outputs,
            fee,
          };
        }

        for (const address of addrList) {
          const isUsed = transactionCounts[address.address];
          const isChangeAddress = changeAddresses.find(
            (a) => address.address === a.address,
          );
          const key = isChangeAddress ? 'change' : 'nonChange';

          if (isUsed) {
            addressCountMap[key] = 0;
          } else {
            addressCountMap[key]++;
          }
        }

        addressIndex += numAddressPerCall;
      }

      throw new InsufficientBalanceError('Not enough balance');
    }

    async getInputsForDualFunding(
      collaterals: bigint[],
      feePerByte?: bigint,
      fixedInputs: bT.Input[] = [],
      inputSupplementationMode: InputSupplementationMode = InputSupplementationMode.Required,
      coinSelectMode: CoinSelectMode = CoinSelectMode.Coinselect,
      numAddressPerCall = 100,
    ) {
      const feePerBytePromise = this.getMethod('getFeePerByte')();

      if (!collaterals.length) {
        throw new Error('No collaterals provided');
      }

      // Process fixed inputs once, outside the loop
      const fixedUtxos: bT.UTXO[] = [];
      if (fixedInputs.length > 0) {
        for (const input of fixedInputs) {
          const txHex = await this.getMethod('getRawTransactionByHash')(
            input.txid,
          );
          const tx = decodeRawTransaction(txHex, this._network);
          const value = new BigNumber(tx.vout[input.vout].value)
            .times(1e8)
            .toNumber();
          const address = tx.vout[input.vout].scriptPubKey.addresses[0];
          let derivationPath: string | undefined;
          try {
            const walletAddress = await this.getWalletAddress(address);
            derivationPath = walletAddress.derivationPath ?? undefined;
          } catch (error) {
            const errorMessage = `getAddress failed with error: ${error?.message ?? 'unknown'}`;
            if (inputSupplementationMode === InputSupplementationMode.None) {
              console.warn(errorMessage);
            } else {
              throw new Error(errorMessage);
            }
          }
          const utxo = {
            ...input,
            value,
            address,
            derivationPath,
          };
          fixedUtxos.push(utxo);
        }
      }

      // For 'None' mode, use only fixed inputs without scanning
      if (inputSupplementationMode === InputSupplementationMode.None) {
        if (!fixedInputs.length) {
          throw new Error('No fixedInputs provided');
        }

        if (!feePerByte) feePerByte = await feePerBytePromise;
        const minRelayFee = await this.getMethod('getMinRelayFee')();
        if (Number(feePerByte) < minRelayFee) {
          throw new Error(
            `Fee supplied (${feePerByte} sat/b) too low. Minimum relay fee is ${minRelayFee} sat/b`,
          );
        }

        const coinSelectResult = runCoinSelect(
          coinSelectMode,
          fixedUtxos,
          collaterals.map((value) => ({
            value: Number(value),
          })),
          Number(feePerByte),
        );

        if (!(coinSelectResult.inputs?.length >= 1)) {
          throw new Error(`CoinSelect failed (mode: ${coinSelectMode})`);
        }

        // Further coin selection is applied here
        const { fee, inputs } = dualFundingCoinSelect(
          coinSelectResult.inputs as bT.UTXO[],
          collaterals,
          feePerByte,
        );

        if (inputs.length > 0) {
          return {
            inputs,
            fee,
          };
        }

        throw new InsufficientBalanceError(
          'Not enough balance for dual funding (InputSupplementationMode.None)',
        );
      }

      // For 'Required' or 'Optional' modes, scan for additional UTXOs
      let addressIndex = 0;
      let changeAddresses: Address[] = [];
      let externalAddresses: Address[] = [];
      const addressCountMap = {
        change: 0,
        nonChange: 0,
      };

      let utxos: bT.UTXO[] = [...fixedUtxos]; // Initalize with fixedUtxos

      while (
        addressCountMap.change < ADDRESS_GAP ||
        addressCountMap.nonChange < ADDRESS_GAP
      ) {
        let addrList: Address[] = [];

        if (addressCountMap.change < ADDRESS_GAP) {
          // Scanning for change addr
          changeAddresses = await this.getAddresses(
            addressIndex,
            numAddressPerCall,
            true,
          );
          addrList = addrList.concat(changeAddresses);
        } else {
          changeAddresses = [];
        }

        if (addressCountMap.nonChange < ADDRESS_GAP) {
          // Scanning for non change addr
          externalAddresses = await this.getAddresses(
            addressIndex,
            numAddressPerCall,
            false,
          );
          addrList = addrList.concat(externalAddresses);
        }

        const _utxos: bT.UTXO[] = await this.getMethod(
          'getUnspentTransactions',
        )(addrList);
        // De duplicate UTXOs
        const _uniqueUtxos: bT.UTXO[] = _utxos.filter(
          (utxo) =>
            !utxos.find(
              (existingUtxo) =>
                existingUtxo.txid === utxo.txid &&
                existingUtxo.vout === utxo.vout,
            ),
        );
        utxos = utxos.concat(
          ..._uniqueUtxos.map((utxo) => {
            const addr = addrList.find((a) => a.address === utxo.address);
            return {
              ...utxo,
              derivationPath: addr.derivationPath,
            };
          }),
        );

        const transactionCounts: bT.AddressTxCounts = await this.getMethod(
          'getAddressTransactionCounts',
        )(addrList);

        if (!feePerByte) feePerByte = await feePerBytePromise;
        const minRelayFee = await this.getMethod('getMinRelayFee')();
        if (Number(feePerByte) < minRelayFee) {
          throw new Error(
            `Fee supplied (${feePerByte} sat/b) too low. Minimum relay fee is ${minRelayFee} sat/b`,
          );
        }

        const coinSelectResult = runCoinSelect(
          coinSelectMode,
          utxos,
          collaterals.map((value) => ({
            value: Number(value),
          })),
          Number(feePerByte),
        );

        if (!(coinSelectResult.inputs?.length >= 1)) {
          throw new Error(`CoinSelect failed (mode: ${coinSelectMode})`);
        }

        // Further coin selection is applied here
        const { fee, inputs } = dualFundingCoinSelect(
          coinSelectResult.inputs as bT.UTXO[],
          collaterals,
          feePerByte,
        );

        if (inputs.length > 0) {
          return {
            inputs,
            fee,
          };
        }

        for (const address of addrList) {
          const isUsed = transactionCounts[address.address];
          const isChangeAddress = changeAddresses.find(
            (a) => address.address === a.address,
          );
          const key = isChangeAddress ? 'change' : 'nonChange';

          if (isUsed) {
            addressCountMap[key] = 0;
          } else {
            addressCountMap[key]++;
          }
        }

        addressIndex += numAddressPerCall;
      }

      throw new InsufficientBalanceError('Not enough balance for dual funding');
    }
  }
  return BitcoinWalletProvider;
};
