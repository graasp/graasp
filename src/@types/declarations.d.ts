import { DataSource } from 'typeorm';

import 'fastify';
import { preHandlerHookHandler } from 'fastify';

import { RecaptchaActionType } from '@graasp/sdk';

import { Item } from '../services/item/entities/Item';
import { create, updateOne } from '../services/item/fluent-schema';
import { EtherpadItemService } from '../services/item/plugins/etherpad/service';
import { Actor, Member } from '../services/member/entities/member';
import { WebsocketService } from '../services/websockets/ws-service';

declare module 'fastify' {
  interface FastifyInstance {
    db: DataSource;
    // remove once fastify-polyglot has types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    i18n: any;
    items: {
      extendCreateSchema: ReturnType<typeof create>;
      extendExtrasUpdateSchema: ReturnType<typeof updateOne>;
    };
    websockets: WebsocketService;
    etherpad: EtherpadItemService;
    corsPluginOptions: any;
  }

  interface PassportUser {
    member?: Member;
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
