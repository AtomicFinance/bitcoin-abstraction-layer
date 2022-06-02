import { NodeError } from '@atomicfinance/errors';
import Provider from '@atomicfinance/provider';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { get } from 'lodash';

export default class NodeProvider extends Provider {
  _node: AxiosInstance;
  constructor(config: AxiosRequestConfig) {
    super();
    this._node = axios.create(config);
  }

  _handleNodeError(e: Error, context: any) {
    const { name, message, ...attrs } = e;

    const data = get(e, 'response.data');
    const errorMessage = data || message;

    throw new NodeError(errorMessage, {
      ...context,
      ...attrs,
    });
  }

  nodeGet(url: string, params: any = {}): Promise<any> {
    return this._node
      .get(url, { params })
      .then((response) => response.data)
      .catch((e) => this._handleNodeError(e, { url, params }));
  }

  nodePost(url: string, data: any): Promise<any> {
    return this._node
      .post(url, data)
      .then((response) => response.data)
      .catch((e) => this._handleNodeError(e, { url, data }));
  }
}
