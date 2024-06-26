import { Redis } from 'ioredis';
import { MeiliSearch } from 'meilisearch';

import { FastifyPluginAsync } from 'fastify';

import { JobService } from '../jobs';
import { ActionService } from '../services/action/services/action';
import { MobileService } from '../services/auth/plugins/mobile/service';
import { MemberPasswordService } from '../services/auth/plugins/password/service';
import { AuthService } from '../services/auth/service';
import { H5PService } from '../services/item/plugins/html/h5p/service';
import { ItemCategoryService } from '../services/item/plugins/itemCategory/services/itemCategory';
import { SearchService } from '../services/item/plugins/published/plugins/search/service';
import { ItemPublishedService } from '../services/item/plugins/published/service';
import { ItemThumbnailService } from '../services/item/plugins/thumbnail/service';
import { ItemService } from '../services/item/service';
import { ItemMembershipService } from '../services/itemMembership/service';
import { StorageService } from '../services/member/plugins/storage/service';
import { MemberService } from '../services/member/service';
import { ThumbnailService } from '../services/thumbnail/service';
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
  fastify.decorate(
    'redis',
    new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      username: REDIS_USERNAME,
      password: REDIS_PASSWORD,
    }),
  );

  fastify.decorate('members', { service: new MemberService(fastify.mailer, fastify.log) });

  const thumbnailService = new ThumbnailService(fastify.files.service, true, 'thumbnails');
  fastify.decorate('thumbnails', { service: thumbnailService });

  const itemService = new ItemService(thumbnailService, fastify.log);
  fastify.decorate('items', {
    service: itemService,
    thumbnails: { service: new ItemThumbnailService(itemService, thumbnailService) },
    // the casting is necessary as we are not instanciating the other keys of the object yet ..
    // we might need to rethink our depencency order to remove the need for this cast
  } as typeof fastify.items);

  fastify.decorate('memberships', {
    service: new ItemMembershipService(fastify.items.service, fastify.mailer),
  });

  fastify.decorate('actions', {
    service: new ActionService(fastify.items.service, fastify.members.service),
  });

  fastify.decorate('itemsPublished', {
    service: new ItemPublishedService(fastify.items.service, fastify.mailer, fastify.log),
  });

  fastify.decorate('itemsCategory', {
    service: new ItemCategoryService(fastify.items.service),
  });

  fastify.decorate('h5p', {
    service: new H5PService(fastify.log),
  });

  fastify.decorate('search', {
    service: new SearchService(
      fastify.items.service,
      fastify.files.service,
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

  // 'auth' key is not accepted
  fastify.decorate('authentication', {
    service: new AuthService(fastify.mailer, fastify.log),
  });

  fastify.decorate('memberPassword', {
    service: new MemberPasswordService(fastify.mailer, fastify.log, fastify.redis),
  });

  fastify.decorate('mobile', {
    service: new MobileService(fastify, fastify.log),
  });
};
export default decoratorPlugin;
