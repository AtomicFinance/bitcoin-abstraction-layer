import Provider from '@atomicfinance/provider';
import { decodeRawTransaction } from '@liquality/bitcoin-utils';
import {
  AdaptorPair,
  AddSignaturesToRefundTxRequest,
  AddSignatureToFundTransactionRequest,
  CreateCetAdaptorSignaturesRequest,
  CreateCetAdaptorSignaturesResponse,
  CreateDlcTransactionsRequest,
  GetRawFundTxSignatureRequest,
  GetRawRefundTxSignatureRequest,
  SignCetRequest,
  SignFundTransactionRequest,
  VerifyCetAdaptorSignaturesRequest,
  VerifyRefundTxSignatureRequest,
} from '../@types/cfd-dlc-js';
import {
  CreateMultisigRequest,
  CreateRawTransactionRequest,
  CreateSignatureHashRequest,
  CalculateEcSignatureRequest,
  PubkeySignData,
  AddMultisigSignRequest,
  VerifySignatureRequest,
  CreateMultisigResponse,
} from '../@types/cfd-js';
import BitcoinDlcProvider from '../BitcoinDlcProvider';
import { asyncForEach } from '../utils/Utils';
import AcceptMessage from './AcceptMessage';
import Amount from './Amount';
import Contract from './Contract';
import MutualClosingMessage from './MutualClosingMessage';
import Input from './Input';
import Output from './Output';
import OfferMessage from './OfferMessage';
import PartyInputs from './PartyInputs';
import SignMessage from './SignMessage';
import Utxo from './Utxo';
import {
  DlcOffer,
  DlcAccept,
  DlcSign,
  FundingInput,
} from '@node-dlc/messaging';

const ESTIMATED_SIZE = 312;

type AdaptorSignatureJobResponse = {
  index: number;
  response: CreateCetAdaptorSignaturesResponse;
};

export default class DlcParty {
  readonly client: BitcoinDlcProvider;
  readonly passphrase: string;

  readonly dlcProvider: Provider;

  partyInputs: PartyInputs;
  fundPrivateKey: string;
  inputPrivateKeys: string[];
  contract: Contract;

  constructor(client: BitcoinDlcProvider) {
    this.client = client;
  }

  public async InitiateContract(
    initialContract: Contract,
    // startingIndex: number,
    fixedInputs: Input[],
  ): Promise<DlcOffer> {
    this.contract = initialContract;
    await this.Initialize(
      this.contract.offerCollateralSatoshis,
      // startingIndex,
      fixedInputs,
    );
    this.contract.localPartyInputs = this.partyInputs;
    return this.contract.GetDlcOfferMessage();
  }

  // public async ImportContract(initialContract: Contract, startingIndex = 0) {
  //   this.contract = initialContract;
  //   if (!this.contract.startingIndex) {
  //     this.contract.startingIndex = startingIndex;
  //   }
  //   await this.Initialize(
  //     this.contract.localCollateral,
  //     this.contract.startingIndex,
  //     [],
  //     false,
  //   );
  // }

