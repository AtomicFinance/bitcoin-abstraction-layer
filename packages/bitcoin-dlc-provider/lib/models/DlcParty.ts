import PartyInputs from "./PartyInputs";
import Contract from "./Contract";
// import Client from "bitcoin-core";
import Amount from "./Amount";
import Utxo from "./Utxo";
// import * as Utils from "../utils/Utils";
import {
  CreateDlcTransactionsRequest, GetRawCetSignaturesRequest, GetRawRefundTxSignatureRequest, VerifyCetSignaturesRequest,
  VerifyRefundTxSignatureRequest, GetRawFundTxSignatureRequest, SignFundTransactionRequest, AddSignatureToFundTransactionRequest,
  GetRawMutualClosingTxSignatureRequest, AddSignaturesToMutualClosingTxRequest, GetRawCetSignatureRequest, AddSignaturesToCetRequest,
  CreateClosingTransactionRequest, SignClosingTransactionRequest } from 'cfd-dlc-js-wasm'
import OfferMessage from "./OfferMessage";
import AcceptMessage from "./AcceptMessage";
import SignMessage from "./SignMessage";
import Outcome from "./Outcome";
import MutualClosingMessage from "./MutualClosingMessage";

import BitcoinDlcProvider from '../BitcoinDlcProvider'

export default class DlcParty {
  readonly client: BitcoinDlcProvider;
  readonly passphrase: string;

  readonly dlcProvider: Provider;

  partyInputs: PartyInputs;
  fundPrivateKey: string;
  sweepPrivateKey: string;
  inputPrivateKeys: string[];
  contract: Contract;

  // constructor(walletClient: Client, passphrase: string) {
  //   this.walletClient = walletClient;
  //   this.passphrase = passphrase;
  // }

  constructor(client: BitcoinDlcProvider) {
    this.client = client;
  }

  public async InitiateContract(initialContract: Contract, startingIndex: number) {
    this.contract = initialContract;
    await this.Initialize(this.contract.localCollateral, startingIndex);
    this.contract.localPartyInputs = this.partyInputs;
    return this.contract.GetOfferMessage();
  }

  private async Initialize(collateral: Amount, startingIndex: number) {
    // await this.walletClient.walletPassphrase(this.passphrase, 10);

    const addresses = await this.client.getMethod('getAddresses')(startingIndex, 2, false)
    const changeAddresses = await this.client.getMethod('getAddresses')(startingIndex, 2, true)

    const changeAddress = changeAddresses[0].address
    const finalAddress = addresses[0].address

    // const changeAddress = (await bitcoin.wallet.getUnusedAddress(true)).address
    // const finalAddress = (await bitcoin.wallet.getUnusedAddress(false)).address

    // const changeAddress = await this.walletClient.getNewAddress();
    // const finalAddress = await this.walletClient.getNewAddress();
    // this.fundPrivateKey = await this.GetNewPrivateKey();
    // this.sweepPrivateKey = await this.GetNewPrivateKey();
    // const fundPublicKey = Utils.GetPubkeyFromPrivkey(this.fundPrivateKey);
    // const sweepPublicKey = Utils.GetPubkeyFromPrivkey(this.sweepPrivateKey);

    const fundPrivateKeyPair = await this.client.getMethod('keyPair')(addresses[1].derivationPath)
    const sweepPrivateKeyPair = await this.client.getMethod('keyPair')(changeAddresses[1].derivationPath)

    this.fundPrivateKey = Buffer.from(fundPrivateKeyPair.__D).toString('hex')
    this.sweepPrivateKey = Buffer.from(sweepPrivateKeyPair.__D).toString('hex')

    const fundPublicKey = addresses[1].publicKey.toString('hex')
    const sweepPublicKey = changeAddresses[1].publicKey.toString('hex')

    const utxos = await this.GetUtxosForAmount(
      collateral
    );
    console.log('utxos', utxos)

    const address = (await this.client.getMethod('getAddresses')())[0].address
    console.log('address', address)

    const inputs = new PartyInputs(
      fundPublicKey,
      sweepPublicKey,
      changeAddress,
      finalAddress,
      utxos
    );

    this.inputPrivateKeys = await this.GetPrivKeysForUtxos(inputs.utxos)
    this.partyInputs = inputs;
  }

