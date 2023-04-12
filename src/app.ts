import { DataSource } from 'typeorm';

import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { AuthTokenSubject } from '@graasp/sdk';

import databasePlugin from './plugins/database';
import decoratorPlugin from './plugins/decorator';
import mailerPlugin from './plugins/mailer';
import metaPlugin from './plugins/meta';
import shared from './schemas/fluent-schema';
import { ActionService } from './services/action/services/action';
import authPlugin from './services/auth';
import { MentionService } from './services/chat/plugins/mentions/service';
import filePlugin from './services/file';
import FileService from './services/file/service';
import ItemServiceApi from './services/item';
import FileItemService from './services/item/plugins/file/service';
import ItemService from './services/item/service';
import ItemMembershipServiceApi from './services/itemMembership';
import MemberServiceApi from './services/member';
import { Actor, Member } from './services/member/entities/member';
import { MemberService } from './services/member/service';
import {
  CLIENT_HOSTS,
  COOKIE_DOMAIN,
  DATABASE_LOGS,
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_TYPE,
  MAILER_CONFIG_FROM_EMAIL,
  MAILER_CONFIG_PASSWORD,
  MAILER_CONFIG_SMTP_HOST,
  MAILER_CONFIG_USERNAME,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
} from './util/config';
import { ActionItemService } from './services/item/plugins/action/service';

// TODO: REMOVE
declare module 'fastify' {
  interface FastifyInstance {
    db: DataSource;
    verifyAuthentication: (request: FastifyRequest) => Promise<void>;
    items: {
      extendCreateSchema: any;
      extendExtrasUpdateSchema: any;
      service: ItemService;
      files: {
        service: FileItemService;
      };
      actions: {
        service: ActionItemService
      }
    };
    members: { service: MemberService };
    actions: { service: ActionService };
    corsPluginOptions: any;

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

    // remove once fastify-nodemailer has types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodemailer: any;
    // remove once fastify-polyglot has types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    i18n: any;
    mailer: {
      buildButton: (link: string, text: string) => string;
      buildText: (string) => string;
      sendEmail: (
        subject: string,
        to: string,
        text: string,
        html?: string,
        from?: string,
      ) => Promise<void>;
      // TODO: this is i18next's t type
      translate: (lang: string) => (key: string, variables?: any) => string;
    };
    files: {
      service: FileService;
    };
    // should this be notifications?
    mentions: {
      service: MentionService;
    };
    // TODO
    hosts: any;
  }

  interface FastifyRequest {
    member: Actor;
    memberId: string;
    authTokenSubject?: AuthTokenSubject;
  }
}

export default async function (instance: FastifyInstance): Promise<void> {
  instance.decorate('hosts', CLIENT_HOSTS);

  // load some shared schema definitions
  instance.addSchema(shared);

  instance
    .register(fp(metaPlugin))
    .register(fp(databasePlugin), {
      logs: DATABASE_LOGS,
    })
    .register(fp(decoratorPlugin))
    .register(mailerPlugin, {
      host: MAILER_CONFIG_SMTP_HOST,
      username: MAILER_CONFIG_USERNAME,
      password: MAILER_CONFIG_PASSWORD,
      fromEmail: MAILER_CONFIG_FROM_EMAIL,
    });

  // need to be defined before member and item for auth check
  await instance.register(fp(authPlugin), { sessionCookieDomain: COOKIE_DOMAIN });

  // file
  await instance.register(fp(filePlugin), {
    fileItemType: FILE_ITEM_TYPE,
    fileConfigurations: {
      s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
      local: FILE_ITEM_PLUGIN_OPTIONS,
    },
  });

  // if (WEBSOCKETS_PLUGIN) {
  //   await instance.register(graaspWebSockets, {
  //     prefix: '/ws',
  //     redis: {
  //       config: {
  //         host: REDIS_HOST,
  //         port: +REDIS_PORT,
  //         username: REDIS_USERNAME,
  //         password: REDIS_PASSWORD,
  //       },
  //     },
  //   });
  // }

  instance.register(async (instance) => {
    // core API modules
    await instance
      .register(fp(MemberServiceApi))
      .register(fp(ItemServiceApi))
      .register(fp(ItemMembershipServiceApi));

    // instance.register(
    //   async (instance) => {
    //     // add CORS support
    //     if (instance.corsPluginOptions) {
    //       instance.register(fastifyCors, instance.corsPluginOptions);
    //     }
    //     instance.addHook('preHandler', instance.verifyAuthentication);
    //     instance.register(graaspPluginActions, {
    //       shouldSave: SAVE_ACTIONS,
    //       graaspActor: GRAASP_ACTOR,
    //       hosts: CLIENT_HOSTS,
    //       fileItemType: FILE_ITEM_TYPE,
    //       fileConfigurations: {
    //         s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
    //         local: FILE_ITEM_PLUGIN_OPTIONS,
    //       },
    //     });
    //   },
    //   { prefix: '/analytics' },
    // );
  });
}

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...
