import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { DBConnection, db } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/types';
import { AuthenticatedUser } from '../../../../types';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { isItemType } from '../../discrimination';
import { ItemService } from '../../service';
import { ActionItemService } from '../action/action.service';
import { createLink, getLinkMetadata, updateLink } from './schemas';
import { EmbeddedLinkItemService } from './service';
import { ensureProtocol } from './utils';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { log } = fastify;
  const itemService = resolveDependency(ItemService);
  const embeddedLinkService = resolveDependency(EmbeddedLinkItemService);
  const actionItemService = resolveDependency(ActionItemService);

  fastify.get(
    '/metadata',
    { schema: getLinkMetadata, preHandler: isAuthenticated },
    async ({ query: { link } }) => {
      const url = ensureProtocol(link);
      const metadata = await embeddedLinkService.getLinkMetadata(url);
      const isEmbeddingAllowed = await embeddedLinkService.checkEmbeddingAllowed(url, log);

      return {
        ...metadata,
        isEmbeddingAllowed,
      };
    },
  );

  fastify.post(
    '/',
    {
      schema: createLink,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        query: { parentId, previousItemId },
        body: data,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      const item = await db.transaction(async (tx) => {
        const item = await embeddedLinkService.postWithOptions(tx, member, {
          ...data,
          previousItemId,
          parentId,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await actionItemService.postPostAction(db, request, item);
      await db.transaction(async (tx) => {
        await embeddedLinkService.rescaleOrderForParent(tx, member, item);
      });
    },
  );

  fastify.patch(
    '/:id',
    {
      schema: updateLink,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request) => {
      const {
        user,
        params: { id },
        body,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      return await db.transaction(async (tx) => {
        const item = await embeddedLinkService.patchWithOptions(tx, member, id, body);
        await actionItemService.postPatchAction(tx, request, item);
        return item;
      });
    },
  );

  // necessary for legacy POST /items to work with links
  // remove when POST /items is removed
  // register pre create handler to pre fetch link metadata
  const hook = async (_actor: AuthenticatedUser, _db: DBConnection, { item }: { item: Item }) => {
    // if the extra is undefined or it does not contain the embedded link extra key, exit
    if (!item.extra || (item && !isItemType(item, ItemType.LINK))) {
      return;
    }
    const { embeddedLink } = item.extra;

    const { url } = embeddedLink;
    const { description, html, thumbnails, icons } = await embeddedLinkService.getLinkMetadata(url);

    if (description) {
      embeddedLink.description = description;
    }
    if (html) {
      embeddedLink.html = html;
    }

    embeddedLink.thumbnails = thumbnails;
    embeddedLink.icons = icons;

    // default settings
    item.settings = {
      showLinkButton: true,
      showLinkIframe: false,
      ...(item.settings ?? {}),
    };
  };

  itemService.hooks.setPreHook('create', hook);
  itemService.hooks.setPreHook('update', hook);
};

export default plugin;
