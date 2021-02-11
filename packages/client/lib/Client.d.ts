import Dlc from './Dlc';
import Cfd from './Cfd';
import Wallet from './Wallet';
export default class Client extends Dlc {
    _providers: Array<Client>;
    version: string;
    _dlc: Dlc;
    _cfd: Cfd;
    _wallet: Wallet;
    client: Client;
    identifier: string;
    /**
     * Client
     */
    constructor(client?: Client);
    /**
     * Add a provider
     * @param {!Provider} provider - The provider instance or RPC connection string
     * @return {Client} Returns instance of Client
     * @throws {InvalidProviderError} When invalid provider is provider
     * @throws {DuplicateProviderError} When same provider is added again
     */
    addProvider(provider: any): this;
    /**
     * Check the availability of a method.
     * @param {!string} method - Name of the method to look for in the provider stack
     * @param {boolean|object} [requestor=false] - If provided, it returns providers only
     *  above the requestor in the stack.
     * @return {Provider} Returns a provider instance associated with the requested method
     * @throws {NoProviderError} When no provider is available in the stack.
     * @throws {UnimplementedMethodError} When the requested method is not provided
     *  by any provider above requestor in the provider stack
     * @throws {UnsupportedMethodError} When requested method is not supported by
     *  version specified
     */
    getProviderForMethod(method: any, requestor?: any): Client;
    /**
     * Helper method that returns method from a provider.
     * @param {!string} method - Name of the method to look for in the provider stack
     * @param {object} [requestor] - If provided, it returns method from providers only
     *  above the requestor in the stack.
     * @return {function} Returns method from provider instance associated with the requested method
     */
    getMethod(method: any, requestor?: any): any;
    get dlc(): Dlc;
    get cfd(): Cfd;
    get wallet(): Wallet;
    getIdentifier(): string;
}
