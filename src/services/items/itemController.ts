
import { FastifyPluginAsync } from 'fastify';

import {
  IdParam,
  IdsParams,
  ItemTaskManager,
  MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
  ParentIdParam,
  PermissionLevel,
} from '@graasp/sdk';
import graaspApps from 'graasp-apps';
import graaspDocumentItem from 'graasp-document-item';
import graaspEmbeddedLinkItem from 'graasp-embedded-link-item';
import graaspItemFlags from 'graasp-item-flagging';
import graaspItemTags, { ItemTagService } from 'graasp-item-tags';
import {
  ActionHandlerInput,
  ActionService,
  ActionTaskManager,
  BaseAction,
} from 'graasp-plugin-actions';
import graaspCategoryPlugin from 'graasp-plugin-categories';
import graaspChatbox from 'graasp-plugin-chatbox';
import fileItemPlugin from 'graasp-plugin-file-item';
import graaspItemH5P from 'graasp-plugin-h5p';
import graaspHidden from 'graasp-plugin-hidden-items';
import graaspInvitationsPlugin from 'graasp-plugin-invitations';
import graaspPluginItemLikes from 'graasp-plugin-item-likes';
import graaspItemLogin from 'graasp-plugin-item-login';
import graaspItemPublishPlugin from 'graasp-plugin-item-publish';
import graaspItemZip from 'graasp-plugin-item-zip';
import graaspRecycleBin from 'graasp-plugin-recycle-bin';
import thumbnailsPlugin, {
  THUMBNAIL_MIMETYPE,
  buildFilePathWithPrefix,
} from 'graasp-plugin-thumbnails';
import graaspValidationPlugin from 'graasp-plugin-validation';

import {
  APPS_JWT_SECRET,
  APPS_PLUGIN,
  APPS_PUBLISHER_ID,
  APP_ITEMS_PREFIX,
  AUTH_CLIENT_HOST,
  CHATBOX_PLUGIN,
  CLIENT_HOSTS,
  EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
  EMBEDDED_LINK_ITEM_PLUGIN,
  FILES_PATH_PREFIX,
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_TYPE,
  GRAASP_ACTOR,
  H5P_CONTENT_PLUGIN_OPTIONS,
  H5P_PATH_PREFIX,
  HIDDEN_ITEMS_PLUGIN,
  HIDDEN_TAG_ID,
  IMAGE_CLASSIFIER_API,
  ITEMS_ROUTE_PREFIX,
  LOGIN_ITEM_TAG_ID,
  PROTOCOL,
  PUBLIC_TAG_ID,
  PUBLISHED_TAG_ID,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  SAVE_ACTIONS,
  THUMBNAILS_PATH_PREFIX,
  THUMBNAILS_ROUTE_PREFIX,
  WEBSOCKETS_PLUGIN,
} from '../../util/config';
import {
  copyMany,
  copyOne,
  create,
  deleteMany,
  deleteOne,
  getChildren,
  getDescendants,
  getMany,
  getOne,
  getOwn,
  getShared,
  moveMany,
  moveOne,
  updateMany,
  updateOne,
} from './fluent-schema';
import { itemActionHandler } from './handler/item-action-handler';
import { Ordered } from './interfaces/requests';
import { TaskManager } from './task-manager';
import { registerItemWsHooks } from './ws/hooks';
import { Item } from './entities/Item';
import { In } from 'typeorm';
import { ItemMembership } from '../item-memberships/entities/ItemMembership';