  private async Initialize(
    collateral: bigint,
    // startingIndex: number,
    fixedInputs: Input[],
    checkUtxos = true,
  ) {
    const changeAddress = (
      await this.client.client.wallet.getUnusedAddress(true)
    ).address;
    const finalAddress = (
      await this.client.client.wallet.getUnusedAddress(false)
    ).address;

    console.log('this.client', this.client);

    const fundingAddress = await this.client.client.wallet.getUnusedAddress(
      false,
    );

    console.log('fundingAddress', fundingAddress.address);
    console.log('finalAddress', finalAddress);

    if (fundingAddress.address === finalAddress) {
      throw Error('Address reuse');
    }
    // const addresses = await this.client.getMethod('getAddresses')(
    //   startingIndex,
    //   2,
    //   false,
    // );
    // const changeAddresses = await this.client.getMethod('getAddresses')(
    //   startingIndex,
    //   2,
    //   true,
    // );

    // const changeAddress = changeAddresses[0].address;
    // const finalAddress = addresses[0].address;

    const fundPrivateKeyPair = await this.client.getMethod('keyPair')(
      fundingAddress.derivationPath,
    );

    this.fundPrivateKey = Buffer.from(fundPrivateKeyPair.__D).toString('hex');
    const fundPublicKey = fundingAddress.publicKey.toString('hex');

    let fundTxCreated = false;
    if (this.contract.fundTxHex) {
      const network = await this.client.getMethod('getConnectedNetwork')();
      const fundTx = await decodeRawTransaction(
        this.contract.fundTxHex,
        network,
      );
      const refundTx = await decodeRawTransaction(
        this.contract.refundTransaction,
        network,
      );
      const fundAddress =
        fundTx.vout[refundTx.vin[0].vout].scriptPubKey.addresses;

      const balance = await this.client.getMethod('getBalance')(fundAddress);
      if (balance.gt(0)) {
        fundTxCreated = true;
      }
    }

    let utxos: Utxo[] = [];
    // if (checkUtxos === true || !this.contract.fundTxHex || !fundTxCreated) {
    if (
      this.contract.isLocalParty &&
      this.contract.localPartyInputs?.utxos.length > 0
    ) {
      utxos = this.contract.localPartyInputs.utxos;
    } else if (
      !this.contract.isLocalParty &&
      this.contract.remotePartyInputs?.utxos.length > 0
    ) {
      utxos = this.contract.remotePartyInputs.utxos;
    } else {
      utxos = await this.GetUtxosForAmount(collateral, fixedInputs);
    }
    // } else {
    //   utxos = await this.GetFundingUtxos(startingIndex);
    // }

    const inputs = new PartyInputs(
      fundPublicKey,
      changeAddress,
      finalAddress,
      utxos,
    );

    this.inputPrivateKeys = await this.GetPrivKeysForUtxos(inputs.utxos);
    this.partyInputs = inputs;
  }

  private async GetUtxosForAmount(amount: bigint, fixedInputs: Input[]) {
    if (amount === BigInt(0)) {
      return [];
    }
    const outputs = [
      {
        to: BurnAddress,
        value:
          Number(amount) +
          ESTIMATED_SIZE * (Number(this.contract.feeRatePerVb) - 1),
      },
    ];
    let utxos;
    try {
      const inputsForAmount = await this.client.getMethod('getInputsForAmount')(
        outputs,
        1,
        fixedInputs,
      );
      utxos = inputsForAmount.inputs;
    } catch (e) {
      if (fixedInputs.length === 0) {
        throw Error('Not enough balance getInputsForAmount');
      } else {
        utxos = fixedInputs;
      }
    }

    const utxoSet: Utxo[] = [];
    for (let i = 0; i < utxos.length; i++) {
      const utxo = utxos[i];

      utxoSet.push({
        txid: utxo.txid,
        vout: utxo.vout,
        amount: Amount.FromSatoshis(utxo.value),
        address: utxo.address,
        derivationPath: utxo.derivationPath,
        maxWitnessLength: utxo.maxWitnessLength,
        toJSON: Utxo.prototype.toJSON,
      });
    }

    return utxoSet;
  }

  private async GetFundingUtxos(startingIndex: number) {
    const fundTransaction = await this.client.getMethod(
      'DecodeRawTransaction',
    )({ hex: this.contract.fundTxHex });

    const utxos: Utxo[] = [];
    for (let i = 0; i < fundTransaction.vin.length; i++) {
      const vin = fundTransaction.vin[i];

      const vinRawTx = await this.client.getMethod('getRawTransactionByHash')(
        vin.txid,
      );

      const network = await this.client.getMethod('getConnectedNetwork')();

      const vinTx = await decodeRawTransaction(vinRawTx, network);

      const addresses = await this.client.getMethod('getAddresses')(
        startingIndex,
        1,
        false,
      );
      const fundingAddress = addresses[0].address;

      for (let j = 0; j < vinTx.vout.length; j++) {
        const vout = vinTx.vout[j];

        if (fundingAddress === vout.scriptPubKey.addresses[0]) {
          utxos.push({
            txid: vinTx.hash,
            vout: j,
            amount: Amount.FromBitcoin(vout.value),
            address: fundingAddress,
            derivationPath: addresses[0].derivationPath,
            maxWitnessLength: 1000000,
            toJSON: Utxo.prototype.toJSON,
          });
        }
      }
    }

    return utxos;
  }

  private async GetPrivKeysForUtxos(utxoSet: Utxo[]): Promise<string[]> {
    const privKeys: string[] = [];

    for (let i = 0; i < utxoSet.length; i++) {
      const utxo = utxoSet[i];
      const keyPair = await this.client.getMethod('keyPair')(
        utxo.derivationPath,
      );
      const privKey = Buffer.from(keyPair.__D).toString('hex');
      privKeys.push(privKey);
    }

    return privKeys;
  }

