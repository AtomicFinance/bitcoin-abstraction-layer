import Provider from '@atomicfinance/provider';
import { decodeRawTransaction } from '@liquality/bitcoin-utils';
import PartyInputs from './PartyInputs';
import Contract from './Contract';
import Amount from './Amount';
import Utxo from './Utxo';
import {
  CreateMultisigRequest
} from '../@types/cfd-js'
import {
  CreateDlcTransactionsRequest,
  CreateCetAdaptorSignaturesRequest,
  CreateCetAdaptorSignatureRequest,
  CreateCetAdaptorSignaturesResponse,
  // CalculateCetAdaptorSignaturesRequest,
  GetRawRefundTxSignatureRequest,
  AdaptorPair,
  // VerifyCetSignaturesRequest,
  VerifyRefundTxSignatureRequest,
  GetRawFundTxSignatureRequest,
  SignFundTransactionRequest,
  AddSignatureToFundTransactionRequest,
  // GetRawMutualClosingTxSignatureRequest,
  // AddSignaturesToMutualClosingTxRequest,
  // GetRawCetSignatureRequest,
  // AddSignaturesToCetRequest,
  // CreateClosingTransactionRequest,
  // SignClosingTransactionRequest,
  CreateRefundTransactionRequest,
  AddSignaturesToRefundTxRequest,
  VerifyCetAdaptorSignaturesRequest,
  SignCetRequest
} from '../@types/cfd-dlc-js';
import Input from './Input'
import OfferMessage from './OfferMessage';
import AcceptMessage from './AcceptMessage';
import SignMessage from './SignMessage';
import Outcome from './Outcome';
import MutualClosingMessage from './MutualClosingMessage';
import BitcoinDlcProvider from '../BitcoinDlcProvider';
import { sleep } from '@liquality/utils';
import { asyncForEach } from '../utils/Utils'

const ESTIMATED_SIZE = 312;

export default class DlcParty {
  readonly client: BitcoinDlcProvider;
  readonly passphrase: string;

  readonly dlcProvider: Provider;

  partyInputs: PartyInputs;
  fundPrivateKey: string;
  sweepPrivateKey: string;
  inputPrivateKeys: string[];
  contract: Contract;

  constructor(client: BitcoinDlcProvider) {
    this.client = client;
  }

  public async InitiateContract(
    initialContract: Contract,
    startingIndex: number,
    fixedInputs: Input[]
  ): Promise<OfferMessage> {
    this.contract = initialContract;
    await this.Initialize(this.contract.localCollateral, startingIndex, fixedInputs);
    this.contract.localPartyInputs = this.partyInputs;
    return this.contract.GetOfferMessage();
  }

  public async ImportContract(initialContract: Contract, startingIndex: number = 0) {
    this.contract = initialContract;
    if (!this.contract.startingIndex) {
      this.contract.startingIndex = startingIndex
    }
    await this.Initialize(
      this.contract.localCollateral,
      this.contract.startingIndex,
      [],
      false
    );
  }

