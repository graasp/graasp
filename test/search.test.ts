import { MeiliSearch, TaskStatus as SearchTaskStatus } from 'meilisearch';
import searchPlugin from '../src/services/items/search';
import {parseItem} from '../src/services/items/search';
import ItemsServiceApi from '../src/services/items/service-api';
import graaspItemTags, { ItemTagService } from 'graasp-item-tags';
import { Actor, buildDocumentExtra, buildFileExtra, DocumentItemExtraProperties, EtherpadItemExtra, EtherpadItemExtraProperties, FileItemProperties, HttpMethod, ItemType, MAX_ITEM_MEMBERSHIPS_FOR_DELETE, PermissionLevel, TaskHookHandlerHelpers } from '@graasp/sdk';
import graaspItemPublishPlugin from 'graasp-plugin-item-publish';

import {
  DiscriminatedItem,
  PostHookHandlerType,
  ItemSettings,
  PreHookHandlerType,
  Item,
} from '@graasp/sdk';

import fastify, { FastifyLoggerInstance } from 'fastify';
import { PadOptionalRev,PadText } from '@graasp/etherpad-api';

import { AuthTokenSubject, Database, EtherpadService, H5PTaskManager, ItemMembershipService, ItemMembershipTaskManager, ItemService, ItemTaskManager, LocalFileConfiguration, Member, MemberService, MemberTaskManager, PublicItemService, PublicItemTaskManager, PublishItemTaskManager, S3FileConfiguration, WebsocketService } from '@graasp/sdk';

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
import { type } from 'os';
jest.mock('../src/plugins/database');
jest.mock('../src/plugins/auth/auth');
jest.mock('../src/plugins/decorator');

const meilisearchClient = new MeiliSearch({
  host: 'http://meilisearch:8080',
  apiKey: MEILISEARCH_API_MASTERKEY,
});
const itemIndex = 'itemjest';