  private async CheckMultisigPubkeyOrdering(): Promise<MultisigAndOrdering> {
    let localPubkeyFirst = true;
    const localPubkey = this.contract.localPartyInputs.fundPublicKey;
    const remotePubkey = this.contract.remotePartyInputs.fundPublicKey;
    const network = await this.client.getMethod('getConnectedNetwork')();

    const refundTx = await decodeRawTransaction(
      this.contract.refundTransaction,
      network,
    );
    const vout = refundTx.vin[0].vout;
    const fundTx = await decodeRawTransaction(this.contract.fundTxHex, network);
    const fundAddress = fundTx.vout[vout].scriptPubKey.addresses[0];

    let multisig: CreateMultisigResponse;

    for (let i = 0; i < 2; i++) {
      const createMultisigRequest: CreateMultisigRequest = {
        nrequired: 2,
        keys:
          i === 0 ? [localPubkey, remotePubkey] : [remotePubkey, localPubkey],
        network: 'regtest',
        hashType: 'p2wsh',
      };

      multisig = await this.client.getMethod('CreateMultisig')(
        createMultisigRequest,
      );
      if (multisig.address === fundAddress) {
        if (i === 1) {
          localPubkeyFirst = false;
        }
        break;
      } else if (i === 1) {
        throw new Error("Pubkeys don't match");
      }
    }

    return {
      localPubkeyFirst,
      vout,
      localPubkey,
      remotePubkey,
      multisig,
    };
  }

  private async CreateDlcTransactions() {
    const localFinalScriptPubkey = await this.client.getMethod(
      'GetAddressScript',
    )(this.contract.localPartyInputs.finalAddress);
    const remoteFinalScriptPubkey = await this.client.getMethod(
      'GetAddressScript',
    )(this.contract.remotePartyInputs.finalAddress);
    const localChangeScriptPubkey = await this.client.getMethod(
      'GetAddressScript',
    )(this.contract.localPartyInputs.changeAddress);
    const remoteChangeScriptPubkey = await this.client.getMethod(
      'GetAddressScript',
    )(this.contract.remotePartyInputs.changeAddress);

    const dlcTxRequest: CreateDlcTransactionsRequest = {
      payouts: this.contract.payouts.map((payout) => {
        return {
          local: payout.local.GetSatoshiAmount(),
          remote: payout.remote.GetSatoshiAmount(),
        };
      }),
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      localFinalScriptPubkey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      remoteFinalScriptPubkey,
      localInputAmount: this.contract.localPartyInputs.GetTotalInputAmount(),
      localCollateralAmount: this.contract.localCollateral.GetSatoshiAmount(),
      remoteInputAmount: this.contract.remotePartyInputs.GetTotalInputAmount(),
      remoteCollateralAmount: this.contract.remoteCollateral.GetSatoshiAmount(),
      refundLocktime: this.contract.refundLocktime,
      localInputs: this.contract.localPartyInputs.utxos,
      remoteInputs: this.contract.remotePartyInputs.utxos,
      localChangeScriptPubkey,
      remoteChangeScriptPubkey,
      feeRate: Number(this.contract.feeRatePerVb),
    };

    const dlcTransactions = await this.client.CreateDlcTransactions(
      dlcTxRequest,
    );
    this.contract.fundTxHex = dlcTransactions.fundTxHex;
    const fundTransaction = await this.client.getMethod(
      'DecodeRawTransaction',
    )({ hex: this.contract.fundTxHex });
    this.contract.fundTxId = fundTransaction.txid;
    this.contract.fundTxOutAmount = Amount.FromSatoshis(
      Number(fundTransaction.vout[0].value),
    );
    this.contract.refundTransaction = dlcTransactions.refundTxHex;
    this.contract.cetsHex = dlcTransactions.cetsHex;
  }

  // public async OnOfferMessage(
  //   offerMessage: OfferMessage,
  //   startingIndex: number,
  //   fixedInputs: Input[],
  // ): Promise<AcceptMessage> {
  //   this.contract = Contract.FromOfferMessage(offerMessage);
  //   this.contract.startingIndex = startingIndex;
  //   await this.Initialize(
  //     offerMessage.remoteCollateral,
  //     startingIndex,
  //     fixedInputs,
  //   );
  //   this.contract.remotePartyInputs = this.partyInputs;
  //   await this.CreateDlcTransactions();

