import { DataSource } from 'typeorm';

import 'fastify';
import { preHandlerHookHandler } from 'fastify';

import { AuthTokenSubject, RecaptchaActionType } from '@graasp/sdk';

import { create, updateOne } from '../services/item/fluent-schema';
import { ActionItemService } from '../services/item/plugins/action/service';
import { EtherpadItemService } from '../services/item/plugins/etherpad/service';
import FileItemService from '../services/item/plugins/file/service';
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
      files: {
        service: FileItemService;
      };
      actions: {
        service: ActionItemService;
      };
    };
    websockets: WebsocketService;
    etherpad: EtherpadItemService;
    corsPluginOptions: any;
    verifyAuthentication:
      | preHandlerHookHandler<
          RawServer,
          RawRequest,
          RawReply,
          RouteGenericInterface,
          ContextConfigDefault,
          FastifySchema,
          TypeProvider,
          Logger
        >
      | ((request: FastifyRequest) => Promise<void>);
    validateCaptcha: (
      request: FastifyRequest,
      captcha: string,
      actionType: RecaptchaActionType,
      options?: { shouldFail?: boolean },
    ) => Promise<void>;
    attemptVerifyAuthentication:
      | preHandlerHookHandler<
          RawServer,
          RawRequest,
          RawReply,
          RouteGenericInterface,
          ContextConfigDefault,
          FastifySchema,
          TypeProvider,
          Logger
        >
      | ((request: FastifyRequest) => Promise<void>);
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

  interface FastifyRequest {
    member: Actor;
    memberId: string;
    authTokenSubject?: AuthTokenSubject;
    user?: { uuid: string };
  }

  interface PassportUser {
    uuid: string;
  }
}

declare module '@fastify/secure-session' {
  interface SessionData {
    member: string;
  }
}
