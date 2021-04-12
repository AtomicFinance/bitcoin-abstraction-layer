import 'mocha';
import { expect } from 'chai';
import { chains, fundAddress, getInput } from '../common';
import Client from '@liquality/client';
import { bitcoin } from '../../../packages/bitcoin-dlc-provider/lib/types/@liquality/types';
import Input from '../../../packages/bitcoin-dlc-provider/lib/models/Input';
import { FundingInputV0 } from '@node-dlc/messaging';

const chain = chains.bitcoinWithJs;
const alice = chain.client;

describe('utxos', () => {
  describe('getUtxosForAmount', () => {
    it('should return input format correctly', async () => {
      const aliceInput = await getInputUsingGetInputsForAmount(alice);
      const input = aliceInput.inputs[0];
      expect(input.amount * 1e8).to.equal(input.satoshis);
      expect(input.amount * 1e8).to.equal(input.value);
    });
  });

  describe('inputToFundingInput', () => {
    it('should convert between types', async () => {
      const actualInput: Input = await getInput(alice);
      const actualFundingInput: FundingInputV0 = await alice.finance.getMethod(
        'inputToFundingInput',
      )(actualInput);

      const input: Input = await alice.finance.getMethod('fundingInputToInput')(
        actualFundingInput,
      );
      const fundingInput: FundingInputV0 = await alice.finance.getMethod(
        'inputToFundingInput',
      )(input);

      expect(actualInput.txid).to.equal(input.txid);
      expect(actualInput.vout).to.equal(input.vout);
      expect(actualInput.address).to.equal(input.address);
      expect(actualInput.amount).to.equal(input.amount);
      expect(actualInput.satoshis).to.equal(input.satoshis);
      expect(actualInput.value).to.equal(input.value);
      expect(actualInput.derivationPath).to.equal(input.derivationPath);
      expect(actualInput.maxWitnessLength).to.equal(input.maxWitnessLength);
      expect(actualInput.redeemScript).to.equal(input.redeemScript);

      expect(actualFundingInput.inputSerialId).to.equal(
        fundingInput.inputSerialId,
      );
      expect(actualFundingInput.prevTx.serialize()).to.deep.equal(
        fundingInput.prevTx.serialize(),
      );
      expect(actualFundingInput.prevTxVout).to.equal(fundingInput.prevTxVout);
      expect(actualFundingInput.sequence.value).to.equal(
        fundingInput.sequence.value,
      );
      expect(actualFundingInput.maxWitnessLen).to.equal(
        fundingInput.maxWitnessLen,
      );
      expect(actualFundingInput.redeemScript).to.deep.equal(
        fundingInput.redeemScript,
      );
    });
  });
});

async function getInputUsingGetInputsForAmount(
  client: Client,
): Promise<InputsForAmountResponse> {
  const { address: unusedAddress } = await client.wallet.getUnusedAddress();

  await client.getMethod('jsonrpc')('importaddress', unusedAddress, '', false);

  await fundAddress(unusedAddress);

  const targets: bitcoin.OutputTarget[] = [
    {
      address: BurnAddress,
      value: 1 * 1e8,
    },
  ];

  const inputsForAmount: InputsForAmountResponse = client.getMethod(
    'getInputsForAmount',
  )(targets, 10, []);

  return inputsForAmount;
}

interface InputsForAmountResponse {
  inputs: Input[];
  change: Change;
  outputs: Output[];
  fee: number;
}

interface Change {
  value: number;
}

interface Output {
  value: number;
  id?: string;
}

const BurnAddress = 'bcrt1qxcjufgh2jarkp2qkx68azh08w9v5gah8u6es8s';
