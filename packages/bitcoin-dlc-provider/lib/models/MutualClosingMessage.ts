import Output from './Output';

export default class MutualClosingMessage {
  constructor(readonly outputs: Output[], readonly signature: string) {}
}