  //   const messagesList = this.contract.messagesList;
  //   const cetsHex = this.contract.cetsHex;

  //   const chunk = 100;
  //   const adaptorPairs: AdaptorPair[] = [];
  //   const adaptorSigRequestPromises: Promise<AdaptorSignatureJobResponse>[] = [];

  //   for (let i = 0, j = messagesList.length; i < j; i += chunk) {
  //     const tempMessagesList = messagesList.slice(i, i + chunk);
  //     const tempCetsHex = cetsHex.slice(i, i + chunk);

  //     const cetSignRequest: CreateCetAdaptorSignaturesRequest = {
  //       messagesList: tempMessagesList,
  //       cetsHex: tempCetsHex,
  //       privkey: this.fundPrivateKey,
  //       fundTxId: this.contract.fundTxId,
  //       localFundPubkey: offerMessage.localPartyInputs.fundPublicKey,
  //       remoteFundPubkey: this.partyInputs.fundPublicKey,
  //       fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //       oraclePubkey: this.contract.oracleInfo.publicKey,
  //       oracleRValues: this.contract.oracleInfo.rValues,
  //     };

  //     adaptorSigRequestPromises.push(
  //       (async () => {
  //         const response = await this.client.CreateCetAdaptorSignatures(
  //           cetSignRequest,
  //         );
  //         return { index: i, response };
  //       })(),
  //     );
  //   }

  //   (await Promise.all(adaptorSigRequestPromises))
  //     .sort((a, b) => a.index - b.index)
  //     .forEach((r) => {
  //       adaptorPairs.push(...r.response.adaptorPairs);
  //     });

  //   const refundSignRequest: GetRawRefundTxSignatureRequest = {
  //     refundTxHex: this.contract.refundTransaction,
  //     privkey: this.fundPrivateKey,
  //     fundTxId: this.contract.fundTxId,
  //     localFundPubkey: offerMessage.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.partyInputs.fundPublicKey,
  //     fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //   };

  //   const refundSignature = await this.client.GetRawRefundTxSignature(
  //     refundSignRequest,
  //   );

  //   const acceptMessage = new AcceptMessage(
  //     this.contract.id,
  //     this.partyInputs,
  //     adaptorPairs,
  //     refundSignature.hex,
  //   );

  //   return acceptMessage;
  // }

  // public async OnAcceptMessage(
  //   acceptMessage: AcceptMessage,
  // ): Promise<SignMessage> {
  //   this.contract.ApplyAcceptMessage(acceptMessage);
  //   await this.CreateDlcTransactions();

  //   const messagesList = this.contract.messagesList;
  //   const cetsHex = this.contract.cetsHex;

  //   const chunk = 100;
  //   const sigsValidity: Promise<boolean>[] = [];

  //   for (let i = 0, j = messagesList.length; i < j; i += chunk) {
  //     const tempMessagesList = messagesList.slice(i, i + chunk);
  //     const tempCetsHex = cetsHex.slice(i, i + chunk);
  //     const tempAdaptorPairs = acceptMessage.cetAdaptorPairs.slice(
  //       i,
  //       i + chunk,
  //     );

  //     const verifyCetAdaptorSignaturesRequest: VerifyCetAdaptorSignaturesRequest = {
  //       cetsHex: tempCetsHex,
  //       messagesList: tempMessagesList,
  //       oraclePubkey: this.contract.oracleInfo.publicKey,
  //       oracleRValues: this.contract.oracleInfo.rValues,
  //       adaptorPairs: tempAdaptorPairs,
  //       localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //       remoteFundPubkey: acceptMessage.remotePartyInputs.fundPublicKey,
  //       fundTxId: this.contract.fundTxId,
  //       fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //       verifyRemote: true,
  //     };

  //     sigsValidity.push(
  //       (async () => {
  //         const response = await this.client.VerifyCetAdaptorSignatures(
  //           verifyCetAdaptorSignaturesRequest,
  //         );
  //         return response.valid;
  //       })(),
  //     );
  //   }

  //   let areSigsValid = (await Promise.all(sigsValidity)).every((b) => b);

