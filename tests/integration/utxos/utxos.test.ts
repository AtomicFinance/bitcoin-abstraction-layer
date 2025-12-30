import 'mocha';

import { bitcoin } from '@atomicfinance/types';
import { FundingInput } from '@node-dlc/messaging';
import { expect } from 'chai';

import Client from '../../../packages/client';
import { Input, InputSupplementationMode } from '../../../packages/types';
import { chains, fundAddress, getInput } from '../common';

const chain = chains.bitcoinWithJs;
const alice = chain.client;
const bob = chains.bitcoinWithDdk3.client;

describe('utxos', () => {
  describe('getUtxosForAmount', () => {
    it('should return input format correctly', async () => {
      const aliceInput = await getInputUsingGetInputsForAmount(alice);
      const input = aliceInput.inputs[0];
      expect(input.amount * 1e8).to.equal(input.value);
    });
  });

  describe('inputToFundingInput', () => {
    it('should convert between types', async () => {
      const actualInput: Input = await getInput(alice);
      const actualFundingInput: FundingInput = (await alice.dlc.inputToFundingInput(
        actualInput,
      )) as FundingInput;

      const input: Input = await alice.dlc.fundingInputToInput(
        actualFundingInput,
      );
      const fundingInput: FundingInput = (await alice.dlc.inputToFundingInput(
        input,
      )) as FundingInput;

      expect(actualInput.txid).to.equal(input.txid);
      expect(actualInput.vout).to.equal(input.vout);
      expect(actualInput.address).to.equal(input.address);
      expect(actualInput.amount).to.equal(input.amount);
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

describe('GetInputsForAmountWithMode', () => {
  describe('InputSupplementationMode', () => {
    describe('InputSupplementationMode.None', () => {
      it('should return the minimal necessary UTXOs of the fixed set provided', async () => {
        const fixedInput1 = await getInput(bob);
        const fixedInput2 = await getInput(bob);
        const fixedInput3 = await getInput(bob);
        // Bob now has 3x2 BTC

        const targetAmount = BigInt(3 * 1e8); // Only need 3 BTC, i.e. first 2 inputs
        const feeRate = BigInt(10);

        const result: Input[] = await bob.getMethod(
          'GetInputsForAmountWithMode',
        )(
          [targetAmount],
          feeRate,
          [fixedInput1, fixedInput2, fixedInput3], // 6 BTC supplied
          InputSupplementationMode.None,
        );

        // None mode: YES coin selection (selects subset), NO supplementation (doesn't scan wallet)
        expect(result.length).to.equal(2); // Should select only 2 of the 3 fixed inputs

        // Verify selected inputs are from the fixed inputs
        result.forEach((selectedInput) => {
          const isFromFixed = [fixedInput1, fixedInput2, fixedInput3].some(
            (fixed) =>
              fixed.txid === selectedInput.txid &&
              fixed.vout === selectedInput.vout,
          );
          expect(isFromFixed).to.be.true;
        });
      });

      it('should throw error if fixed inputs are unsufficient', async () => {
        const fixedInput = await getInput(bob);
        // Bob now has 4x2 BTC

        const targetAmount = BigInt(3 * 1e8); // Need 3 BTC
        const feeRate = BigInt(10);

        try {
          await bob.getMethod('GetInputsForAmountWithMode')(
            [targetAmount],
            feeRate,
            [fixedInput], // only 2 BTC supplied
            InputSupplementationMode.None,
          );
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).to.include('Not enough balance');
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty amounts array', async () => {
      await getInput(bob);

      const result: Input[] = await bob.getMethod('GetInputsForAmountWithMode')(
        [],
        BigInt(10),
        [],
        InputSupplementationMode.None,
      );

      expect(result.length).to.equal(0);
    });
  });
});
