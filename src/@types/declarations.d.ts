import { DataSource } from 'typeorm';

import 'fastify';
import { preHandlerHookHandler } from 'fastify';

import { RecaptchaActionType } from '@graasp/sdk';

import { JobService } from '../jobs';
import type { MailerDecoration } from '../plugins/mailer';
import { Account } from '../services/account/entities/account';
import { ActionService } from '../services/action/services/action';
import { MagicLinkService } from '../services/auth/plugins/magicLink/service';
import { MobileService } from '../services/auth/plugins/mobile/service';
import { MemberPasswordService } from '../services/auth/plugins/password/service';
import { AuthService } from '../services/auth/service';
import { MentionService } from '../services/chat/plugins/mentions/service';
import { ChatMessageService } from '../services/chat/service';
import FileService from '../services/file/service';
import { Item } from '../services/item/entities/Item';
import { create, updateOne } from '../services/item/schema';
import { Actor, Member } from '../services/member/entities/member';
import { WebsocketService } from '../services/websockets/ws-service';

declare module 'fastify' {
  interface FastifyInstance {
    // TODO: remove once we have migrated to Drizzle
    /**
     * @deprecated Use the Drizzle databse instance instead
     */
    db: DataSource;
    websockets: WebsocketService;
    corsPluginOptions: any;
  }

  interface PassportUser {
    account?: Member | Guest;
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
