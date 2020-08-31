import * as cfdjsModule from 'cfd-js-wasm'

class Helper {
  getResponse(result: any) {
    return Promise.resolve(result);
  }

  getCfdjs() {
    return cfdjsModule.getCfd();
  }

  initialized(func: any) {
    return cfdjsModule.addInitializedListener(func);
  }
}

export default new Helper();