  private async GetUtxosForAmount (amount: Amount) {
    const outputs = [{ to: BurnAddress, value: amount.GetSatoshiAmount() }]
    const feePerByte = await this.client.getMethod('getFeePerByte')()
    const inputsForAmount = await this.client.getMethod('getInputsForAmount')(outputs, feePerByte)
    const { inputs: utxos } = inputsForAmount
    console.log('utxos', utxos)

    const utxoSet: Utxo[] = [];
    for (let i = 0; i < utxos.length; i++) {
      const utxo = utxos[i]

      utxoSet.push({
        txid: utxo.txid,
        vout: utxo.vout,
        amount: Amount.FromSatoshis(utxo.value),
        address: utxo.address,
        derivationPath: utxo.derivationPath,
        toJSON: Utxo.prototype.toJSON
      })
    }

    return utxoSet;
  }

  private async GetPrivKeysForUtxos (utxoSet: Utxo[]): Promise<string[]> {
    const privKeys: string[] = []

    for (let i = 0; i < utxoSet.length; i++) {
      const utxo = utxoSet[i]
      const keyPair = await this.client.getMethod('keyPair')(utxo.derivationPath)
      const privKey = Buffer.from(keyPair.__D).toString('hex')
      privKeys.push(privKey)
    }

    return privKeys
  }

  private async CreateDlcTransactions() {
    console.log('this.contract.localPartyInputs', this.contract.localPartyInputs)
    if (this.contract.localPartyInputs instanceof PartyInputs) {
      console.log('instanceof partyinputs')
    }

    console.log('this.contract.remotePartyInputs', this.contract.remotePartyInputs)

    console.log('this.contract.remoteCollateral', this.contract.remoteCollateral)

    const dlcTxRequest: CreateDlcTransactionsRequest = {
      outcomes: this.contract.outcomes.map((outcome) => {
        return {
          messages: [outcome.message],
          local: outcome.local.GetSatoshiAmount(),
          remote: outcome.remote.GetSatoshiAmount(),
        };
      }),
      oracleRPoints: [this.contract.oracleInfo.rValue],
      oraclePubkey: this.contract.oracleInfo.publicKey,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      localSweepPubkey: this.contract.localPartyInputs.sweepPublicKey,
      localFinalAddress: this.contract.localPartyInputs.finalAddress,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      remoteSweepPubkey: this.contract.remotePartyInputs.sweepPublicKey,
      remoteFinalAddress: this.contract.remotePartyInputs.finalAddress,
      localInputAmount: this.contract.localPartyInputs.GetTotalInputAmount(),
      localCollateralAmount: this.contract.localCollateral.GetSatoshiAmount(),
      remoteInputAmount: this.contract.remotePartyInputs.GetTotalInputAmount(),
      remoteCollateralAmount: this.contract.remoteCollateral.GetSatoshiAmount(),
      csvDelay: this.contract.cetCsvDelay,
      refundLocktime: this.contract.refundLockTime,
      localInputs: this.contract.localPartyInputs.utxos,
      remoteInputs: this.contract.remotePartyInputs.utxos,
      localChangeAddress: this.contract.localPartyInputs.changeAddress,
      remoteChangeAddress: this.contract.remotePartyInputs.changeAddress,
      feeRate: this.contract.feeRate,
      maturityTime: Math.floor(this.contract.maturityTime.getTime() / 1000)
    };

    const dlcTransactions = await this.client.CreateDlcTransactions(dlcTxRequest);
    this.contract.fundTxHex = dlcTransactions.fundTxHex;
    const fundTransaction = await this.client.getMethod('DecodeRawTransaction')({ hex: this.contract.fundTxHex });
    this.contract.fundTxId = fundTransaction.txid;
    this.contract.fundTxOutAmount = Amount.FromSatoshis(
      Number(fundTransaction.vout[0].value)
    );
    this.contract.refundTransaction = dlcTransactions.refundTxHex;
    this.contract.localCetsHex = dlcTransactions.localCetsHex;
    this.contract.remoteCetsHex = dlcTransactions.remoteCetsHex;
  }

