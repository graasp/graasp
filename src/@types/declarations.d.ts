/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { DataSource } from 'typeorm';

import { JobService } from '../jobs.js';
import type { MailerDecoration } from '../plugins/mailer/index.js';
import { ActionService } from '../services/action/services/action.js';
import { MobileService } from '../services/auth/plugins/mobile/service.js';
import { MemberPasswordService } from '../services/auth/plugins/password/service.js';
import { AuthService } from '../services/auth/service.js';
import { MentionService } from '../services/chat/plugins/mentions/service.js';
import { ChatMessageService } from '../services/chat/service.js';
import FileService from '../services/file/service.js';
import { Item } from '../services/item/entities/Item.js';
import { create, updateOne } from '../services/item/fluent-schema.js';
import { ActionItemService } from '../services/item/plugins/action/service.js';
import { EtherpadItemService } from '../services/item/plugins/etherpad/service.js';
import FileItemService from '../services/item/plugins/file/service.js';
import { ItemCategoryService } from '../services/item/plugins/itemCategory/services/itemCategory.js';
import { SearchService } from '../services/item/plugins/published/plugins/search/service.js';
import { ItemPublishedService } from '../services/item/plugins/published/service.js';
import { ItemThumbnailService } from '../services/item/plugins/thumbnail/service.js';
import ItemService from '../services/item/service.js';
import ItemMembershipService from '../services/itemMembership/service.js';
import { Member } from '../services/member/entities/member.js';
import { StorageService } from '../services/member/plugins/storage/service.js';
import { MemberService } from '../services/member/service.js';
import { ThumbnailService } from '../services/thumbnail/service.js';
import { WebsocketService } from '../services/websockets/ws-service.js';
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

    corsPluginOptions: FastifyCorsOptions;
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
    passwordResetRedisKey?: string; // Used for Password Reset
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
