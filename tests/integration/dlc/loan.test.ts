// import 'mocha';

// import { Value } from '@node-dlc/bitcoin';
// import { PolynomialPayoutCurve } from '@node-dlc/core';
// import {
//   ContractDescriptorV1,
//   ContractInfoV0,
//   DigitDecompositionEventDescriptorV0,
//   DlcAccept,
//   DlcOffer,
//   DlcSign,
//   DlcTransactions,
//   OracleAnnouncementV0,
//   OracleAttestationV0,
//   OracleEventV0,
//   OracleInfoV0,
//   PayoutFunctionV0,
//   RoundingIntervalsV0,
// } from '@node-dlc/messaging';
// import BN from 'bignumber.js';
// import { math } from 'bip-schnorr';
// import { expect } from 'chai';

// import { chains, getInput } from '../common';
// import Oracle from '../models/Oracle';
// import {
//   EnginePayout,
//   generateContractInfoCustomStrategyOracle,
//   generateOracleAttestation,
// } from '../utils/contract';

// const chain = chains.bitcoinWithJs;
// const alice = chain.client;
// const bob = chains.bitcoinWithJs2.client;

// describe('Loan with DLC Collateral', () => {
//   // Loan parameters
//   const collateral = Value.fromBitcoin(1.5); // 1 BTC
//   const interestRate = 5n; // 5% annual interest
//   const minLTV = 80n; // 80% minimum loan-to-value ratio
//   const repaymentPeriod = 30; // 30 days
//   const penaltyRate = 10n; // 10% penalty for late repayment

//   const principal = new BN(100000); // 100k USD loan

//   const interest = principal
//     .multipliedBy(new BN(Number(interestRate)))
//     .dividedBy(100);
//   const penalty = principal
//     .multipliedBy(new BN(Number(penaltyRate)))
//     .dividedBy(100);

//   // Critical price is the price at which the value of the collateral is equal to the sum of the principal, interest, and penalty
//   const criticalPrice = principal
//     .plus(interest)
//     .plus(penalty)
//     .dividedBy(collateral.bitcoin);

//   // DLC parameters
//   const numDigits = 21;
//   const oracleBase = 2;
//   const unit = 'BTC-USD';
//   const eventId = 'loan-repayment';

//   // Calculate payouts
//   // const totalRepayment =
//   //   principalAmount + (principalAmount * interestRate) / 100n;
//   // const maxLossPayout = principalAmount; // Lender gets full collateral in case of default
//   // const maxLossOutcome = 0n; // Price drops to 0
//   // const minLossOutcome = (principalAmount * (100n - minLTV)) / 100n; // Price drops below LTV threshold
//   // const belowThresholdPayout = principalAmount; // Lender gets full collateral
//   // const aboveOrEqualThresholdPayout = totalRepayment; // Borrower repays with interest
//   // const thresholdOutcome = (principalAmount * minLTV) / 100n; // Price at LTV threshold

//   let dlcOffer: DlcOffer;
//   let dlcAccept: DlcAccept;
//   let dlcSign: DlcSign;
//   let dlcTransactions: DlcTransactions;
//   let oracleAttestation: OracleAttestationV0;
//   let oracle: Oracle;

//   beforeEach(async () => {
//     const enumOracle = new Oracle('olivia', 1);
//     const numericOracle = new Oracle('olivia', numDigits);

//     // Max outcome limited by the oracle
//     const maxOutcome = BigInt(
//       new BN(oracleBase).pow(numDigits).minus(1).toString(10),
//     );

//     const payoutAtMaxOutcome = Value.fromSats(
//       Number(
//         principal
//           .plus(interest)
//           .plus(penalty)
//           .dividedBy(new BN(Number(maxOutcome)))
//           .multipliedBy(1e8)
//           .toNumber()
//           .toFixed(0),
//       ),
//     );

//     const payoutCurveBelowCriticalPrice = new PolynomialPayoutCurve([
//       { outcome: new BN(0), payout: new BN(Number(collateral.sats)) }, // Lender gets full collateral if price goes to 0
//       {
//         outcome: new BN(Number(criticalPrice.toNumber().toFixed(0))), // Lender still gets full collateral if price is at critical price
//         payout: new BN(Number(collateral.sats)),
//       },
//     ]);

//     const payoutCurveAboveCriticalPrice = new PolynomialPayoutCurve([
//       {
//         outcome: new BN(Number(criticalPrice.toNumber().toFixed(0))),
//         payout: new BN(Number(collateral.sats)),
//       },
//       {
//         outcome: new BN(Number(maxOutcome)),
//         payout: new BN(Number(payoutAtMaxOutcome.sats)),
//       },
//     ]);

//     const payoutFunction = new PayoutFunctionV0();
//     payoutFunction.endpoint0 = BigInt(0);
//     payoutFunction.endpointPayout0 = collateral.sats;
//     payoutFunction.extraPrecision0 = 0;

//     payoutFunction.pieces.push({
//       payoutCurvePiece: payoutCurveBelowCriticalPrice.toPayoutCurvePiece(),
//       endpoint: BigInt(criticalPrice.toNumber().toFixed(0)),
//       endpointPayout: collateral.sats,
//       extraPrecision: 0,
//     });

//     payoutFunction.pieces.push({
//       payoutCurvePiece: payoutCurveAboveCriticalPrice.toPayoutCurvePiece(),
//       endpoint: maxOutcome,
//       endpointPayout: payoutAtMaxOutcome.sats,
//       extraPrecision: 0,
//     });

