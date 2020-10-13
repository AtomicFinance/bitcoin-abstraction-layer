import { getCfd, addInitializedListener } from 'cfd-js-wasm';

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