const plugin : FastifyPluginAsync = async (fastify) => {
const {db} =fastify;
  const itemRepository = db.getRepository(Item);
  const itemTreeRepository = db.getTreeRepository(Item);
  const itemMembershipRepository = db.getRepository(ItemMembership);

          // create item
          fastify.post<{ Querystring: ParentIdParam, Body:Partial<Item> }>(
            '/',
            { schema: create() },
            async ({ member, query: { parentId }, body: data, log }) => {
              const newItem = new Item();
              if(parentId) {
                newItem.parent = await itemRepository.findOneBy({id:parentId});
              }
              return itemRepository.create({...newItem, ...data});
            },
          );

          // get item
          fastify.get<{ Params: IdParam }>(
            '/:id',
            { schema: getOne },
            async ({ member, params: { id }, log }) => {
              return itemRepository.findOneBy({id});
            },
          );

          fastify.get<{ Querystring: IdsParams }>(
            '/',
            { schema: getMany },
            async ({ member, query: { id: ids }, log }) => {
              return itemRepository.find({ where: { id: In(ids) } });
            },
          );

          // get own
          fastify.get('/own', { schema: getOwn }, async ({ member, log }) => {
            return itemRepository.findBy({ creator:{id:member.id} });
          });

          // get shared with
          fastify.get<{ Querystring: { permission?: string[] } }>(
            '/shared-with',
            { schema: getShared },
            async ({ member, log, query }) => {

              // default: any permission
              const permissions = query?.permission ?? Object.values(PermissionLevel);
              
              // TODO: return items
              return itemMembershipRepository.find({where: { permission:In(permissions), member: {id:member.id}}});
            },
          );

          // get item's children
          fastify.get<{ Params: IdParam; Querystring: Ordered }>(
            '/:id/children',
            { schema: getChildren },
            async ({ member, params: { id }, query: { ordered }, log }) => {
              const item = await itemRepository.findOneBy({id});
              return itemTreeRepository.findDescendants(item, {depth:1});
            },
          );

          // get item's descendants
          fastify.get<{ Params: IdParam }>(
            '/:id/descendants',
            { schema: getDescendants },
            async ({ member, params: { id }, log }) => {
              const item = await itemRepository.findOneBy({id});
              return itemTreeRepository.findDescendantsTree(item);
            },
          );

          // update items
          fastify.patch<{ Params: IdParam, Body:Partial<Item>  }>(
            '/:id',
            { schema: updateOne() },
            async ({ member, params: { id }, body, log }) => {
              // TODO: extra + settings
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              return itemRepository.update(id, body);
            },
          );

          fastify.patch<{ Querystring: IdsParams, Body:Partial<Item> }>(
            '/',
            { schema: updateMany() },
            async ({ member, query: { id: ids }, body, log }, reply) => {

              // TODO: CHECK FOR LOTS OF ITEMS

              const ops = ids.map(async (id)=>itemRepository.update(id,body));

              // too many items to update: start execution and return '202'.
              if (ids.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
                
                // async
                Promise.all(ops);

                reply.status(202);
                return ids;
              }

              return Promise.all(ops);
            },
          );

          // delete items
          fastify.delete<{ Params: IdParam }>(
            '/:id',
            { schema: deleteOne },
            async ({ member, params: { id }, log }) => {
              await itemRepository.delete(id);
              return id;
            },
          );

          // fastify.delete<{ Querystring: IdsParams }>(
          //   '/',
          //   { schema: deleteMany },
          //   async ({ member, query: { id: ids }, log }, reply) => {
          //     const tasks = ids.map((id) => taskManager.createDeleteTaskSequence(member, id));

          //     // too many items to delete: start execution and return '202'.
          //     if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
          //       runner.runMultipleSequences(tasks, log);
          //       reply.status(202);
          //       return ids;
          //     }

          //     return runner.runMultipleSequences(tasks, log);
          //   },
          // );

          // move item
          fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
            '/:id/move',
            { schema: moveOne },
            async ({ member, params: { id }, body: { parentId }, log }, reply) => {
              
              // TODO: CHECK CHILDREN MOVE
              const item = await itemRepository.findOneBy({id});
              const parent =  await itemRepository.findOneBy({id:parentId});

              item.parent= parent;
              await itemRepository.update(id,item);
              
              return id;
            },
          );

          // fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
          //   '/move',
          //   { schema: moveMany },
          //   async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
          //     const tasks = ids.map((id) =>
          //       taskManager.createMoveTaskSequence(member, id, parentId),
          //     );

          //     // too many items to move: start execution and return '202'.
          //     if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
          //       runner.runMultipleSequences(tasks, log);
          //       reply.status(202);
          //       return ids;
          //     }

          //     return runner.runMultipleSequences(tasks, log);
          //   },
          // );

          // copy items
          fastify.post<{ Params: IdParam; Body: { parentId: string; shouldCopyTags?: boolean } }>(
            '/:id/copy',
            { schema: copyOne },
            async ({ member, params: { id }, body: { parentId, shouldCopyTags }, log }) => {
              
              // TODO: CHECK CHILDREN MOVE
              const item =  await itemRepository.findOneBy({id});
              const itemTree = await itemTreeRepository.findDescendantsTree(item);
              const parent =  await itemRepository.findOneBy({id:parentId});

              // TODO
              // delete id to trigger insert
              itemTree.children.map((thisItem)=>{
                delete thisItem.id;

              });

              item.parent= parent;
              await itemRepository.create(item);
              
              return id;
            },
          );

          // fastify.post<{
          //   Querystring: IdsParams;
          //   Body: { parentId: string; shouldCopyTags?: boolean };
          // }>(
          //   '/copy',
          //   { schema: copyMany },
          //   async (
          //     { member, query: { id: ids }, body: { parentId, shouldCopyTags }, log },
          //     reply,
          //   ) => {
          //     const tasks = ids.map((id) =>
          //       taskManager.createCopyTaskSequence(member, id, { parentId, shouldCopyTags }),
          //     );

          //     // too many items to copy: start execution and return '202'.
          //     if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
          //       runner.runMultipleSequences(tasks, log);
          //       reply.status(202);
          //       return ids;
          //     }

          //     return runner.runMultipleSequences(tasks, log);
          //   },
          // );
};

export default plugin;