//     const intervals = new RoundingIntervalsV0();
//     intervals.intervals = [{ beginInterval: 0n, roundingMod: 1000n }];

//     const contractDescriptor = new ContractDescriptorV1();

//     contractDescriptor.numDigits = numDigits;
//     contractDescriptor.payoutFunction = payoutFunction;
//     contractDescriptor.roundingIntervals = intervals;

//     // const {
//     //   contractInfo,
//     //   totalCollateral,
//     // } = generateContractInfoLoanDisjointUnion(
//     //   enumOracle,
//     //   numericOracle,
//     //   payoutFunction,
//     //   intervals,
//     //   collateral.sats,
//     // );

//     // Create and fund DLC
//     const aliceInput = await getInput(alice);
//     const bobInput = await getInput(bob);

//     const feeRatePerVb = BigInt(10);
//     const cetLocktime =
//       Math.floor(Date.now() / 1000) + repaymentPeriod * 24 * 60 * 60; // Locktime based on repayment period
//     const refundLocktime = cetLocktime + 1;

//     dlcOffer = await alice.dlc.createDlcOffer(
//       contractInfo,
//       collateral.sats, // Alice (lender) provides principal
//       feeRatePerVb,
//       cetLocktime,
//       refundLocktime,
//       [aliceInput],
//     );

//     const acceptDlcOfferResponse = await bob.dlc.acceptDlcOffer(dlcOffer, [
//       bobInput,
//     ]);
//     dlcAccept = acceptDlcOfferResponse.dlcAccept;
//     dlcTransactions = acceptDlcOfferResponse.dlcTransactions;

//     await bob.dlc.createDlcTxs(dlcOffer, dlcAccept);

//     const signDlcAcceptResponse = await alice.dlc.signDlcAccept(
//       dlcOffer,
//       dlcAccept,
//     );
//     dlcSign = signDlcAcceptResponse.dlcSign;

//     const fundTx = await bob.dlc.finalizeDlcSign(
//       dlcOffer,
//       dlcAccept,
//       dlcSign,
//       dlcTransactions,
//     );
//     await bob.chain.sendRawTransaction(fundTx.serialize().toString('hex'));
//   });

//   describe.only('Successful Repayment', () => {
//     it('should allow borrower to repay loan with interest', async () => {
//       console.log('test');
//       // Simulate successful repayment (price stays above LTV threshold)
//       // const repaymentOutcome = Number(thresholdOutcome) + 1000; // Price well above threshold
//       // oracleAttestation = generateOracleAttestation(
//       //   repaymentOutcome,
//       //   oracle,
//       //   oracleBase,
//       //   numDigits,
//       //   eventId,
//       // );

//       // const cet = await bob.dlc.execute(
//       //   dlcOffer,
//       //   dlcAccept,
//       //   dlcSign,
//       //   dlcTransactions,
//       //   oracleAttestation,
//       //   false,
//       // );

//       // // Verify lender receives principal + interest
//       // const lenderOutput = cet.outputs.find(
//       //   (output) =>
//       //     output.scriptPubKey.serialize().slice(1).toString('hex') ===
//       //     (dlcOffer as any).payoutSPK.toString('hex'),
//       // );
//       // expect(lenderOutput.value.sats).to.equal(aboveOrEqualThresholdPayout);
//     });
//   });

//   // describe('Default Scenarios', () => {
//   //   it('should allow lender to repossess collateral when price drops below LTV', async () => {
//   //     // Simulate default (price drops below LTV threshold)
//   //     const defaultOutcome = Number(minLossOutcome) - 1000; // Price below threshold
//   //     oracleAttestation = generateOracleAttestation(
//   //       defaultOutcome,
//   //       oracle,
//   //       oracleBase,
//   //       numDigits,
//   //       eventId,
//   //     );

//   //     const cet = await alice.dlc.execute(
//   //       dlcOffer,
//   //       dlcAccept,
//   //       dlcSign,
//   //       dlcTransactions,
//   //       oracleAttestation,
//   //       false,
//   //     );

//   //     // Verify lender receives full collateral
//   //     const lenderOutput = cet.outputs.find(
//   //       (output) =>
//   //         output.scriptPubKey.serialize().slice(1).toString('hex') ===
//   //         (dlcOffer as any).payoutSPK.toString('hex'),
//   //     );
//   //     expect(lenderOutput.value.sats).to.equal(belowThresholdPayout);
//   //   });

//   //   it('should handle complete default (price drops to zero)', async () => {
//   //     // Simulate complete default (price drops to zero)
//   //     const completeDefaultOutcome = 0;
//   //     oracleAttestation = generateOracleAttestation(
//   //       completeDefaultOutcome,
//   //       oracle,
//   //       oracleBase,
//   //       numDigits,
//   //       eventId,
//   //     );

//   //     const cet = await alice.dlc.execute(
//   //       dlcOffer,
//   //       dlcAccept,
//   //       dlcSign,
//   //       dlcTransactions,
//   //       oracleAttestation,
//   //       false,
//   //     );

//   //     // Verify lender receives full collateral
//   //     const lenderOutput = cet.outputs.find(
//   //       (output) =>
//   //         output.scriptPubKey.serialize().slice(1).toString('hex') ===
//   //         (dlcOffer as any).payoutSPK.toString('hex'),
//   //     );
//   //     expect(lenderOutput.value.sats).to.equal(maxLossPayout);
//   //   });
//   // });
// });
