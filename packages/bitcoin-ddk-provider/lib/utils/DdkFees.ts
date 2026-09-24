import { FundingInput } from '@node-dlc/messaging';

/*
 * The funding and CET fees one party pays under the ddk v2 construction
 * (`PartyParams::get_change_output_and_fees_with_counterparty`, the rule since
 * ddk-dlc 2.0.0-rc.4). The ddk engine builds the transactions; this port exists only so
 * BAL can select enough coins and check an offer before handing it to the
 * engine.
 *
 * For a dual-funded contract it agrees with @node-dlc's DualFundingTxFinalizer.
 * A party that funds the whole contract pays more under ddk v2: the full
 * funding base weight, the full CET base weight, and the counterparty's payout
 * output, which the zero-collateral party does not pay for.
 */

/** ddk-dlc `FUND_TX_BASE_WEIGHT`. */
export const FUND_TX_BASE_WEIGHT = 214;
/** ddk-dlc `CET_BASE_WEIGHT`: a CET without its payout script pubkeys. */
export const CET_BASE_WEIGHT = 500;
/** ddk-dlc `TX_INPUT_BASE_WEIGHT`: (outpoint + sequence + script length) * 4. */
export const TX_INPUT_BASE_WEIGHT = 164;
/**
 * The longest standard segwit script pubkey (P2WSH and P2TR are 34 bytes).
 * The acceptor's payout script is unknown when an offer is built, so a
 * single-funded offer reserves for the largest one it could be.
 */
export const MAX_STANDARD_PAYOUT_SPK_LENGTH = 34;
/** A P2WPKH script pubkey: the wallet's payout and change outputs. */
export const P2WPKH_SPK_LENGTH = 22;

/** ddk-dlc `util::weight_to_fee`: round the weight up to whole vbytes. */
export const weightToFee = (weight: number, feeRatePerVb: bigint): bigint =>
  BigInt(Math.ceil(weight / 4)) * feeRatePerVb;

export interface DdkPartyFeeParams {
  fundingInputs: FundingInput[];
  payoutSpkLength: number;
  changeSpkLength: number;
  feeRatePerVb: bigint;
  /** This party's collateral equals the contract's total collateral. */
  fundsWholeContract: boolean;
  /** Only priced when `fundsWholeContract` is true. */
  counterpartyPayoutSpkLength: number;
}

export interface DdkPartyFees {
  fundFee: bigint;
  cetFee: bigint;
}

export const ddkPartyFees = ({
  fundingInputs,
  payoutSpkLength,
  changeSpkLength,
  feeRatePerVb,
  fundsWholeContract,
  counterpartyPayoutSpkLength,
}: DdkPartyFeeParams): DdkPartyFees => {
  // A DLC (splice) input weighs the same as a regular one: 36*4 + 4 + 4*4 is
  // TX_INPUT_BASE_WEIGHT, and its script sig is empty.
  const inputsWeight = fundingInputs.reduce(
    (total, input) =>
      total +
      TX_INPUT_BASE_WEIGHT +
      input.scriptSigLength() * 4 +
      input.maxWitnessLen,
    0,
  );
  const fundBaseWeight = fundsWholeContract
    ? FUND_TX_BASE_WEIGHT
    : FUND_TX_BASE_WEIGHT / 2;
  const fundWeight = fundBaseWeight + inputsWeight + changeSpkLength * 4 + 36;

  const cetBaseWeight = fundsWholeContract
    ? CET_BASE_WEIGHT
    : CET_BASE_WEIGHT / 2;
  const cetWeight =
    cetBaseWeight +
    payoutSpkLength * 4 +
    (fundsWholeContract ? counterpartyPayoutSpkLength * 4 : 0);

  return {
    fundFee: weightToFee(fundWeight, feeRatePerVb),
    cetFee: weightToFee(cetWeight, feeRatePerVb),
  };
};

/**
 * What a party funding the whole contract pays under ddk v2 on top of the
 * @node-dlc estimate that coin selection adds by itself: the other half of
 * the funding base weight, the other half of the CET base weight plus the
 * counterparty's payout output, and one vbyte per fee for rounding. Coin
 * selection runs before the inputs are known, and for native segwit inputs
 * every input-dependent term is the same in both formulas, so this difference
 * does not depend on them. (@node-dlc does not scale a P2SH-wrapped input's
 * script sig to weight units; the exact check in `createDlcOffer` catches the
 * shortfall that leaves.)
 */
export const singleFundedFeeReserve = (
  feeRatePerVb: bigint,
  counterpartyPayoutSpkLength = MAX_STANDARD_PAYOUT_SPK_LENGTH,
): bigint => {
  // @node-dlc: half of (BATCH_FUND_TX_BASE_WEIGHT 42 + FUNDING_OUTPUT_SIZE 43 * 4)
  // is 107, and the future (CET) fee base is 249.
  const fundDelta = FUND_TX_BASE_WEIGHT - 107;
  const cetDelta = CET_BASE_WEIGHT - 249 + counterpartyPayoutSpkLength * 4;
  return weightToFee(fundDelta + cetDelta, feeRatePerVb) + 2n * feeRatePerVb;
};
