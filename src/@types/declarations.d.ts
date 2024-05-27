import { DataSource } from 'typeorm';

import 'fastify';
import { preHandlerHookHandler } from 'fastify';

import { AuthTokenSubject, RecaptchaActionType } from '@graasp/sdk';

import { JobService } from '../jobs';
import type { MailerDecoration } from '../plugins/mailer';
import { ActionService } from '../services/action/services/action';
import { MagicLinkService } from '../services/auth/plugins/magicLink/service';
import { MobileService } from '../services/auth/plugins/mobile/service';
import { MemberPasswordService } from '../services/auth/plugins/password/service';
import { AuthService } from '../services/auth/service';
import { MentionService } from '../services/chat/plugins/mentions/service';
import { ChatMessageService } from '../services/chat/service';
import FileService from '../services/file/service';
import { create, updateOne } from '../services/item/fluent-schema';
import { ActionItemService } from '../services/item/plugins/action/service';
import { EtherpadItemService } from '../services/item/plugins/etherpad/service';
import FileItemService from '../services/item/plugins/file/service';
import { ItemCategoryService } from '../services/item/plugins/itemCategory/services/itemCategory';
import { SearchService } from '../services/item/plugins/published/plugins/search/service';
import { ItemPublishedService } from '../services/item/plugins/published/service';
import { ItemThumbnailService } from '../services/item/plugins/thumbnail/service';
import ItemService from '../services/item/service';
import ItemMembershipService from '../services/itemMembership/service';
import { Actor, Member } from '../services/member/entities/member';
import { StorageService } from '../services/member/plugins/storage/service';
import { MemberService } from '../services/member/service';
import { ThumbnailService } from '../services/thumbnail/service';
import { WebsocketService } from '../services/websockets/ws-service';
import { H5PService } from './services/item/plugins/h5p/service';

declare module 'fastify' {
  interface FastifyInstance {
    db: DataSource;
    redis: Redis;

    jobs: {
      service: JobService;
    };

    // remove once fastify-nodemailer has types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodemailer: any;
    // remove once fastify-polyglot has types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    i18n: any;
    mailer: MailerDecoration;
    files: {
      service: FileService;
    };
    // should this be notifications?
    mentions: {
      service: MentionService;
    };
    thumbnails: {
      service: ThumbnailService;
    };
    items: {
      extendCreateSchema: ReturnType<typeof create>;
      extendExtrasUpdateSchema: ReturnType<typeof updateOne>;
      service: ItemService;
      files: {
        service: FileItemService;
      };
      actions: {
        service: ActionItemService;
      };
      thumbnails: {
        service: ItemThumbnailService;
      };
    };
    memberships: {
      service: ItemMembershipService;
    };
    itemsPublished: {
      service: ItemPublishedService;
    };
    itemsCategory: {
      service: ItemCategoryService;
    };
    search: {
      service: SearchService;
    };

    authentication: { service: AuthService };
    memberPassword: { service: MemberPasswordService };
    mobile: { service: MobileService };

    members: { service: MemberService };
    actions: { service: ActionService };
    chat: { service: ChatMessageService };
    storage: { service: StorageService };

    websockets: WebsocketService;
    h5p: { service: H5PService };
    etherpad: EtherpadItemService;

    corsPluginOptions: any;
    fetchMemberInSession: (request: FastifyRequest) => Promise<void>;
    generateRegisterLinkAndEmailIt: (
      member: Partial<Member>, // todo: force some content
      options: {
        challenge?: string;
        url?: string;
      },
    ) => Promise<void>;
    generateLoginLinkAndEmailIt: (
      member: Member,
      options: {
        challenge?: string;
        lang?: string;
        url?: string;
      },
    ) => Promise<void>;
  }

  interface PassportUser {
    member?: Member;
    uuid?: string;
  }

  interface FastifyRequest {
    authTokenSubject?: AuthTokenSubject;
  }
}

declare module '@fastify/secure-session' {
  interface SessionData {
    passport: string;
  }
}
