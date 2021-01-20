import { isNode } from './environment'
let getCfddlc: any
let addInitializedListener: any
// if (!isNode()) {
//   const {
//     getCfddlc: getCfddlcWasm,
//     addInitializedListener: addInitializedListenerWasm
//   } = require('cfd-dlc-js-wasm')
//   getCfddlc = getCfddlcWasm;
//   addInitializedListener = addInitializedListenerWasm
// }

class Helper {
  getResponse(result: any) {
    return Promise.resolve(result);
  }

  getCfddlcjs() {
    return getCfddlc()
  }

  initialized(func: any) {
    return addInitializedListener(func);
  }
}

export default new Helper();
