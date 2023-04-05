import { NodeError } from '@atomicfinance/errors';
import {
  AxiosRequestConfig,
  AxiosResponse,
  NodeProvider,
} from '@atomicfinance/node-provider';
import JSONBigInt from 'json-bigint';
import { has } from 'lodash';

const { parse, stringify } = JSONBigInt({
  storeAsString: true,
  strict: true,
  useNativeBigInt: true,
});

export default class JsonRpcProvider extends NodeProvider {
  constructor(uri: string, username?: string, password?: string) {
    const config: AxiosRequestConfig = {
      baseURL: uri,
      responseType: 'text',
      transformResponse: undefined, // https://github.com/axios/axios/issues/907,
      validateStatus: () => true,
    };

    if (username || password) {
      config.auth = { username, password };
    }

    super(config);
  }

  _prepareRequest(method: string, params: any[]) {
    const id = Date.now();
    const jsonrpc = '2.0';
    const req = { id, method, jsonrpc, params };

    return req;
  }

  _parseResponse(_data: AxiosResponse): any {
    const dataString: string =
      typeof _data !== 'string' ? stringify(_data) : _data;

    const data = parse(dataString);

    const { error } = data;

    if (error != null) {
      throw new NodeError(error.message || error);
    }

    if (!has(data, 'result')) {
      throw new NodeError('Missing `result` on the RPC call result');
    }

    return data.result;
  }

  async jsonrpc(method: string, ...params: any[]) {
    const data = await super.nodePost(
      '/wallet/default',
      this._prepareRequest(method, params),
    );

    return this._parseResponse(data);
  }
}
