import { DataSource } from 'typeorm';

import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { AuthTokenSubject, RecaptchaActionType } from '@graasp/sdk';

import databasePlugin from './plugins/database';
import decoratorPlugin from './plugins/decorator';
import type { MailerDecoration } from './plugins/mailer';
import mailerPlugin from './plugins/mailer';
import metaPlugin from './plugins/meta';
import shared from './schemas/fluent-schema';
import { ActionService } from './services/action/services/action';
import authPlugin from './services/auth';
import { MentionService } from './services/chat/plugins/mentions/service';
import filePlugin from './services/file';
import FileService from './services/file/service';
import ItemServiceApi from './services/item';
import { ActionItemService } from './services/item/plugins/action/service';
import FileItemService from './services/item/plugins/file/service';
import ItemService from './services/item/service';
import ItemMembershipServiceApi from './services/itemMembership';
import MemberServiceApi from './services/member';
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
    };
    members: { service: MemberService };
    actions: { service: ActionService };

    // TODO
    hosts: any;
    websockets: WebsocketService;
    
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
      challenge?: string,
    ) => Promise<{
      authToken: string;
      refreshToken: string;
    }>;
    generateLoginLinkAndEmailIt: (
      member: Member,
      challenge?: string,
      lang?: string,
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