  private async Initialize(
    collateral: Amount,
    startingIndex: number,
    fixedInputs: Input[],
    checkUtxos: boolean = true
  ) {
    const addresses = await this.client.getMethod('getAddresses')(
      startingIndex,
      2,
      false
    );
    const changeAddresses = await this.client.getMethod('getAddresses')(
      startingIndex,
      2,
      true
    );

    const changeAddress = changeAddresses[0].address;
    const finalAddress = addresses[0].address;

    const fundPrivateKeyPair = await this.client.getMethod('keyPair')(
      addresses[1].derivationPath
    );
    const sweepPrivateKeyPair = await this.client.getMethod('keyPair')(
      changeAddresses[1].derivationPath
    );

    this.fundPrivateKey = Buffer.from(fundPrivateKeyPair.__D).toString('hex');
    this.sweepPrivateKey = Buffer.from(sweepPrivateKeyPair.__D).toString('hex');

    const fundPublicKey = addresses[1].publicKey.toString('hex');
    const sweepPublicKey = changeAddresses[1].publicKey.toString('hex');

    let fundTxCreated = false
    if (this.contract.fundTxHex) {
      const network = await this.client.getMethod('getConnectedNetwork')();
      const fundTx = await decodeRawTransaction(this.contract.fundTxHex, network)
      const refundTx = await decodeRawTransaction(this.contract.refundTransaction, network);
      const fundAddress = fundTx.vout[refundTx.vin[0].vout].scriptPubKey.addresses

      const balance = await this.client.getMethod('getBalance')(fundAddress)
      if (balance.gt(0)) {
        fundTxCreated = true
      }
    }

    let utxos: Utxo[] = [];
    if (checkUtxos === true || !this.contract.fundTxHex || !fundTxCreated) {
      if (this.contract.isLocalParty && this.contract.localPartyInputs?.utxos.length > 0) {
        utxos = this.contract.localPartyInputs.utxos
      } else if (!this.contract.isLocalParty && this.contract.remotePartyInputs?.utxos.length > 0) {
        utxos = this.contract.remotePartyInputs.utxos
      } else {
        utxos = await this.GetUtxosForAmount(collateral, fixedInputs);
      }
    } else {
      utxos = await this.GetFundingUtxos(startingIndex);
    }

    const inputs = new PartyInputs(
      fundPublicKey,
      sweepPublicKey,
      changeAddress,
      finalAddress,
      utxos
    );

    this.inputPrivateKeys = await this.GetPrivKeysForUtxos(inputs.utxos);
    this.partyInputs = inputs;
  }

  private async GetUtxosForAmount(amount: Amount, fixedInputs: Input[]) {
    if (amount.GetSatoshiAmount() === 0) { return [] }
    const outputs = [{ to: BurnAddress, value: (amount.GetSatoshiAmount() + ESTIMATED_SIZE * (this.contract.feeRate - 1)) }];
    let utxos
    try {
      const inputsForAmount = await this.client.getMethod('getInputsForAmount')(
        outputs,
        1,
        fixedInputs
      );
      utxos = inputsForAmount.inputs
    } catch(e) {
      if (fixedInputs.length === 0) {
        throw Error('Not enough balance getInputsForAmount')
      } else {
        utxos = fixedInputs
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
      'DecodeRawTransaction'
    )({ hex: this.contract.fundTxHex });

    let utxos: Utxo[] = [];
    for (let i = 0; i < fundTransaction.vin.length; i++) {
      const vin = fundTransaction.vin[i];

      const vinRawTx = await this.client.getMethod('getRawTransactionByHash')(
        vin.txid
      );

      const network = await this.client.getMethod('getConnectedNetwork')();

      const vinTx = await decodeRawTransaction(vinRawTx, network);

      const addresses = await this.client.getMethod('getAddresses')(
        startingIndex,
        1,
        false
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
        utxo.derivationPath
      );
      const privKey = Buffer.from(keyPair.__D).toString('hex');
      privKeys.push(privKey);
    }

    return privKeys;
  }

  private async CreateDlcTransactions() {
    const localFinalScriptPubkey = await this.client.getMethod('GetAddressScript')(
      this.contract.localPartyInputs.finalAddress
    )
    const remoteFinalScriptPubkey = await this.client.getMethod('GetAddressScript')(
      this.contract.remotePartyInputs.finalAddress
    )
    const localChangeScriptPubkey = await this.client.getMethod('GetAddressScript')(
      this.contract.localPartyInputs.changeAddress
    )
    const remoteChangeScriptPubkey = await this.client.getMethod('GetAddressScript')(
      this.contract.remotePartyInputs.changeAddress
    )

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
      refundLocktime: this.contract.refundLockTime,
      localInputs: this.contract.localPartyInputs.utxos,
      remoteInputs: this.contract.remotePartyInputs.utxos,
      localChangeScriptPubkey,
      remoteChangeScriptPubkey,
      feeRate: this.contract.feeRate
    };

    console.log('dlctxrequest', dlcTxRequest)

    const dlcTransactions = await this.client.CreateDlcTransactions(
      dlcTxRequest
    );
    this.contract.fundTxHex = dlcTransactions.fundTxHex;
    const fundTransaction = await this.client.getMethod(
      'DecodeRawTransaction'
    )({ hex: this.contract.fundTxHex });
    this.contract.fundTxId = fundTransaction.txid;
    this.contract.fundTxOutAmount = Amount.FromSatoshis(
      Number(fundTransaction.vout[0].value)
    );
    this.contract.refundTransaction = dlcTransactions.refundTxHex;
    this.contract.cetsHex = dlcTransactions.cetsHex;
  }