  //   const verifyRefundSigRequest: VerifyRefundTxSignatureRequest = {
  //     refundTxHex: this.contract.refundTransaction,
  //     signature: acceptMessage.refundSignature,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: acceptMessage.remotePartyInputs.fundPublicKey,
  //     fundTxId: this.contract.fundTxId,
  //     fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //     verifyRemote: true,
  //   };

  //   areSigsValid =
  //     areSigsValid &&
  //     (await this.client.VerifyRefundTxSignature(verifyRefundSigRequest)).valid;

  //   if (!areSigsValid) {
  //     throw new Error('Invalid signatures received');
  //   }

  //   const cetAdaptorPairs: AdaptorPair[] = [];
  //   const adaptorSigRequestPromises: Promise<AdaptorSignatureJobResponse>[] = [];
  //   for (let i = 0, j = messagesList.length; i < j; i += chunk) {
  //     const tempMessagesList = messagesList.slice(i, i + chunk);
  //     const tempCetsHex = cetsHex.slice(i, i + chunk);

  //     const cetSignRequest: CreateCetAdaptorSignaturesRequest = {
  //       messagesList: tempMessagesList,
  //       cetsHex: tempCetsHex,
  //       privkey: this.fundPrivateKey,
  //       fundTxId: this.contract.fundTxId,
  //       localFundPubkey: this.partyInputs.fundPublicKey,
  //       remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //       fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //       oraclePubkey: this.contract.oracleInfo.publicKey,
  //       oracleRValues: this.contract.oracleInfo.rValues,
  //     };
  //     adaptorSigRequestPromises.push(
  //       (async () => {
  //         const response = await this.client.CreateCetAdaptorSignatures(
  //           cetSignRequest,
  //         );
  //         return { index: i, response };
  //       })(),
  //     );
  //   }

  //   (await Promise.all(adaptorSigRequestPromises))
  //     .sort((a, b) => a.index - b.index)
  //     .forEach((r) => {
  //       cetAdaptorPairs.push(...r.response.adaptorPairs);
  //     });

  //   const refundSignRequest: GetRawRefundTxSignatureRequest = {
  //     refundTxHex: this.contract.refundTransaction,
  //     privkey: this.fundPrivateKey,
  //     fundTxId: this.contract.fundTxId,
  //     localFundPubkey: this.partyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //     fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //   };

  //   const refundSignature = (
  //     await this.client.GetRawRefundTxSignature(refundSignRequest)
  //   ).hex;

  //   const fundTxSigs = await Promise.all(
  //     this.partyInputs.utxos.map(async (input, index) => {
  //       const fundTxSignRequest: GetRawFundTxSignatureRequest = {
  //         fundTxHex: this.contract.fundTxHex,
  //         privkey: this.inputPrivateKeys[index],
  //         prevTxId: input.txid,
  //         prevVout: input.vout,
  //         amount: input.amount.GetSatoshiAmount(),
  //       };

  //       return (await this.client.GetRawFundTxSignature(fundTxSignRequest)).hex;
  //     }),
  //   );

  //   this.contract.refundLocalSignature = refundSignature;

  //   const inputPubKeys = await Promise.all(
  //     this.inputPrivateKeys.map(async (privkey) => {
  //       const reqPrivKey = {
  //         privkey,
  //         isCompressed: true,
  //       };

  //       return (await this.client.getMethod('GetPubkeyFromPrivkey')(reqPrivKey))
  //         .pubkey;
  //     }),
  //   );

  //   return new SignMessage(
  //     this.contract.id,
  //     fundTxSigs,
  //     cetAdaptorPairs,
  //     refundSignature,
  //     inputPubKeys,
  //   );
  // }

  // public async OnSignMessage(signMessage: SignMessage): Promise<string> {
  //   this.contract.ApplySignMessage(signMessage);

  //   const messagesList = this.contract.messagesList;
  //   const cetsHex = this.contract.cetsHex;
  //   const adaptorPairs = this.contract.cetAdaptorPairs;

  //   const chunk = 100;
  //   const sigsValidity: Promise<boolean>[] = [];

  //   for (let i = 0, j = messagesList.length; i < j; i += chunk) {
  //     const tempMessagesList = messagesList.slice(i, i + chunk);
  //     const tempCetsHex = cetsHex.slice(i, i + chunk);
  //     const tempAdaptorPairs = adaptorPairs.slice(i, i + chunk);