describe('Meilisearch tests', () => {
  beforeEach( async () => {
    jest.clearAllMocks();
    await meilisearchClient.deleteIndexIfExists(itemIndex);
    // await new Promise((resolve) => setTimeout(resolve, 2000)); // Needs to wait for enque operations Delay (2 second)
  });

  describe('Meilisearch configuration', () => {

    let app: FastifyInstance;
    let log: FastifyLoggerInstance;
    // let publishHandler: PostHookHandlerType<DiscriminatedItem<ItemSettings>,unknown>;
    // let publishHandler: PostHookHandlerType<DiscriminatedItem>;
    let publishHandler: PostHookHandlerType<any>;
    // let handlertest: (data: DiscriminatedItem, actor: Actor, helpers: TaskHookHandlerHelpers, extraData?: unknown) => Promise<void> | void;
    // let updateHandler: PostHookHandlerType<T,unknown>;
    // let moveHandler: PostHookHandlerType<DiscriminatedItem,unknown>;
    let deleteHandler: PreHookHandlerType<any>;
    
    let getDescendants: () => null;
    beforeEach(async () => {
      app = fastify();
      log = app.log;
      app.decorate('taskRunner', {
        setTaskPostHookHandler: <T>(taskName: string, handler: PostHookHandlerType<T>) => {
          switch (taskName) {
            // case 'publish': publishHandler = <PostHookHandlerType<DiscriminatedItem>>(handler);
            case 'publish': publishHandler = handler;
          }
        },
        setTaskPreHookHandler: <T>(taskName: string, handler: PreHookHandlerType<T>) => {
          switch (taskName) {
            // case 'publish': publishHandler = <PostHookHandlerType<DiscriminatedItem>>(handler);
            case 'delete': deleteHandler = handler;
          }
        },
      });

      app.decorate('publish', {
        taskManager:{
          getPublishItemTaskName: () => 'publish',
        },
      });

      app.decorate('etherpad', {
        api:{getText: function x():void{console.log('help');}},
      });

      // app.decorate('publish', {
      //   taskManager:{
      //     getPublishItemTaskName: () => 'publish',
      //   },
      // });


      // function myFunction(): void {
      //   console.log('My function is called');
      // }

      
      app.decorate('items', {
        dbService: {
          getDescendants: function x():void{console.log('help');},
        },
        taskManager:{
          getUpdateTaskName:() => '',
          getDeleteTaskName:() => '',
          getMoveTaskName:() => '',
        }
      });
      
      if (app.etherpad === undefined)
        throw new Error('Error etherpad is undefined');
      jest.spyOn(app.etherpad.api, 'getText').mockImplementation(async (qs: PadOptionalRev, throwOnEtherpadError?: boolean):Promise<Pick<PadText, 'text'> | null>=> { const sampleTextEtherpad:PadText = {padID:'0001',text:'this is a sample text for etherpad'};
     return sampleTextEtherpad; 
    });
      const itemTagService = new ItemTagService();
      await app.register(searchPlugin,{ tags: { service: itemTagService }, indexName:itemIndex});
    });
    // it('Document item', async () => {
    //   jest.spyOn(app.items.dbService, 'getDescendants').mockImplementationOnce(async () => { return [];});
    //   const extra_info:FileItemProperties = {
    //     name: 'sample',
    //     path: 'sample',
    //     mimetype: 'pdf',
    //     size: 200,
    //   };

    //   const extra_info_document:DocumentItemExtraProperties = {content:'this is something'};
    //   const options = {
    //     type:  ItemType.DOCUMENT,
    //     extra: buildDocumentExtra(extra_info_document),
    //   };
    //   const item = getDummyItem(options);
    //   const actor:Actor = {id:'lol',};
    //   const {etherpad} = app;
    //   if (etherpad === undefined)
    //     throw Error('Error etherpad undefined'); 
    //   const expected = await parseItem(<DiscriminatedItem>(item), etherpad);
    //   await publishHandler(item,actor,{log});
    //   await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
    //   const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
    //   expect(indexDocument).toEqual(expected);

    //   await app.close();

    // });

    // it('Etherpad item', async () => {
    //   const extra_info:EtherpadItemExtraProperties = {
    //     padID: 'xxxx',
    //     groupID: 'xxxx',
    //   };
      
    //   const y:EtherpadItemExtra = {[ItemType.ETHERPAD]:extra_info};
    //   const options = {
    //     type:  ItemType.ETHERPAD,
    //     extra: y,
    //   };
    //   const item = getDummyItem(options);
    //   const actor:Actor = {id:'lol',};
    //   const {etherpad} = app;
    //   if (etherpad === undefined)
    //     throw Error('Error etherpad undefined'); 
    //   const expected = await parseItem(<DiscriminatedItem>(item), etherpad);
    //   await publishHandler(item,actor,{log});
    //   await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
    //   const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
    //   expect(indexDocument).toEqual(expected);

    //   await app.close();

    // });

    it('Local file item', async () => {
      const extra_info:FileItemProperties = {
        name: 'sample_ocr',
        path: 'files/1111/test/3ac9-1115440217608.pdf',
        mimetype: 'pdf',
        size: 10,
      };
      
      const options = {
        type:  ItemType.LOCAL_FILE,
        extra: buildFileExtra(extra_info),
      };
      const item = getDummyItem(options);
      const actor:Actor = {id:'lol',};
      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const expected = await parseItem(<DiscriminatedItem>(item), etherpad);
      await publishHandler(item,actor,{log});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
      expect(indexDocument).toEqual(expected);
      await app.close();
    });
    

    // it('On publish', async () => {

    //   jest.spyOn(app.items.dbService, 'getDescendants').mockImplementationOnce(async () => { return [];});
      
    //   const options = {
    //     type:  ItemType.DOCUMENT,
    //   };

    //   const item = getDummyItem(options);
    //   const actor:Actor = {id:'lol',};
    //   publishHandler(item,actor,{log});
    //   await app.close();

    // });
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