  public async OnOfferMessage(offerMessage: OfferMessage, startingIndex: number): Promise<AcceptMessage> {
    this.contract = Contract.FromOfferMessage(offerMessage);
    await this.Initialize(offerMessage.remoteCollateral, startingIndex);
    this.contract.remotePartyInputs = this.partyInputs;
    await this.CreateDlcTransactions();
    const cetSignRequest: GetRawCetSignaturesRequest = {
      cetsHex: this.contract.localCetsHex,
      privkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: offerMessage.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.partyInputs.fundPublicKey,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    };

    const cetSignatures = await this.client.GetRawCetSignatures(cetSignRequest);

    const refundSignRequest: GetRawRefundTxSignatureRequest = {
      refundTxHex: this.contract.refundTransaction,
      privkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: offerMessage.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.partyInputs.fundPublicKey,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    };

    const refundSignature = await this.client.GetRawRefundTxSignature(refundSignRequest);

    const acceptMessage = new AcceptMessage(
      this.partyInputs,
      cetSignatures.hex,
      refundSignature.hex
    );

    return acceptMessage;
  }

  public async OnAcceptMessage(acceptMessage: AcceptMessage): Promise<SignMessage> {
    console.log('this.contract #1', this.contract)
    this.contract.ApplyAcceptMessage(acceptMessage);
    console.log('this.contract #2', this.contract)
    await this.CreateDlcTransactions();
    console.log('dlc txs created')

    console.log('this.contract #3', this.contract)
    console.log('this.contract.fundTxId', this.contract.fundTxId)
    console.log('this.contract.fundTxOutAmount', this.contract.fundTxOutAmount)

    const verifyCetSignaturesRequest: VerifyCetSignaturesRequest = {
      cetsHex: this.contract.localCetsHex,
      signatures: acceptMessage.cetSignatures,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: acceptMessage.remotePartyInputs.fundPublicKey,
      fundTxId: this.contract.fundTxId,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      verifyRemote: true,
    };

    console.log('verifyCetSignaturesRequest created')

    let areSigsValid = (await this.client.VerifyCetSignatures(verifyCetSignaturesRequest)).valid;

    console.log('areSigsValid')

    const verifyRefundSigRequest: VerifyRefundTxSignatureRequest = {
      refundTxHex: this.contract.refundTransaction,
      signature: acceptMessage.refundSignature,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: acceptMessage.remotePartyInputs.fundPublicKey,
      fundTxId: this.contract.fundTxId,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      verifyRemote: true,
    };

    areSigsValid =
      areSigsValid &&
      (await this.client.VerifyRefundTxSignature(verifyRefundSigRequest)).valid;

    if (!areSigsValid) {
      throw new Error("Invalid signatures received");
    }

    const cetSignRequest: GetRawCetSignaturesRequest = {
      cetsHex: this.contract.remoteCetsHex,
      privkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: this.partyInputs.fundPublicKey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    };

    const cetSignatures = (await this.client.GetRawCetSignatures(cetSignRequest)).hex;

    const refundSignRequest: GetRawRefundTxSignatureRequest = {
      refundTxHex: this.contract.refundTransaction,
      privkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: this.partyInputs.fundPublicKey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    };

    const refundSignature = (await this.client.GetRawRefundTxSignature(refundSignRequest)).hex;

    const fundTxSigs = await Promise.all(this.partyInputs.utxos.map(async (input, index) => {
      const fundTxSignRequest: GetRawFundTxSignatureRequest = {
        fundTxHex: this.contract.fundTxHex,
        privkey: this.inputPrivateKeys[index],
        prevTxId: input.txid,
        prevVout: input.vout,
        amount: input.amount.GetSatoshiAmount(),
      };

      return (await this.client.GetRawFundTxSignature(fundTxSignRequest)).hex;
    }));

    console.log('fundTxSigs', fundTxSigs)

    this.contract.refundLocalSignature = refundSignature;

    const inputPubKeys = await Promise.all(this.inputPrivateKeys.map(async (privkey) => {
      const reqPrivKey = {
        privkey,
        isCompressed: true,
      };

      return (await this.client.getMethod('GetPubkeyFromPrivkey')(reqPrivKey)).pubkey
    }))

    return new SignMessage(
      fundTxSigs,
      cetSignatures,
      refundSignature,
      inputPubKeys
    );
  }

  public async OnSignMessage(signMessage: SignMessage): Promise<string> {
    this.contract.ApplySignMessage(signMessage);

    const verifyCetSignaturesRequest: VerifyCetSignaturesRequest = {
      cetsHex: this.contract.remoteCetsHex,
      signatures: this.contract.cetSignatures,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      fundTxId: this.contract.fundTxId,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
      verifyRemote: false,
    };

    let areSigsValid = (await this.client.VerifyCetSignatures(verifyCetSignaturesRequest)).valid;

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
      throw new Error("Invalid signatures received");
    }

