/**
 * Concrete message serdes with Ajv and JSON Type Definitions.
 * See:
 *  https://ajv.js.org/guide/getting-started.html#parsing-and-serializing-json
 *  https://ajv.js.org/guide/typescript.html
 */
import Ajv from 'ajv/dist/jtd';

import { Websocket } from '@graasp/sdk';

import { clientMessageSchema, serverMessageSchema } from './schemas';

const ajv = new Ajv();

class AjvMessageSerializer {
  serialize = ajv.compileSerializer<Websocket.ServerMessage>(serverMessageSchema);

  parse = ajv.compileParser<Websocket.ClientMessage>(clientMessageSchema);
}

export { AjvMessageSerializer };
