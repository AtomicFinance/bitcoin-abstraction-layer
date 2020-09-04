// import * as cfdjs from "cfd-js";


// import {
//   CreateKeyPairRequest, DecodeRawTransactionRequest
// } from 'cfd-js-wasm'



// export function CreateKeyPair() {
//   const reqJson: CreateKeyPairRequest = {
//     wif: false,
//   };
//   return cfdjs.CreateKeyPair(reqJson);
// }

// export function GetPubkeyFromPrivkey(privkey: string) {
//   const reqPrivKey = {
//     privkey,
//     isCompressed: true,
//   };

//   return cfdjs.GetPubkeyFromPrivkey(reqPrivKey).pubkey;
// }

// export function GetPrivkeyFromWif(wif: string) {
//   const req = {
//     wif,
//   };

//   return cfdjs.GetPrivkeyFromWif(req).hex;
// }

// export function DecodeRawTransaction(rawTransaction: string) {
//   const reqJson: DecodeRawTransactionRequest = {
//     hex: rawTransaction,
//   };

//   return cfdjs.DecodeRawTransaction(reqJson);
// }
