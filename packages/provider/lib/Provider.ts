/// <reference path="Client.d.ts" />

import Client from '@atomicfinance/client';

export default class Provider {
  client: Client;
  version: number;
  identifier: string;

  constructor(identifier: string) {
    this.identifier = identifier;
  }

  /**
   * Set client to a provider instance.
   * @param {!ChainAbstractionLayer} client - The ChainAbstractionLayer instance
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
  getMethod(method?: any) {
    return this.client.getMethod(method, this).bind(this);
  }

  getIdentifier() {
    return this.identifier;
  }
}
