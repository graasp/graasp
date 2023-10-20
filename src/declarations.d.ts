import { DataSource } from 'typeorm';

import 'fastify';

import { AuthTokenSubject, Hostname, RecaptchaActionType } from '@graasp/sdk';

import { JobService } from './jobs';
import type { MailerDecoration } from './plugins/mailer';
import { ActionService } from './services/action/services/action';
import { MentionService } from './services/chat/plugins/mentions/service';
import { ChatMessageService } from './services/chat/service';
import FileService from './services/file/service';
import { ActionItemService } from './services/item/plugins/action/service';
import { EtherpadItemService } from './services/item/plugins/etherpad/service';
import FileItemService from './services/item/plugins/file/service';
import { H5PService } from './services/item/plugins/h5p/service';
import { ItemCategoryService } from './services/item/plugins/itemCategory/services/itemCategory';
import { SearchService } from './services/item/plugins/published/plugins/search/service';
import { ItemPublishedService } from './services/item/plugins/published/service';
import { ItemThumbnailService } from './services/item/plugins/thumbnail/service';
import ItemService from './services/item/service';
import ItemMembershipService from './services/itemMembership/service';
import { Actor, Member } from './services/member/entities/member';
import { StorageService } from './services/member/plugins/storage/service';
import { MemberService } from './services/member/service';
import { WebsocketService } from './services/websockets/ws-service';

declare module 'fastify' {
  interface FastifyInstance {
    db: DataSource;

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
    items: {
      extendCreateSchema: any;
      extendExtrasUpdateSchema: any;
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
    members: { service: MemberService };
    actions: { service: ActionService };
    chat: { service: ChatMessageService };
    storage: { service: StorageService };

    websockets: WebsocketService;
    h5p: H5PService;
    etherpad: EtherpadItemService;

    corsPluginOptions: any;
    verifyAuthentication: (request: FastifyRequest) => Promise<void>;
    validateCaptcha: (
      request: FastifyRequest,
      captcha: string,
      actionType: RecaptchaActionType,
    ) => Promise<void>;
    attemptVerifyAuthentication: (request: FastifyRequest) => Promise<void>;
    fetchMemberInSession: (request: FastifyRequest) => Promise<void>;
    generateAuthTokensPair: (memberId: string) => Promise<{
      authToken: string;
      refreshToken: string;
    }>;
    generateRegisterLinkAndEmailIt: (
      member: Partial<Member>, // todo: force some content
      options: {
        challenge?: string;
        url?: string;
      },
    ) => Promise<{
      authToken: string;
      refreshToken: string;
    }>;
    generateLoginLinkAndEmailIt: (
      member: Member,
      options: {
        challenge?: string;
        lang?: string;
        url?: string;
      },
    ) => Promise<{
      authToken: string;
      refreshToken: string;
    }>;
  }

  interface FastifyRequest {
    member: Actor;
    memberId: string;
    authTokenSubject?: AuthTokenSubject;
  }
}
