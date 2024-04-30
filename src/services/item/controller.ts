import { StatusCodes } from 'http-status-codes';

import fastifyMultipart, { Multipart, MultipartFields, MultipartFile } from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { ItemType, ItemTypeUnion, PermissionLevel } from '@graasp/sdk';

import { IdParam, IdsParams, PaginationParams } from '../../types';
import { NoFileProvided, UnauthorizedMember } from '../../utils/errors';
import { buildRepositories } from '../../utils/repositories';
import { resultOfToList } from '../utils';
import { Item } from './entities/Item';
import {
  copyMany,
  deleteMany,
  getAccessible,
  getChildren,
  getDescendants,
  getMany,
  getOne,
  getOwn,
  getParents,
  getShared,
  moveMany,
  updateMany,
} from './fluent-schema';
import { ItemGeolocation } from './plugins/geolocation/ItemGeolocation';
import { ItemChildrenParams, ItemSearchParams } from './types';
import { parseAndValidateField } from './utils';
import { validateGeolocation, validateSettings } from './validation';
import { ItemOpFeedbackEvent, memberItemsTopic } from './ws/events';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items, websockets } = fastify;
  const itemService = items.service;
  const actionItemService = items.actions.service;

  // create item
  // question: add link hook here? or have another endpoint?
  fastify.post<{
    Querystring: {
      parentId?: string;
    };
    Body: Partial<Item> & Pick<Item, 'name' | 'type'> & Pick<ItemGeolocation, 'lat' | 'lng'>;
  }>(
    '/',
    {
      schema: items.extendCreateSchema(),
      preHandler: fastify.verifyAuthentication,
    },
    async (request) => {
      const {
        member,
        query: { parentId },
        body: data,
      } = request;

      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await itemService.post(member, repositories, {
          item: data,
          parentId,
          geolocation: data.geolocation,
        });
        await actionItemService.postPostAction(request, repositories, item);
        return item;
      });
    },
  );

  // isolate inside a register because of the mutlipart
  fastify.register(async (fastify) => {
    fastify.register(fastifyMultipart, {
      limits: {
        // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
        // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
        // fields: 5, // Max number of non-file fields (Default: Infinity).
        // allow some fields for app data and app setting
        fileSize: 1024 * 1024 * 10, // For multipart forms, the max file size (Default: Infinity).
        files: 1, // Max number of file fields (Default: Infinity).
        // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
      },
    });
    // create folder element with thumbnail
    fastify.post<{
      Querystring: {
        parentId?: string;
      };
    }>(
      '/with-thumbnail',
      {
        preHandler: fastify.verifyAuthentication,
      },
      async (request) => {
        const {
          member,
          query: { parentId },
        } = request;
        const formData = await request.file();

        if (!formData) {
          throw new Error('Missing formData');
        }

        const getFieldFromMultipartForm = (
          fields: MultipartFields,
          key: string,
        ): string | undefined => {
          const field = fields[key];
          if (field && !Array.isArray(field) && field.type === 'field') {
            return field.value as string;
          }
        };

        const name = getFieldFromMultipartForm(formData.fields, 'name');
        if (!name) {
          throw new Error('missing required name');
        }
        const maybeType = getFieldFromMultipartForm(formData.fields, 'type');
        if (!maybeType || !(Object.values(ItemType) as string[]).includes(maybeType)) {
          throw new Error('missing type or invlid type provided');
        }
        const type = maybeType as ItemTypeUnion;

        const description = getFieldFromMultipartForm(formData.fields, 'description');
        const displayName = getFieldFromMultipartForm(formData.fields, 'displayName');
        const settingsRaw = getFieldFromMultipartForm(formData.fields, 'settings');
        const geolocationRaw = getFieldFromMultipartForm(formData.fields, 'geolocation');
        const extraRaw = getFieldFromMultipartForm(formData.fields, 'extra');

        const settings = parseAndValidateField<Item['settings']>(settingsRaw, validateSettings);
        // const extra = parseAndValidateField<Item['extra']>(extraRaw);
        // TODO: extra is not validated
        const extra = extraRaw ? JSON.parse(extraRaw) : undefined;
        const geolocation = parseAndValidateField<Pick<ItemGeolocation, 'lat' | 'lng'>>(
          geolocationRaw,
          validateGeolocation,
        );

        if (!formData.file) {
          throw new NoFileProvided();
        }

        const itemPayload: Partial<Item> & Pick<Item, 'name' | 'type'> = {
          name,
          type,
          displayName,
          description,
          settings,
          extra,
        };

        return await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);
          const item = await itemService.post(member, repositories, {
            item: itemPayload,
            parentId,
            geolocation,
            thumbnail: formData.file,
          });
          await actionItemService.postPostAction(request, repositories, item);
          return item;
        });
      },
    );
  });

  // get item
  fastify.get<{ Params: IdParam }>(
    '/:id',
    {
      schema: getOne,
      preHandler: fastify.attemptVerifyAuthentication,
    },
    async ({ member, params: { id } }) => {
      return itemService.getPacked(member, buildRepositories(), id);
    },
  );

  fastify.get<{ Querystring: IdsParams }>(
    '/',
    { schema: getMany, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, query: { id: ids } }) => {
      return itemService.getManyPacked(member, buildRepositories(), ids);
    },
  );

  // returns items you have access to given the parameters
  fastify.get<{
    Querystring: ItemSearchParams & PaginationParams;
  }>(
    '/accessible',
    { schema: getAccessible, preHandler: fastify.verifyAuthentication },
    async ({ member, query }) => {
      if (!member) {
        throw new UnauthorizedMember();
      }
      const { page, pageSize, creatorId, name, sortBy, ordering, permissions, types } = query;
      return itemService.getAccessible(
        member,
        buildRepositories(),
        { creatorId, name, sortBy, ordering, permissions, types },
        { page, pageSize },
      );
    },
  );

  // get own
  fastify.get(
    '/own',
    { schema: getOwn, preHandler: fastify.verifyAuthentication },
    async ({ member }) => {
      return itemService.getOwn(member, buildRepositories());
    },
  );

  // get shared with
  fastify.get<{ Querystring: { permission?: PermissionLevel } }>(
    '/shared-with',
    {
      schema: getShared,
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, query }) => {
      return itemService.getShared(member, buildRepositories(), query.permission);
    },
  );

  // get item's children
  fastify.get<{ Params: IdParam; Querystring: ItemChildrenParams }>(
    '/:id/children',
    { schema: getChildren, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, params: { id }, query: { ordered, types } }) => {
      return itemService.getPackedChildren(member, buildRepositories(), id, { ordered, types });
    },
  );

  // get item's descendants
  fastify.get<{ Params: IdParam }>(
    '/:id/descendants',
    { schema: getDescendants, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, params: { id } }) => {
      return itemService.getPackedDescendants(member, buildRepositories(), id);
    },
  );

  // get item's parents
  fastify.get<{ Params: IdParam }>(
    '/:id/parents',
    {
      schema: getParents,
      preHandler: fastify.attemptVerifyAuthentication,
    },
    async ({ member, params: { id } }) => {
      return itemService.getParents(member, buildRepositories(), id);
    },
  );

  // update item
  fastify.patch<{ Params: IdParam; Body: Partial<Item> }>(
    '/:id',
    {
      schema: items.extendExtrasUpdateSchema(),
      preHandler: fastify.verifyAuthentication,
    },
    async (request) => {
      const {
        member,
        params: { id },
        body,
      } = request;
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await itemService.patch(member, repositories, id, body);
        await actionItemService.postPatchAction(request, repositories, item);
        return item;
      });
    },
  );

  fastify.patch<{ Querystring: IdsParams; Body: Partial<Item> }>(
    '/',
    {
      schema: updateMany(items.extendExtrasUpdateSchema()),
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const {
        member,
        query: { id: ids },
        body,
        log,
      } = request;
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.patchMany(member, repositories, ids, body);
        await actionItemService.postManyPatchAction(
          request,

          repositories,
          resultOfToList(items),
        );
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('update', ids, items),
          );
        }
      }).catch((e: Error) => {
        log.error(e);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('update', ids, { error: e }),
          );
        }
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  fastify.delete<{ Querystring: IdsParams }>(
    '/',
    {
      schema: deleteMany,
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const {
        member,
        query: { id: ids },
        log,
      } = request;
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.deleteMany(member, repositories, ids);
        await actionItemService.postManyDeleteAction(request, repositories, items);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('delete', ids, {
              data: Object.fromEntries(items.map((i) => [i.id, i])),
              errors: [],
            }),
          );
        }
      }).catch((e) => {
        log.error(e);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('delete', ids, { error: e }),
          );
        }
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  fastify.post<{
    Querystring: IdsParams;
    Body: {
      parentId?: string;
    };
  }>(
    '/move',
    { schema: moveMany, preHandler: fastify.verifyAuthentication },
    async (request, reply) => {
      const {
        member,
        query: { id: ids },
        body: { parentId },
        log,
      } = request;
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.moveMany(member, repositories, ids, parentId);
        await actionItemService.postManyMoveAction(request, repositories, items);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('move', ids, {
              data: Object.fromEntries(items.map((i) => [i.id, i])),
              errors: [],
            }),
          );
        }
      }).catch((e) => {
        log.error(e);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('move', ids, { error: e }),
          );
        }
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  fastify.post<{
    Querystring: IdsParams;
    Body: { parentId: string };
  }>(
    '/copy',
    { schema: copyMany, preHandler: fastify.verifyAuthentication },
    async (request, reply) => {
      const {
        member,
        query: { id: ids },
        body: { parentId },
        log,
      } = request;
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.copyMany(member, repositories, ids, {
          parentId,
        });
        await actionItemService.postManyCopyAction(request, repositories, items);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('copy', ids, {
              data: Object.fromEntries(items.map((i) => [i.id, i])),
              errors: [],
            }),
          );
        }
      }).catch((e) => {
        log.error(e);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('copy', ids, { error: e }),
          );
        }
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );
};

export default plugin;