  public async OnOfferMessage(
    offerMessage: OfferMessage,
    startingIndex: number,
    fixedInputs: Input[]
  ): Promise<AcceptMessage> {
    console.time("from offer message");
    this.contract = Contract.FromOfferMessage(offerMessage);
    console.timeEnd("from offer message");
    this.contract.startingIndex = startingIndex;
    await this.Initialize(offerMessage.remoteCollateral, startingIndex, fixedInputs);
    this.contract.remotePartyInputs = this.partyInputs;
    console.time("create dlc txs");
    await this.CreateDlcTransactions();
    console.timeEnd("create dlc txs");

    console.log('this.contract.messagesList.length', this.contract.messagesList.length)

    const cetSignRequest: CreateCetAdaptorSignaturesRequest = {
      messagesList: this.contract.messagesList,
      cetsHex: this.contract.cetsHex,
      privkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: offerMessage.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.partyInputs.fundPublicKey,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      oraclePubkey: this.contract.oracleInfo.publicKey,
      oracleRValues: this.contract.oracleInfo.rValues
    }

    console.log('cetSignRequest', cetSignRequest)

    const cetSignatures: CreateCetAdaptorSignaturesResponse = await this.client.CreateCetAdaptorSignatures(cetSignRequest)

    const refundSignRequest: GetRawRefundTxSignatureRequest = {
      refundTxHex: this.contract.refundTransaction,
      privkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: offerMessage.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.partyInputs.fundPublicKey,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    };

    const refundSignature = await this.client.GetRawRefundTxSignature(
      refundSignRequest
    );

    const acceptMessage = new AcceptMessage(
      this.contract.id,
      this.partyInputs,
      cetSignatures.adaptorPairs,
      refundSignature.hex
    );

    return acceptMessage;
  }