  //     const verifyCetAdaptorSignaturesRequest: VerifyCetAdaptorSignaturesRequest = {
  //       cetsHex: tempCetsHex,
  //       messagesList: tempMessagesList,
  //       adaptorPairs: tempAdaptorPairs,
  //       localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //       remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //       fundTxId: this.contract.fundTxId,
  //       fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //       verifyRemote: false,
  //       oraclePubkey: this.contract.oracleInfo.publicKey,
  //       oracleRValues: this.contract.oracleInfo.rValues,
  //     };

  //     sigsValidity.push(
  //       (async () => {
  //         const response = await this.client.VerifyCetAdaptorSignatures(
  //           verifyCetAdaptorSignaturesRequest,
  //         );
  //         return response.valid;
  //       })(),
  //     );
  //   }

  //   let areSigsValid = (await Promise.all(sigsValidity)).every((b) => b);

  //   const verifyRefundSigRequest: VerifyRefundTxSignatureRequest = {
  //     refundTxHex: this.contract.refundTransaction,
  //     signature: this.contract.refundLocalSignature,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //     fundTxId: this.contract.fundTxId,
  //     fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //     verifyRemote: false,
  //   };

  //   areSigsValid =
  //     areSigsValid &&
  //     (await this.client.VerifyRefundTxSignature(verifyRefundSigRequest)).valid;

  //   if (!areSigsValid) {
  //     throw new Error('Invalid signatures received');
  //   }

  //   let fundTxHex = this.contract.fundTxHex;

  //   await asyncForEach(
  //     this.partyInputs.utxos,
  //     async (input: any, i: number) => {
  //       const fundSignRequest: SignFundTransactionRequest = {
  //         fundTxHex,
  //         privkey: this.inputPrivateKeys[i],
  //         prevTxId: input.txid,
  //         prevVout: input.vout,
  //         amount: input.amount.GetSatoshiAmount(),
  //       };

  //       fundTxHex = (await this.client.SignFundTransaction(fundSignRequest))
  //         .hex;
  //     },
  //   );

  //   await asyncForEach(
  //     signMessage.fundTxSignatures,
  //     async (signature: any, index: number) => {
  //       const addSignRequest: AddSignatureToFundTransactionRequest = {
  //         fundTxHex,
  //         signature,
  //         prevTxId: this.contract.localPartyInputs.utxos[index].txid,
  //         prevVout: this.contract.localPartyInputs.utxos[index].vout,
  //         pubkey: signMessage.utxoPublicKeys[index],
  //       };
  //       fundTxHex = (
  //         await this.client.AddSignatureToFundTransaction(addSignRequest)
  //       ).hex;
  //     },
  //   );

  //   let fundTxHash;
  //   try {
  //     fundTxHash = await this.client.getMethod('sendRawTransaction')(fundTxHex);
  //   } catch (sendTxError) {
  //     const cetTxid = decodeRawTransaction(fundTxHex).txid;

  //     try {
  //       fundTxHash = (
  //         await this.client.getMethod('getTransactionByHash')(cetTxid)
  //       ).hash;

  //       console.log('Fund Tx already created');
  //     } catch (e) {
  //       throw Error(
  //         `Failed to sendRawTransaction fundTxHex and tx has not been previously broadcast. Error: ${sendTxError} | fundTxHex: ${fundTxHex}`,
  //       );
  //     }
  //   }

  //   return fundTxHash;
  // }

  // public async SignAndBroadcastCet(
  //   outcomeIndex: number,
  //   oracleSignatures: string[],
  // ) {
  //   const signCetRequest: SignCetRequest = {
  //     cetHex: this.contract.cetsHex[outcomeIndex],
  //     fundPrivkey: this.fundPrivateKey,
  //     fundTxId: this.contract.fundTxId,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //     oracleSignatures,
  //     fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //     adaptorSignature: this.contract.cetAdaptorPairs[outcomeIndex].signature,
  //   };

  //   const finalCet = (await this.client.SignCet(signCetRequest)).hex;

  //   let cetTxHash;
  //   try {
  //     cetTxHash = await this.client.getMethod('sendRawTransaction')(finalCet);
  //   } catch (e) {
  //     const cetTxid = decodeRawTransaction(finalCet).txid;

  //     try {
  //       cetTxHash = (
  //         await this.client.getMethod('getTransactionByHash')(cetTxid)
  //       ).hash;

