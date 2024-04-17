import MeiliSearch from 'meilisearch';

import { FastifyPluginAsync } from 'fastify';

import { JobService } from '../jobs';
import { ActionService } from '../services/action/services/action';
import { H5PService } from '../services/item/plugins/html/h5p/service';
import { ItemCategoryService } from '../services/item/plugins/itemCategory/services/itemCategory';
import { SearchService } from '../services/item/plugins/published/plugins/search/service';
import { ItemPublishedService } from '../services/item/plugins/published/service';
import ItemService from '../services/item/service';
import ItemMembershipService from '../services/itemMembership/service';
import { StorageService } from '../services/member/plugins/storage/service';
import { MemberService } from '../services/member/service';
import { MEILISEARCH_MASTER_KEY, MEILISEARCH_URL } from '../utils/config';
import { FILE_ITEM_TYPE } from '../utils/config';

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

  fastify.decorate('members', { service: new MemberService() });

  fastify.decorate('items', {
    service: new ItemService(),
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
};
export default decoratorPlugin;