  public async OnAcceptMessage(
    acceptMessage: AcceptMessage
  ): Promise<SignMessage> {
    this.contract.ApplyAcceptMessage(acceptMessage);
    await this.CreateDlcTransactions();

    console.log('test1')

    const verifyCetAdaptorSignaturesRequest: VerifyCetAdaptorSignaturesRequest = {
      cetsHex: this.contract.cetsHex,
      messagesList: this.contract.messagesList,
      oraclePubkey: this.contract.oracleInfo.publicKey,
      oracleRValues: this.contract.oracleInfo.rValues,
      adaptorPairs: acceptMessage.cetAdaptorPairs,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: acceptMessage.remotePartyInputs.fundPublicKey,
      fundTxId: this.contract.fundTxId,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      verifyRemote: true,
    };

    console.log('test2')

    let areSigsValid = (
      await this.client.VerifyCetAdaptorSignatures(verifyCetAdaptorSignaturesRequest)
    ).valid;

    console.log('test3')

    const verifyRefundSigRequest: VerifyRefundTxSignatureRequest = {
      refundTxHex: this.contract.refundTransaction,
      signature: acceptMessage.refundSignature,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: acceptMessage.remotePartyInputs.fundPublicKey,
      fundTxId: this.contract.fundTxId,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      verifyRemote: true,
    };

    console.log('test4')

    areSigsValid =
      areSigsValid &&
      (await this.client.VerifyRefundTxSignature(verifyRefundSigRequest)).valid;

    if (!areSigsValid) {
      throw new Error('Invalid signatures received');
    }

    console.log('test5')

    // const cetSignRequest: CreateCetAdaptorSignaturesRequest = {
    //   messagesList: this.contract.messagesList,
    //   cetsHex: this.contract.cetsHex,
    //   privkey: this.fundPrivateKey,
    //   fundTxId: this.contract.fundTxId,
    //   localFundPubkey: offerMessage.localPartyInputs.fundPublicKey,
    //   remoteFundPubkey: this.partyInputs.fundPublicKey,
    //   fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    //   oraclePubkey: this.contract.oracleInfo.publicKey,
    //   oracleRValues: this.contract.oracleInfo.rValues
    // }

    console.log('this.contract.messagesList[0]', this.contract.messagesList[0])

    const cetAdaptorSignRequest: CreateCetAdaptorSignaturesRequest = {
      messagesList: this.contract.messagesList,
      cetsHex: this.contract.cetsHex,
      privkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxHex,
      localFundPubkey: this.partyInputs.fundPublicKey,
      remoteFundPubkey: acceptMessage.remotePartyInputs.fundPublicKey,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      oraclePubkey: this.contract.oracleInfo.publicKey,
      oracleRValues: this.contract.oracleInfo.rValues
    }

    console.log('cetAdaptorSignRequest', cetAdaptorSignRequest)

    console.log('test6')

    const cetAdaptorPairs = (
      await this.client.CreateCetAdaptorSignatures(cetAdaptorSignRequest)
    ).adaptorPairs;

    // const cetAdaptorPairs = await Promise.all(
    //   this.contract.messagesList.map(async (messages, i) => {
    //     const cetAdaptorSignRequest: CreateCetAdaptorSignatureRequest = {
    //       messages: messages.messages,
    //       cetHex: this.contract.cetsHex[i],
    //       privkey: this.fundPrivateKey,
    //       fundTxId: this.contract.fundTxHex,
    //       localFundPubkey: this.partyInputs.fundPublicKey,
    //       remoteFundPubkey: acceptMessage.remotePartyInputs.fundPublicKey,
    //       fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    //       oraclePubkey: this.contract.oracleInfo.publicKey,
    //       oracleRValues: this.contract.oracleInfo.rValues
    //     }

    //     const adaptorPair = await this.client.CreateCetAdaptorSignature(cetAdaptorSignRequest)

    //     return adaptorPair
    //   })
    // )

    console.log('test7')

    const refundSignRequest: GetRawRefundTxSignatureRequest = {
      refundTxHex: this.contract.refundTransaction,
      privkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: this.partyInputs.fundPublicKey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    };

    const refundSignature = (
      await this.client.GetRawRefundTxSignature(refundSignRequest)
    ).hex;

    const fundTxSigs = await Promise.all(
      this.partyInputs.utxos.map(async (input, index) => {
        const fundTxSignRequest: GetRawFundTxSignatureRequest = {
          fundTxHex: this.contract.fundTxHex,
          privkey: this.inputPrivateKeys[index],
          prevTxId: input.txid,
          prevVout: input.vout,
          amount: input.amount.GetSatoshiAmount(),
        };

        return (await this.client.GetRawFundTxSignature(fundTxSignRequest)).hex;
      })
    );

    this.contract.refundLocalSignature = refundSignature;

    const inputPubKeys = await Promise.all(
      this.inputPrivateKeys.map(async (privkey) => {
        const reqPrivKey = {
          privkey,
          isCompressed: true,
        };

        return (await this.client.getMethod('GetPubkeyFromPrivkey')(reqPrivKey))
          .pubkey;
      })
    );

    return new SignMessage(
      this.contract.id,
      fundTxSigs,
      cetAdaptorPairs,
      refundSignature,
      inputPubKeys
    );
  }

