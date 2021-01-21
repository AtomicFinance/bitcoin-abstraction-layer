// import { getCfd, addInitializedListener } from 'cfd-js-wasm';
let getCfd: any;
let addInitializedListener: any;

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
