declare module '@atomicfinance/provider' {
  export default class Provider {
    client: any;
    version: number;
    identifier: string;
    constructor(identifier: string);
    /**
     * Set client to a provider instance.
     * @param {!ChainAbstractionLayer} client - The ChainAbstractionLayer instance
     */
    setClient(client?: any): void;
    /**
     * Get method for the provider
     * @param {!string} method - Name of the method
     * @return {function} Returns a method from a provider above current Provider
     *  in the stack.
     */
    getMethod(method?: any): any;
    getIdentifier(): string;
  }
}