  public async OnSignMessage(signMessage: SignMessage): Promise<string> {
    this.contract.ApplySignMessage(signMessage);

    const verifyCetSignaturesRequest: VerifyCetAdaptorSignaturesRequest = {
      cetsHex: this.contract.cetsHex,
      adaptorPairs: this.contract.cetAdaptorPairs,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      fundTxId: this.contract.fundTxId,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      verifyRemote: false,
      messagesList: this.contract.messagesList,
      oraclePubkey: this.contract.oracleInfo.publicKey,
      oracleRValues: this.contract.oracleInfo.rValues
    };

    let areSigsValid = (
      await this.client.VerifyCetAdaptorSignatures(verifyCetSignaturesRequest)
    ).valid;

    const verifyRefundSigRequest: VerifyRefundTxSignatureRequest = {
      refundTxHex: this.contract.refundTransaction,
      signature: this.contract.refundLocalSignature,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      fundTxId: this.contract.fundTxId,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      verifyRemote: false,
    };

    areSigsValid =
      areSigsValid &&
      (await this.client.VerifyRefundTxSignature(verifyRefundSigRequest)).valid;

    if (!areSigsValid) {
      throw new Error('Invalid signatures received');
    }

    let fundTxHex = this.contract.fundTxHex;

    await asyncForEach(
      this.partyInputs.utxos,
      async (input: any, i: number) => {
        const fundSignRequest: SignFundTransactionRequest = {
          fundTxHex,
          privkey: this.inputPrivateKeys[i],
          prevTxId: input.txid,
          prevVout: input.vout,
          amount: input.amount.GetSatoshiAmount(),
        };

        fundTxHex = (await this.client.SignFundTransaction(fundSignRequest))
          .hex;
      }
    );

    await asyncForEach(
      signMessage.fundTxSignatures,
      async (signature: any, index: number) => {
        const addSignRequest: AddSignatureToFundTransactionRequest = {
          fundTxHex,
          signature,
          prevTxId: this.contract.localPartyInputs.utxos[index].txid,
          prevVout: this.contract.localPartyInputs.utxos[index].vout,
          pubkey: signMessage.utxoPublicKeys[index],
        };
        fundTxHex = (
          await this.client.AddSignatureToFundTransaction(addSignRequest)
        ).hex;
      }
    );

    let fundTxHash;
    try {
      fundTxHash = await this.client.getMethod('sendRawTransaction')(fundTxHex);
    } catch (sendTxError) {
      const cetTxid = decodeRawTransaction(fundTxHex).txid;

      try {
        fundTxHash = (
          await this.client.getMethod('getTransactionByHash')(cetTxid)
        ).hash;

        console.log('Fund Tx already created');
      } catch (e) {
        throw Error(
          `Failed to sendRawTransaction fundTxHex and tx has not been previously broadcast. Error: ${sendTxError} | fundTxHex: ${fundTxHex}`
        );
      }
    }

    return fundTxHash;
  }

  public async ExitEarly() {
    const pubkey1 = this.contract.localPartyInputs.fundPublicKey
    const pubkey2 = this.contract.remotePartyInputs.fundPublicKey

    const createMultisigRequest: CreateMultisigRequest = {
      nrequired: 2,
      keys: [pubkey1, pubkey2],
      network: 'regtest',
      hashType: 'p2wsh'
    }

    const multisig = await this.client.getMethod('CreateMultisig')() .finance.cfd.CreateMultisig(createMultisigRequest)
    console.log('multisig', multisig)
  }

  public async SignAndBroadcastCet(
    outcomeIndex: number,
    oracleSignatures: string[]
  ) {
    const signCetRequest: SignCetRequest = {
      cetHex: this.contract.cetsHex[outcomeIndex],
      fundPrivkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      oracleSignatures,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      adaptorSignature: this.contract.cetAdaptorPairs[outcomeIndex].signature,
    }

    const finalCet = (await this.client.SignCet(signCetRequest)).hex;

    let cetTxHash;
    try {
      cetTxHash = await this.client.getMethod('sendRawTransaction')(finalCet);
    } catch (e) {
      const cetTxid = decodeRawTransaction(finalCet).txid;

      try {
        cetTxHash = (
          await this.client.getMethod('getTransactionByHash')(cetTxid)
        ).hash;

        console.log('Cet Tx already created');
      } catch (e) {
        throw Error(
          `Failed to sendRawTransaction cetHex and tx has not been previously broadcast. cetHex: ${finalCet}`
        );
      }
    }

    return cetTxHash;
  }

  // public async Refund () {
  //   let refundTxHex = this.contract.refundTransaction

  //   const refundSignRequest: GetRawRefundTxSignatureRequest = {
  //     refundTxHex: this.contract.refundTransaction,
  //     privkey: this.fundPrivateKey,
  //     fundTxId: this.contract.fundTxId,
  //     localFundPubkey: this.partyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //     fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //   };

  //   const refundSignature = (await this.client.GetRawRefundTxSignature(
  //     refundSignRequest
  //   )).hex;

  //   const signatures = this.contract.isLocalParty
  //     ? [refundSignature, this.contract.refundRemoteSignature]
  //     : [this.contract.refundLocalSignature, refundSignature];

  //   const addSignaturesToRefundTxRequest: AddSignaturesToRefundTxRequest = {
  //     refundTxHex,
  //     signatures,
  //     fundTxId: this.contract.fundTxId,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey
  //   }

  //   refundTxHex = (await this.client.AddSignaturesToRefundTx(addSignaturesToRefundTxRequest)).hex

