import Redis from 'ioredis';
import { MeiliSearch } from 'meilisearch';

import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../dependencies';
import { JobService } from '../jobs';
import { ActionService } from '../services/action/services/action';
import FileService from '../services/file/service';
import { H5PService } from '../services/item/plugins/html/h5p/service';
import { ItemCategoryService } from '../services/item/plugins/itemCategory/services/itemCategory';
import { SearchService } from '../services/item/plugins/published/plugins/search/service';
import { ItemPublishedService } from '../services/item/plugins/published/service';
import { ItemThumbnailService } from '../services/item/plugins/thumbnail/service';
import { ItemService } from '../services/item/service';
import { ItemMembershipService } from '../services/itemMembership/service';
import { StorageService } from '../services/member/plugins/storage/service';
import { MemberService } from '../services/member/service';
import { DefaultThumbnailService } from '../services/thumbnail/service';
import {
  FILE_ITEM_TYPE,
  MEILISEARCH_MASTER_KEY,
  MEILISEARCH_URL,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from '../utils/config';

const decoratorPlugin: FastifyPluginAsync = async (fastify) => {
  /**
   * This is done for performance reasons:
   * 1. First decorateRequest with the empty type of the value to be set (null for an object)
   *    BUT NEVER SET THE ACTUAL OBJECT IN decorateRequest FOR SECURITY (reference is shared)
   * 2. Then later use a hook such as preHandler or onRequest to store the actual value
   *    (it will be properly encapsulated)
   * @example
   *  fastify.decorateRequest('user', null) // <-- must use null here if user will be an object
   *  // later in the code
   *  fastify.addHook('preHandler', (request) => {
   *     request.user = { name: 'John Doe' } // <-- must set the actual object here
   *  })
   * @see
   *  https://www.fastify.io/docs/latest/Reference/Decorators/#decoraterequestname-value-dependencies
   *  https://www.fastify.io/docs/latest/Reference/Decorators/
   */
  fastify.decorateRequest('member', null);

  const fileService = resolveDependency(FileService);
  const thumbnailService = resolveDependency(DefaultThumbnailService);
  const itemService = resolveDependency(ItemService);

  fastify.decorate('items', {
    thumbnails: { service: new ItemThumbnailService(itemService, thumbnailService) },
    // the casting is necessary as we are not instanciating the other keys of the object yet ..
    // we might need to rethink our depencency order to remove the need for this cast
  } as typeof fastify.items);

  fastify.decorate('memberships', {
    service: new ItemMembershipService(itemService, fastify.mailer),
  });

  fastify.decorate('actions', {
    service: new ActionService(itemService, resolveDependency(MemberService)),
  });

  fastify.decorate('itemsPublished', {
    service: new ItemPublishedService(itemService, fastify.mailer, fastify.log),
  });

  fastify.decorate('itemsCategory', {
    service: new ItemCategoryService(itemService),
  });

  fastify.decorate('h5p', {
    service: new H5PService(fastify.log),
  });

  fastify.decorate('search', {
    service: new SearchService(
      itemService,
      fileService,
      fastify.itemsPublished.service,
      fastify.itemsCategory.service,
      fastify.db,
      new MeiliSearch({
        host: MEILISEARCH_URL,
        apiKey: MEILISEARCH_MASTER_KEY,
      }),
      fastify.log,
    ),
  });

  // Launch Job workers
  fastify.decorate('jobs', { service: new JobService(fastify.search.service, fastify.log) });
  // need to register this before files
  fastify.decorate('storage', { service: new StorageService(FILE_ITEM_TYPE) });

  fastify.decorate(
    'redis',
    new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      username: REDIS_USERNAME,
      password: REDIS_PASSWORD,
    }),
  );
};
export default decoratorPlugin;
