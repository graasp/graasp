import { MeiliSearch } from 'meilisearch';

import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../dependencies';
import { JobService } from '../jobs';
import FileService from '../services/file/service';
import { ItemCategoryService } from '../services/item/plugins/itemCategory/services/itemCategory';
import { SearchService } from '../services/item/plugins/published/plugins/search/service';
import { ItemPublishedService } from '../services/item/plugins/published/service';
import { ItemService } from '../services/item/service';
import { ItemMembershipService } from '../services/itemMembership/service';
import { MEILISEARCH_MASTER_KEY, MEILISEARCH_URL } from '../utils/config';

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
  const itemService = resolveDependency(ItemService);
  const itemCategoryService = resolveDependency(ItemCategoryService);

  fastify.decorate('memberships', {
    service: new ItemMembershipService(itemService, fastify.mailer),
  });

  fastify.decorate('itemsPublished', {
    service: new ItemPublishedService(itemService, fastify.mailer, fastify.log),
  });

  fastify.decorate('search', {
    service: new SearchService(
      itemService,
      fileService,
      fastify.itemsPublished.service,
      itemCategoryService,
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
};
export default decoratorPlugin;
