import { IFinanceClient } from '@atomicfinance/types';

export default abstract class Provider {
  client: IFinanceClient;
  /**
   * Set client to a provider instance.
   * @param {!Chainify} client - The Chainify instance
   */
  setClient(client?: any) {
    this.client = client;
  }

  /**
   * Get method for the provider
   * @param {!string} method - Name of the method
   * @return {function} Returns a method from a provider above current Provider
   *  in the stack.
   */
  getMethod(method: string, requestor: any = this) {
    return this.client.getMethod(method, requestor).bind(this);
  }
}
