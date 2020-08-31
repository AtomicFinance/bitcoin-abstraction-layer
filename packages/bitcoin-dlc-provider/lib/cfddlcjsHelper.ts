import * as cfddlcjsModule from 'cfd-dlc-js-wasm'

class Helper {
  getResponse(result: any) {
    return Promise.resolve(result);
  }

  getCfddlcjs() {
    return cfddlcjsModule.getCfddlc();
  }

  initialized(func: any) {
    return cfddlcjsModule.addInitializedListener(func);
  }
}

export default new Helper();