  //       console.log('Cet Tx already created');
  //     } catch (e) {
  //       throw Error(
  //         `Failed to sendRawTransaction cetHex and tx has not been previously broadcast. cetHex: ${finalCet}`,
  //       );
  //     }
  //   }

  //   return cetTxHash;
  // }

  // public async InitiateEarlyExit(
  //   outputs: Output[],
  // ): Promise<MutualClosingMessage> {
  //   const { vout, multisig } = await this.CheckMultisigPubkeyOrdering();

  //   const txouts = outputs.map((output) => {
  //     return {
  //       address: output.address,
  //       amount: output.amount.GetSatoshiAmount(),
  //     };
  //   });

  //   const createRawTransactionRequest: CreateRawTransactionRequest = {
  //     version: 2,
  //     locktime: 0,
  //     txins: [
  //       {
  //         txid: this.contract.fundTxId,
  //         vout,
  //         sequence: 4294967295,
  //       },
  //     ],
  //     txouts,
  //   };
  //   const rawTx = await this.client.getMethod('CreateRawTransaction')(
  //     createRawTransactionRequest,
  //   );

  //   const createSignatureHashRequest: CreateSignatureHashRequest = {
  //     tx: rawTx.hex,
  //     txin: {
  //       txid: this.contract.fundTxId,
  //       vout: vout,
  //       keyData: {
  //         hex: multisig.witnessScript,
  //         type: 'redeem_script',
  //       },
  //       amount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //       hashType: 'p2wsh',
  //       sighashType: 'all',
  //       sighashAnyoneCanPay: false,
  //     },
  //   };
  //   const sighash = await this.client.getMethod('CreateSignatureHash')(
  //     createSignatureHashRequest,
  //   );

  //   const calculateEcSignatureRequest: CalculateEcSignatureRequest = {
  //     sighash: sighash.sighash,
  //     privkeyData: {
  //       privkey: this.fundPrivateKey,
  //       wif: false,
  //       network: 'regtest',
  //     },
  //     isGrindR: true,
  //   };
  //   const signature = await this.client.getMethod('CalculateEcSignature')(
  //     calculateEcSignatureRequest,
  //   );

  //   return new MutualClosingMessage(outputs, signature.signature);
  // }

  // public async OnMutualClose(
  //   mutualClosingMessage: MutualClosingMessage,
  // ): Promise<string> {
  //   const {
  //     localPubkey,
  //     remotePubkey,
  //     vout,
  //     multisig,
  //   } = await this.CheckMultisigPubkeyOrdering();

  //   const txouts = mutualClosingMessage.outputs.map((output) => {
  //     return {
  //       address: output.address,
  //       amount: output.amount.GetSatoshiAmount(),
  //     };
  //   });

  //   const createRawTransactionRequest: CreateRawTransactionRequest = {
  //     version: 2,
  //     locktime: 0,
  //     txins: [
  //       {
  //         txid: this.contract.fundTxId,
  //         vout,
  //         sequence: 4294967295,
  //       },
  //     ],
  //     txouts,
  //   };
  //   const rawTx = await this.client.getMethod('CreateRawTransaction')(
  //     createRawTransactionRequest,
  //   );

  //   const createSignatureHashRequest: CreateSignatureHashRequest = {
  //     tx: rawTx.hex,
  //     txin: {
  //       txid: this.contract.fundTxId,
  //       vout: vout,
  //       keyData: {
  //         hex: multisig.witnessScript,
  //         type: 'redeem_script',
  //       },
  //       amount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //       hashType: 'p2wsh',
  //       sighashType: 'all',
  //       sighashAnyoneCanPay: false,
  //     },
  //   };
  //   const sighash = await this.client.getMethod('CreateSignatureHash')(
  //     createSignatureHashRequest,
  //   );

  //   const verifySignatureRequest: VerifySignatureRequest = {
  //     tx: rawTx.hex,
  //     txin: {
  //       txid: this.contract.fundTxId,
  //       vout,
  //       signature: mutualClosingMessage.signature,
  //       pubkey: this.contract.isLocalParty ? remotePubkey : localPubkey,
  //       redeemScript: multisig.witnessScript,
  //       hashType: 'p2wsh',
  //       sighashType: 'all',
  //       sighashAnyoneCanPay: false,
  //       amount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //     },
  //   };
  //   const isSigValid = await this.client.getMethod('VerifySignature')(
  //     verifySignatureRequest,
  //   );