    let fundTxHex = this.contract.fundTxHex;

    this.partyInputs.utxos.forEach(async (input, i) => {
      const fundSignRequest: SignFundTransactionRequest = {
        fundTxHex,
        privkey: this.inputPrivateKeys[i],
        prevTxId: input.txid,
        prevVout: input.vout,
        amount: input.amount.GetSatoshiAmount(),
      };

      fundTxHex = (await this.client.SignFundTransaction(fundSignRequest)).hex;
    });

    signMessage.fundTxSignatures.forEach(async (signature, index) => {
      const addSignRequest: AddSignatureToFundTransactionRequest = {
        fundTxHex,
        signature,
        prevTxId: this.contract.localPartyInputs.utxos[index].txid,
        prevVout: this.contract.localPartyInputs.utxos[index].vout,
        pubkey: signMessage.utxoPublicKeys[index],
      };
      fundTxHex = (await this.client.AddSignatureToFundTransaction(addSignRequest)).hex;
    });

    console.log('fundTxHex', fundTxHex)

    const fundTxHash = await this.client.getMethod('sendRawTransaction')(fundTxHex);

    return fundTxHash
  }

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
  //   console.log('mutualClosingTx', mutualClosingTx)

  //   await this.walletClient.sendRawTransaction(mutualClosingTx);

  //   await this.GenerateBlocks(1);
  // }

  public async ExecuteUnilateralClose(
    oracleSignature: string,
    outcomeIndex: number
  ) {
    const cets = this.contract.isLocalParty
      ? this.contract.localCetsHex
      : this.contract.remoteCetsHex;

    let cetHex = cets[outcomeIndex];

    const signRequest: GetRawCetSignatureRequest = {
      cetHex,
      privkey: this.fundPrivateKey,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
      fundInputAmount: this.contract.fundTxOutAmount.GetSatoshiAmount(),
    };

    const cetSign = (await this.client.GetRawCetSignature(signRequest)).hex;

    const signatures = this.contract.isLocalParty
      ? [cetSign, this.contract.cetSignatures[outcomeIndex]]
      : [this.contract.cetSignatures[outcomeIndex], cetSign];

    const addSignRequest: AddSignaturesToCetRequest = {
      cetHex,
      signatures,
      fundTxId: this.contract.fundTxId,
      localFundPubkey: this.contract.localPartyInputs.fundPublicKey,
      remoteFundPubkey: this.contract.remotePartyInputs.fundPublicKey,
    };

    cetHex = (await this.client.AddSignaturesToCet(addSignRequest)).hex;
    console.log('cetHex', cetHex)

    const cet = await this.client.getMethod('DecodeRawTransaction')({ hex: cetHex });

    const outcomeAmount = this.contract.isLocalParty
      ? this.contract.outcomes[outcomeIndex].local
      : this.contract.outcomes[outcomeIndex].remote;

    const closingTxRequest: CreateClosingTransactionRequest = {
      address: this.partyInputs.finalAddress,
      amount: outcomeAmount.GetSatoshiAmount(),
      cetTxId: cet.txid,
    };

    let closingTxHex = (await this.client.CreateClosingTransaction(closingTxRequest)).hex;

    const remoteSweepKey = this.contract.isLocalParty
      ? this.contract.remotePartyInputs.sweepPublicKey
      : this.contract.localPartyInputs.sweepPublicKey;

    const signClosingRequest: SignClosingTransactionRequest = {
      closingTxHex,
      cetTxId: cet.txid,
      amount: cet.vout[0].value,
      localFundPrivkey: this.fundPrivateKey,
      localSweepPubkey: this.partyInputs.sweepPublicKey,
      remoteSweepPubkey: remoteSweepKey,
      oraclePubkey: this.contract.oracleInfo.publicKey,
      oracleRPoints: [this.contract.oracleInfo.rValue],
      oracleSigs: [oracleSignature],
      messages: [this.contract.outcomes[outcomeIndex].message],
      csvDelay: this.contract.cetCsvDelay
    };

    closingTxHex = (await this.client.SignClosingTransaction(signClosingRequest)).hex;
    console.log('closingTxHex', closingTxHex)

    await this.client.getMethod('sendRawTransaction')(cetHex)
    await this.client.getMethod('sendRawTransaction')(closingTxHex)
  }
}

// Put this outside the class
const BurnAddress = "bcrt1qxcjufgh2jarkp2qkx68azh08w9v5gah8u6es8s";
