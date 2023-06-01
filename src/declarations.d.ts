import { DataSource } from 'typeorm';

import 'fastify';

import { AuthTokenSubject, RecaptchaActionType } from '@graasp/sdk';

import type { MailerDecoration } from './plugins/mailer';
import { ActionService } from './services/action/services/action';
import { MentionService } from './services/chat/plugins/mentions/service';
import FileService from './services/file/service';
import { ActionItemService } from './services/item/plugins/action/service';
import FileItemService from './services/item/plugins/file/service';
import { H5PService } from './services/item/plugins/h5p/service';
import { ItemThumbnailService } from './services/item/plugins/thumbnail/service';
import ItemService from './services/item/service';
import { Actor, Member } from './services/member/entities/member';
import { MemberService } from './services/member/service';
import { WebsocketService } from './services/websockets/ws-service';

declare module 'fastify' {
  interface FastifyInstance {
    db: DataSource;

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
    members: { service: MemberService };
    actions: { service: ActionService };

    // TODO
    hosts: any;
    websockets: WebsocketService;
    h5p: H5PService;

    corsPluginOptions: any;
    verifyAuthentication: (request: FastifyRequest) => Promise<void>;
    validateCaptcha: (
      request: FastifyRequest,
      captcha: string,
      actionType: RecaptchaActionType,
    ) => Promise<void>;
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
