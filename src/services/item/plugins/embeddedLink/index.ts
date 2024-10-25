import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { Repositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { Actor } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { LinkQueryParameterIsRequired } from './errors';
import { getLinkMetadata } from './schemas';
import { EmbeddedLinkService } from './service';
import { ensureProtocol } from './utils';

interface GraaspEmbeddedLinkItemOptions {
  /** \<protocol\>://\<hostname\>:\<port\> */
  iframelyHrefOrigin: string;
}

const plugin: FastifyPluginAsyncTypebox<GraaspEmbeddedLinkItemOptions> = async (
  fastify,
  options,
) => {
  const { iframelyHrefOrigin } = options;
  const { log } = fastify;
  const itemService = resolveDependency(ItemService);
  const embeddedLinkService = resolveDependency(EmbeddedLinkService);

  if (!iframelyHrefOrigin) {
    throw new Error('graasp-embedded-link-item: mandatory options missing');
  }

  fastify.get(
    '/metadata',
    { schema: getLinkMetadata, preHandler: isAuthenticated },
    async ({ query: { link } }) => {
      if (!link) {
        throw new LinkQueryParameterIsRequired();
      }

      const url = ensureProtocol(link);
      const metadata = await embeddedLinkService.getLinkMetadata(iframelyHrefOrigin, url);
      const isEmbeddingAllowed = await embeddedLinkService.checkEmbeddingAllowed(url, log);

      return {
        ...metadata,
        isEmbeddingAllowed,
      };
    },
  );

  // register pre create handler to pre fetch link metadata
  const hook = async (
    actor: Actor,
    repositories: Repositories,
    { item }: { item: Partial<Item> },
  ) => {
    // if the extra is undefined or it does not contain the embedded link extra key, exit
    if (!item.extra || !(ItemType.LINK in item.extra)) {
      return;
    }
    const { embeddedLink } = item.extra;

    const { url } = embeddedLink;
    const { title, description, html, thumbnails, icons } =
      await embeddedLinkService.getLinkMetadata(iframelyHrefOrigin, url);

    // TODO: maybe all the code below should be moved to another place if it gets more complex
    if (title) {
      item.name = title;
    }
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
