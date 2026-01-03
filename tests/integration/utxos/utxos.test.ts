import 'mocha';

import { bitcoin } from '@atomicfinance/types';
import { FundingInput } from '@node-dlc/messaging';
import { expect } from 'chai';

import Client from '../../../packages/client';
import {
  CoinSelectMode,
  Input,
  InputSupplementationMode,
} from '../../../packages/types';
import { chains, fundAddress, getInput } from '../common';

const chain = chains.bitcoinWithJs;
const alice = chain.client;
const bob = chains.bitcoinWithDdk3.client;
const charlie = chains.bitcoinWithDdk4.client;

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
          expect(error.message).to.include('Invalid InputSupplementationMode');
        }
      });
    });
    describe('InputSupplementationMode.Required', () => {
      it('should deduplicate UTXOs', async () => {
        const fixedInput = await getInput(bob);
        // Bob now has 5x2 BTC

        const targetAmount = BigInt(9.5 * 1e8); // Need all 5 UTXOs
        const feeRate = BigInt(10);

        const result: Input[] = await bob.getMethod(
          'GetInputsForAmountWithMode',
        )(
          [targetAmount],
          feeRate,
          [fixedInput], // 2 BTC supplied, 8 will be fetched
          InputSupplementationMode.Required,
        );

        // None mode: YES coin selection (selects subset), YES supplementation (scan wallet)
        expect(result.length).to.equal(5); // Should select all 5 inputs, deduplicating the fixed input

        const fixedInputs = result.filter(
          (input) =>
            input.txid === fixedInput.txid && input.vout === fixedInput.vout,
        );

        expect(fixedInputs.length).to.equal(1);
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

  describe('CoinSelect', () => {
    it('should run coinselect by default', async () => {
      // Create 3 UTXOs of 2 BTC each = 6 BTC total
      const fixedInput1 = await getInput(charlie);
      const fixedInput2 = await getInput(charlie);
      const fixedInput3 = await getInput(charlie);

      const targetAmount = BigInt(3.5 * 1e8); // Need 3.5 BTC
      const feeRate = BigInt(10);

      // Default mode should be coinselect (blackjack with accumulative fallback)
      const result: Input[] = await charlie.getMethod(
        'GetInputsForAmountWithMode',
      )(
        [targetAmount],
        feeRate,
        [fixedInput1, fixedInput2, fixedInput3],
        InputSupplementationMode.None,
        // No coinSelectMode specified - should use default
      );

      // Should select 2 UTXOs (4 BTC) to cover 3.5 BTC + fees
      expect(result.length).to.equal(2);
    });

    it('should run coinselect when specified', async () => {
      // Create 3 UTXOs of 2 BTC each = 6 BTC total
      const fixedInput1 = await getInput(charlie);
      const fixedInput2 = await getInput(charlie);
      const fixedInput3 = await getInput(charlie);

      const targetAmount = BigInt(3.5 * 1e8); // Need 3.5 BTC
      const feeRate = BigInt(10);

      // Explicitly specify coinselect mode
      const result: Input[] = await charlie.getMethod(
        'GetInputsForAmountWithMode',
      )(
        [targetAmount],
        feeRate,
        [fixedInput1, fixedInput2, fixedInput3],
        InputSupplementationMode.None,
        CoinSelectMode.Coinselect,
      );

      // Should select 2 UTXOs (4 BTC) to cover 3.5 BTC + fees
      expect(result.length).to.equal(2);
    });

    it('should run accumulative', async () => {
      // Create 3 UTXOs of 2 BTC each = 6 BTC total
      const fixedInput1 = await getInput(charlie);
      const fixedInput2 = await getInput(charlie);
      const fixedInput3 = await getInput(charlie);

      const targetAmount = BigInt(3.5 * 1e8); // Need 3.5 BTC
      const feeRate = BigInt(10);

      // Accumulative mode: accumulates inputs until target is reached
      const result: Input[] = await charlie.getMethod(
        'GetInputsForAmountWithMode',
      )(
        [targetAmount],
        feeRate,
        [fixedInput1, fixedInput2, fixedInput3],
        InputSupplementationMode.None,
        CoinSelectMode.Accumulative,
      );

      // Should select 2 UTXOs (4 BTC) to cover 3.5 BTC + fees
      expect(result.length).to.equal(2);
    });

    it('should run blackjack', async () => {
      // Create 3 UTXOs of 2 BTC each = 6 BTC total
      const fixedInput1 = await getInput(charlie);
      const fixedInput2 = await getInput(charlie);
      const fixedInput3 = await getInput(charlie);

      const targetAmount = BigInt(3.5 * 1e8); // Need 3.5 BTC
      const feeRate = BigInt(10);

      // Blackjack mode: tries to match target without going over (within threshold)
      const result: Input[] = await charlie.getMethod(
        'GetInputsForAmountWithMode',
      )(
        [targetAmount],
        feeRate,
        [fixedInput1, fixedInput2, fixedInput3],
        InputSupplementationMode.None,
        CoinSelectMode.Blackjack,
      );

      // Should select 2 UTXOs (4 BTC) to cover 3.5 BTC + fees
      expect(result.length).to.equal(2);
    });

    it('should run break', async () => {
      // Create 2 UTXOs of 2 BTC each = 4 BTC total
      const fixedInput1 = await getInput(charlie);
      const fixedInput2 = await getInput(charlie);

      const targetDenomination = BigInt(1 * 1e8); // Break into 1 BTC denomination outputs
      const feeRate = BigInt(10);

      // Break mode: selects inputs to break into equal denominations
      // With [1 BTC] as target, it will break a 2 BTC UTXO into 2x 1 BTC outputs
      const result: Input[] = await charlie.getMethod(
        'GetInputsForAmountWithMode',
      )(
        [targetDenomination],
        feeRate,
        [fixedInput1, fixedInput2],
        InputSupplementationMode.None,
        CoinSelectMode.Break,
      );

      // Should select at least 1 UTXO for breaking
      expect(result.length).to.be.at.least(1);
    });

    it('should run split', async () => {
      // Create 2 UTXOs of 2 BTC each = 4 BTC total
      const fixedInput1 = await getInput(charlie);
      const fixedInput2 = await getInput(charlie);

      // Split mode: provide multiple amounts to split inputs evenly across
      const splitAmounts = [BigInt(0.5 * 1e8), BigInt(0.75 * 1e8)]; // Split into 2 outputs of 0.5 and 0.75
      const feeRate = BigInt(10);

      // Split mode: selects inputs and splits value evenly across outputs
      const result: Input[] = await charlie.getMethod(
        'GetInputsForAmountWithMode',
      )(
        splitAmounts,
        feeRate,
        [fixedInput1, fixedInput2],
        InputSupplementationMode.None,
        CoinSelectMode.Split,
      );

      expect(result.length).to.be.at.least(1);
    });
  });
});
