import { isNode } from './environment'
let getCfd: any
let addInitializedListener: any
// if (!isNode()) {
//   console.log('not isNode')
//   const { getCfd: getCfdWasm, addInitializedListener: addInitializedListenerWasm } = require('cfd-js-wasm')
//   getCfd = getCfdWasm
//   addInitializedListener = addInitializedListenerWasm
// }

class Helper {
  getResponse(result: any) {
    return Promise.resolve(result);
  }

  getCfdjs() {
    return getCfd();
  }

  initialized(func: any) {
    return addInitializedListener(func);
  }
}

export default new Helper();