  //   if (!isSigValid) {
  //     throw new Error('Invalid signature received');
  //   }

  //   const calculateEcSignatureRequest: CalculateEcSignatureRequest = {
  //     sighash: sighash.sighash,
  //     privkeyData: {
  //       privkey: this.fundPrivateKey,
  //       wif: false,
  //       network: 'regtest',
  //     },
  //     isGrindR: true,
  //   };
  //   const signature = await this.client.getMethod('CalculateEcSignature')(
  //     calculateEcSignatureRequest,
  //   );

  //   const signatureList: PubkeySignData[] = [
  //     {
  //       hex: this.contract.isLocalParty
  //         ? signature.signature
  //         : mutualClosingMessage.signature,
  //       derEncode: true,
  //       sighashType: 'all',
  //       sighashAnyoneCanPay: false,
  //       relatedPubkey: localPubkey,
  //     },
  //     {
  //       hex: this.contract.isLocalParty
  //         ? mutualClosingMessage.signature
  //         : signature.signature,
  //       derEncode: true,
  //       sighashType: 'all',
  //       sighashAnyoneCanPay: false,
  //       relatedPubkey: remotePubkey,
  //     },
  //   ];

  //   const addMultisigSignRequest: AddMultisigSignRequest = {
  //     tx: rawTx.hex,
  //     txin: {
  //       txid: this.contract.fundTxId,
  //       vout,
  //       signParams: signatureList,
  //       hashType: 'p2wsh',
  //       witnessScript: multisig.witnessScript,
  //     },
  //   };
  //   const signedTxHex = (
  //     await this.client.getMethod('AddMultisigSign')(addMultisigSignRequest)
  //   ).hex;

  //   let exitTxHash;
  //   try {
  //     exitTxHash = await this.client.getMethod('sendRawTransaction')(
  //       signedTxHex,
  //     );
  //   } catch (e) {
  //     const exitTxid = decodeRawTransaction(signedTxHex).txid;

  //     try {
  //       exitTxHash = (
  //         await this.client.getMethod('getTransactionByHash')(exitTxid)
  //       ).hash;

  //       console.log('Cet Tx already created');
  //     } catch (e) {
  //       throw Error(
  //         `Failed to sendRawTransaction cetHex and tx has not been previously broadcast. cetHex: ${signedTxHex}`,
  //       );
  //     }
  //   }

  //   return exitTxHash;
  // }

  // public async Refund() {
  //   const { localPubkeyFirst } = await this.CheckMultisigPubkeyOrdering();

  //   const signatures = localPubkeyFirst
  //     ? [
  //         this.contract.refundLocalSignature,
  //         this.contract.refundRemoteSignature,
  //       ]
  //     : [
  //         this.contract.refundRemoteSignature,
  //         this.contract.refundLocalSignature,
  //       ];

  //   const addSigsToRefundTxRequest: AddSignaturesToRefundTxRequest = {
  //     refundTxHex: this.contract.refundTransaction,
  //     signatures,
  //     fundTxId: this.contract.fundTxId,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //   };

  //   const refundHex = (
  //     await this.client.AddSignaturesToRefundTx(addSigsToRefundTxRequest)
  //   ).hex;

  //   let refundTxHash;
  //   try {
  //     refundTxHash = await this.client.getMethod('sendRawTransaction')(
  //       refundHex,
  //     );
  //   } catch (e) {
  //     const refundTxid = decodeRawTransaction(refundHex).txid;

  //     try {
  //       refundTxHash = (
  //         await this.client.getMethod('getTransactionByHash')(refundTxid)
  //       ).hash;

  //       console.log('Cet Tx already created');
  //     } catch (e) {
  //       throw Error(
  //         `Failed to sendRawTransaction cetHex and tx has not been previously broadcast. cetHex: ${refundHex}`,
  //       );
  //     }
  //   }

  //   return refundTxHash;
  // }
}

interface MultisigAndOrdering {
  localPubkeyFirst: boolean;
  vout: number;
  localPubkey: string;
  remotePubkey: string;
  multisig: CreateMultisigResponse;
}

const BurnAddress = 'bcrt1qxcjufgh2jarkp2qkx68azh08w9v5gah8u6es8s';