  //   let refundTxHash;
  //   try {
  //     refundTxHash = await this.client.getMethod('sendRawTransaction')(refundTxHex);
  //   } catch (sendTxError) {
  //     const cetTxid = decodeRawTransaction(refundTxHash).txid;

  //     try {
  //       refundTxHash = (
  //         await this.client.getMethod('getTransactionByHash')(cetTxid)
  //       ).hash;

  //       console.log('Refund Tx already created');
  //     } catch (e) {
  //       throw Error(
  //         `Failed to sendRawTransaction refundTxHex and tx has not been previously broadcast. Error: ${sendTxError} | refundTxHex: ${refundTxHex}`
  //       );
  //     }
  //   }

  //   return refundTxHash;
  // }

  // public async CreateMutualClosingMessage(outcome: Outcome) {
  //   const mutualClosingRequest = {
  //     localFinalAddress: this.contract.localPartyInputs.finalAddress,
  //     remoteFinalAddress: this.contract.remotePartyInputs.finalAddress,
  //     localAmount: outcome.local.GetSatoshiAmount(),
  //     remoteAmount: outcome.remote.GetSatoshiAmount(),
  //     fundTxId: this.contract.fundTxId,
  //     feeRate: this.contract.feeRate,
  //   };

  //   const mutualClosingTx = (await this.client.CreateMutualClosingTransaction(
  //     mutualClosingRequest
  //   )).hex;

  //   const signRequest: GetRawMutualClosingTxSignatureRequest = {
  //     fundTxId: this.contract.fundTxId,
  //     mutualClosingHex: mutualClosingTx,
  //     privkey: this.fundPrivateKey,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //     fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //   };

  //   const signature = (await this.client.GetRawMutualClosingTxSignature(signRequest)).hex;

  //   return new MutualClosingMessage(outcome, signature);
  // }

  // public async OnMutualClosingMessage(
  //   mutualClosingMessage: MutualClosingMessage
  // ) {
  //   const mutualClosingRequest = {
  //     localFinalAddress: this.contract.localPartyInputs.finalAddress,
  //     remoteFinalAddress: this.contract.remotePartyInputs.finalAddress,
  //     localAmount: mutualClosingMessage.outcome.local.GetSatoshiAmount(),
  //     remoteAmount: mutualClosingMessage.outcome.remote.GetSatoshiAmount(),
  //     fundTxId: this.contract.fundTxId,
  //     feeRate: this.contract.feeRate,
  //   };

  //   let mutualClosingTx = bitcoin.finance.dlc.CreateMutualClosingTransaction(
  //     mutualClosingRequest
  //   ).hex;

  //   const signRequest: GetRawMutualClosingTxSignatureRequest = {
  //     fundTxId: this.contract.fundTxId,
  //     mutualClosingHex: mutualClosingTx,
  //     privkey: this.fundPrivateKey,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //     fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //   };

  //   const signature = bitcoin.finance.dlc.GetRawMutualClosingTxSignature(signRequest).hex;

  //   const signatures = this.contract.isLocalParty
  //     ? [signature, mutualClosingMessage.signature]
  //     : [mutualClosingMessage.signature, signature];

  //   const addSigsRequest: AddSignaturesToMutualClosingTxRequest = {
  //     mutualClosingTxHex: mutualClosingTx,
  //     signatures,
  //     fundTxId: this.contract.fundTxId,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //   };

  //   mutualClosingTx = bitcoin.finance.dlc.AddSignaturesToMutualClosingTx(addSigsRequest).hex;

  //   await this.walletClient.sendRawTransaction(mutualClosingTx);

  //   await this.GenerateBlocks(1);
  // }

  // public async ExecuteUnilateralClose(
  //   oracleSignature: string,
  //   outcomeIndex: number
  // ): Promise<string[]> {
  //   const [cetHex, closingTxHex] = await this.BuildUnilateralClose(
  //     oracleSignature,
  //     outcomeIndex
  //   );

  //   let cetTxHash;
  //   try {
  //     cetTxHash = await this.client.getMethod('sendRawTransaction')(cetHex);
  //   } catch (e) {
  //     const cetTxid = decodeRawTransaction(cetHex).txid;

  //     try {
  //       cetTxHash = (
  //         await this.client.getMethod('getTransactionByHash')(cetTxid)
  //       ).hash;

