import { MeiliSearch, TaskStatus as SearchTaskStatus } from 'meilisearch';
import searchPlugin from '../src/services/items/search';
import ItemsServiceApi from '../src/services/items/service-api';
import graaspItemTags, { ItemTagService } from 'graasp-item-tags';
import { HttpMethod, MAX_ITEM_MEMBERSHIPS_FOR_DELETE, PermissionLevel } from '@graasp/sdk';
import graaspItemPublishPlugin from 'graasp-plugin-item-publish';

import {
  DiscriminatedItem,
  PostHookHandlerType,
  ItemSettings,
  Item,
} from '@graasp/sdk';

import fastify from 'fastify';

import graaspItemEtherpad from '@graasp/plugin-etherpad';

import { TaskRunner } from '@graasp/sdk';

// import { MEILISEARCH_API_MASTERKEY, 
//       APPS_JWT_SECRET,
//       APPS_PLUGIN,
//       APPS_PUBLISHER_ID,
//       APP_ITEMS_PREFIX,
//       AUTH_CLIENT_HOST,
//       CHATBOX_PLUGIN,
//       CLIENT_HOSTS,
//       EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
//       EMBEDDED_LINK_ITEM_PLUGIN,
//       ETHERPAD_API_KEY,
//       ETHERPAD_COOKIE_DOMAIN,
//       ETHERPAD_PUBLIC_URL,
//       ETHERPAD_URL,
//       FILES_PATH_PREFIX,
//       FILE_ITEM_PLUGIN_OPTIONS,
//       FILE_ITEM_TYPE,
//       GRAASP_ACTOR,
//       H5P_CONTENT_PLUGIN_OPTIONS,
//       H5P_PATH_PREFIX,
//       HIDDEN_ITEMS_PLUGIN,
//       HIDDEN_TAG_ID,
//       IMAGE_CLASSIFIER_API,
//       ITEMS_ROUTE_PREFIX,
//       LOGIN_ITEM_TAG_ID,
//       PROTOCOL,
//       PUBLIC_TAG_ID,
//       PUBLISHED_TAG_ID,
//       S3_FILE_ITEM_PLUGIN_OPTIONS,
//       SAVE_ACTIONS,
//       THUMBNAILS_PATH_PREFIX,
//       THUMBNAILS_ROUTE_PREFIX,
//       WEBSOCKETS_PLUGIN,
//     } from '../src/util/config';
import build from './app';
import { getDummyItem } from './fixtures/items';
import * as MEMBERS_FIXTURES from './fixtures/members';
import { buildMembership } from './fixtures/memberships';
import {
  mockItemMemberhipServiceDelete,
  mockItemMemberhipServiceGet,
  mockItemMemberhipServiceGetAllBelow,
  mockItemMemberhipServiceGetInherited,
  mockItemMemberhipServiceGetInheritedForAll,
  mockItemMembershipServiceCreate,
  mockItemMembershipServiceGetAllInSubtree,
  mockItemMembershipServiceGetForMemberAtItem,
  mockItemMembershipServiceUpdate,
  mockItemServiceGet,
  mockItemServiceGetMatchingPath,
  mockMemberServiceGet,
} from './mocks';


import fastifyCors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import graaspWebsockets from '@graasp/plugin-websockets';
import mailerPlugin from 'graasp-mailer';
import graaspPluginActions from 'graasp-plugin-actions';

import authPlugin from '../src/plugins/auth/auth';
import databasePlugin from '../src/plugins/database';
import decoratorPlugin from '../src/plugins/decorator';
import metaPlugin from '../src/plugins/meta';
import publicPlugin from '../src/plugins/public';
import shared from '../src/schemas/fluent-schema';
import ItemMembershipsServiceApi from '../src/services/item-memberships/service-api';
import MemberServiceApi from '../src/services/members/service-api';
import {
  MEILISEARCH_API_MASTERKEY,
  CLIENT_HOSTS,
  COOKIE_DOMAIN,
  DATABASE_LOGS,
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_TYPE,
  GRAASP_ACTOR,
  MAILER_CONFIG_FROM_EMAIL,
  MAILER_CONFIG_PASSWORD,
  MAILER_CONFIG_SMTP_HOST,
  MAILER_CONFIG_USERNAME,
  PG_CONNECTION_URI,
  PG_READ_REPLICAS_CONNECTION_URIS,
  PUBLIC_PLUGIN,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  SAVE_ACTIONS,
  WEBSOCKETS_PLUGIN,

  PUBLIC_TAG_ID,
  PUBLISHED_TAG_ID,
} from '../src/util/config';


// mock auth, decorator and database plugins
jest.mock('../src/plugins/database');
jest.mock('../src/plugins/auth/auth');
jest.mock('../src/plugins/decorator');

