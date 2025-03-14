import 'fastify';

import type { Item } from '../drizzle/types.js';
import { WebsocketService } from '../services/websockets/ws-service.js';
import type { MaybeUser } from '../types.js';

declare module 'fastify' {
  interface FastifyInstance {
    websockets: WebsocketService;
    corsPluginOptions: any;
  }

  interface PassportUser {
    account?: MaybeUser;
    passwordResetRedisKey?: string; // Used for Password Reset
    emailChange?: {
      newEmail: string;
    }; // Used for Email modification
    app?: {
      // Used for App Authentication
      item: Item;
      key: string;
      origin: string;
    };
  }
}

declare module '@fastify/secure-session' {
  interface SessionData {
    passport: string;
  }
}