  //       console.log('Cet Tx already created');
  //     } catch (e) {
  //       throw Error(
  //         `Failed to sendRawTransaction cetHex and tx has not been previously broadcast. cetHex: ${cetHex}`
  //       );
  //     }
  //   }

  //   let closingTxHash;
  //   try {
  //     closingTxHash = await this.client.getMethod('sendRawTransaction')(
  //       closingTxHex
  //     );
  //   } catch (e) {
  //     const closingTxid = decodeRawTransaction(closingTxHex).txid;

  //     try {
  //       closingTxHash = (
  //         await this.client.getMethod('getTransactionByHash')(closingTxid)
  //       ).hash;

  //       console.log('Closing Tx already created');
  //     } catch (e) {
  //       throw Error(
  //         `Failed to sendRawTransaction closingTxHex and tx has not been previously broadcast. cetHex: ${closingTxHex}`
  //       );
  //     }
  //   }

  //   return [cetTxHash, closingTxHash];
  // }

  // public async BuildUnilateralClose(
  //   oracleSignature: string,
  //   outcomeIndex: number
  // ): Promise<string[]> {
  //   const cets = this.contract.isLocalParty
  //     ? this.contract.localCetsHex
  //     : this.contract.remoteCetsHex;

  //   let cetHex = cets[outcomeIndex];

  //   const signRequest: GetRawCetSignatureRequest = {
  //     cetHex,
  //     privkey: this.fundPrivateKey,
  //     fundTxId: this.contract.fundTxId,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //     fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
  //   };

  //   const cetSign = (await this.client.GetRawCetSignature(signRequest)).hex;

  //   const signatures = this.contract.isLocalParty
  //     ? [cetSign, this.contract.cetSignatures[outcomeIndex]]
  //     : [this.contract.cetSignatures[outcomeIndex], cetSign];

  //   const addSignRequest: AddSignaturesToCetRequest = {
  //     cetHex,
  //     signatures,
  //     fundTxId: this.contract.fundTxId,
  //     localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
  //     remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
  //   };

  //   cetHex = (await this.client.AddSignaturesToCet(addSignRequest)).hex;

  //   const cet = await this.client.getMethod('DecodeRawTransaction')({
  //     hex: cetHex,
  //   });

  //   const outcomeAmount = this.contract.isLocalParty
  //     ? this.contract.outcomes[outcomeIndex].local
  //     : this.contract.outcomes[outcomeIndex].remote;

  //   if (outcomeAmount.GetSatoshiAmount() === 0)
  //     throw Error('Outcome Amount should be greater than 0');

  //   const closingTxRequest: CreateClosingTransactionRequest = {
  //     address: this.partyInputs.finalAddress,
  //     amount: outcomeAmount.GetSatoshiAmount(),
  //     cetTxId: cet.txid,
  //   };

  //   let closingTxHex = (
  //     await this.client.CreateClosingTransaction(closingTxRequest)
  //   ).hex;

  //   const remoteSweepKey = this.contract.isLocalParty
  //     ? this.contract.remotePartyInputs.sweepPublicKey
  //     : this.contract.localPartyInputs.sweepPublicKey;

  //   const signClosingRequest: SignClosingTransactionRequest = {
  //     closingTxHex,
  //     cetTxId: cet.txid,
  //     amount: cet.vout[0].value,
  //     localFundPrivkey: this.fundPrivateKey,
  //     localSweepPubkey: this.partyInputs.sweepPublicKey,
  //     remoteSweepPubkey: remoteSweepKey,
  //     oraclePubkey: this.contract.oracleInfo.publicKey,
  //     oracleRPoints: [this.contract.oracleInfo.rValue],
  //     oracleSigs: [oracleSignature],
  //     messages: [this.contract.outcomes[outcomeIndex].message],
  //     csvDelay: this.contract.cetCsvDelay,
  //   };

  //   closingTxHex = (
  //     await this.client.SignClosingTransaction(signClosingRequest)
  //   ).hex;

  //   console.log('cetHex', cetHex);
  //   console.log('closingTxHex', closingTxHex);

  //   return [cetHex, closingTxHex];
  // }
}

// Put this outside the class
const BurnAddress = 'bcrt1qxcjufgh2jarkp2qkx68azh08w9v5gah8u6es8s';