const meilisearchClient = new MeiliSearch({
  host: 'http://meilisearch:8080',
  apiKey: MEILISEARCH_API_MASTERKEY,
});
const itemIndex = 'testIndex';
describe('Meilisearch tests', () => {
  beforeEach( async () => {
    jest.clearAllMocks();
    // await meilisearchClient.deleteIndexIfExists(itemIndex);
  });

  describe('Meilisearch configuration', () => {

    jest.setTimeout(1000*10);
    it('Create index', async () => {
      const item = getDummyItem();
      // const memberships = [buildMembership({ permission: PermissionLevel.Read, path: item.path })];
      // const status = await meilisearchClient.isHealthy();
      // expect(status).toEqual(true);
      // if (status) {
      //     const index = await meilisearchClient.createIndex(itemIndex);
      //     expect(index.indexUid).toEqual(itemIndex);
      // }
    });
    

    it('On publish', async () => {
      // await app.register(ItemsServiceApi);
      const itemTagService = new ItemTagService();
      const instance = await build();
    //   const instance:FastifyInstance = await fastify({
    //     logger: false,
    //     ajv: {
    //       customOptions: {
    //         coerceTypes: 'array',
    //       },
    //     },
    //   });

    //   console.log(PG_CONNECTION_URI);
    //   console.log(REDIS_PORT);
    //   if (PG_CONNECTION_URI === undefined || REDIS_PORT === undefined)
    //     throw new Error('Values should not be undefined');

    //   instance.addSchema(shared);
    //   instance
    //   .register(fp(databasePlugin), {
    //     uri: PG_CONNECTION_URI,
    //     readReplicaUris: PG_READ_REPLICAS_CONNECTION_URIS,
    //     logs: DATABASE_LOGS,
    //   })
    //   .register(fp(decoratorPlugin))
    // .register(metaPlugin);

    // instance.register(async (instance) => {
    //   // core API modules
    //   await instance
    //     .register(fp(MemberServiceApi))
    //     .register(fp(ItemMembershipsServiceApi))
    //     .register(fp(ItemsServiceApi));
  
    //   if (PUBLIC_PLUGIN) {
    //     await instance.register(publicPlugin);
    //   }
    // });

    
    // instance.register(
    //   async (instance) => {
    //     // add CORS support
    //     if (instance.corsPluginOptions) {
    //       instance.register(fastifyCors, instance.corsPluginOptions);
    //     }
    //     instance.addHook('preHandler', instance.verifyAuthentication);
    //   },
    //   { prefix: '/analytics' },
    // );
       
   const x = instance.taskRunner;
      
      const handlerPromise = new Promise<PostHookHandlerType<DiscriminatedItem<ItemSettings>,unknown>>((resolve, reject) => {
        jest
        .spyOn(instance.taskRunner, 'setTaskPostHookHandler')
        .mockImplementationOnce( (taskName,handler) => {
          console.log('calling we can resolve');
          // const x:PostHookHandlerType<DiscriminatedItem<ItemSettings>,unknown> = handler;
          resolve(handler);
        });
      });
      // const app = await build();
      // await app.register(searchPlugin, { tags: { service: itemTagService } });

      // if (CLIENT_HOSTS.find(({ name }) => name === 'explorer')?.hostname !== undefined)
      //   client_host = CLIENT_HOSTS.find(({ name }) => name === 'explorer')?.hostname;
      const client_host = 'http://localhost:3005';
      console.log(client_host);
      console.log(PUBLISHED_TAG_ID);
      console.log(PUBLIC_TAG_ID);
      if (PUBLISHED_TAG_ID === undefined || PUBLIC_TAG_ID === undefined
        ||client_host === undefined)
          throw new Error('Values should not be undefined');


      await instance.register(fp(graaspItemPublishPlugin), {
        publishedTagId: PUBLISHED_TAG_ID,
        publicTagId: PUBLIC_TAG_ID,
        graaspActor: GRAASP_ACTOR,
        hostname:client_host,
      });

      
      await instance.register(searchPlugin, { tags: { service: itemTagService } });

      // const handler = await handlerPromise;

      // app.decorate('file', {
      //   s3Config: S3_FILE_ITEM_PLUGIN_OPTIONS,
      //   localConfig: FILE_ITEM_PLUGIN_OPTIONS,
      // });

      // let ether_url = '';
      // if (ETHERPAD_URL !== undefined)
      //   ether_url = ETHERPAD_URL;
      // let api_key = '';
      // if(ETHERPAD_API_KEY !== undefined)
      //   api_key = ETHERPAD_API_KEY;

      // await app.register(graaspItemEtherpad, {
      //   url: ether_url,
      //   apiKey: api_key,
      //   publicUrl: ETHERPAD_PUBLIC_URL,
      //   cookieDomain: ETHERPAD_COOKIE_DOMAIN,
      // });

      // await app.register(searchPlugin, { tags: { service: itemTagService } });
      // const handler = await handlerPromise;
      instance.close();

      // const item:Partial<DiscriminatedItem<ItemSettings>> = getDummyItem();
      // await handler(null,null,{log,handler});
    });
  });

  // describe('Meilisearch hooks', () => {
  //   it('On publish', async () => {
  //     const app = await build();
  //     const itemTagService = new ItemTagService();
  //     const handlerPromise = new Promise((resolve, reject) => {
  //       jest
  //         .spyOn(app.taskRunner, 'setTaskPostHookHandler')
  //         .mockImplementationOnce((handler) => {
  //         resolve(handler);
  //       });
  //     });

  //     await app.register(searchPlugin, { tags: { service: itemTagService } });
  //     const handler = await handlerPromise;
  //     const item = getDummyItem();
  //     await handler(item);
  //     // const status = await meilisearchClient.isHealthy();
  //     // expect(status).toEqual(true);
  //     // if (status) {

  //     // }

  //   });
  // });

});
