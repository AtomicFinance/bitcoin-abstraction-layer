import { IClient } from '@atomicfinance/types';

export default abstract class Provider {
  client: IClient;
  /**
   * Set client to a provider instance.
   * @param client - The client instance
   */
  setClient(client?: IClient): void {
    this.client = client;
  }

  /**
   * Get method for the provider
   * @param {!string} method - Name of the method
   * @return {function} Returns a method from a provider above current Provider
   *  in the stack.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMethod(method: string, requestor: any = this): (...args: any[]) => any {
    return this.client.getMethod(method, requestor).bind(this);
  }
}
