import 'fastify';

import { WebsocketService } from '../services/websockets/ws-service';
import { MaybeUser } from '../types';

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
      item: ItemRaw;
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
