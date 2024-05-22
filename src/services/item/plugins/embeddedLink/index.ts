import { FastifyPluginAsync } from 'fastify';

import { ItemType } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { LinkQueryParameterIsRequired } from './errors';
import { createSchema, getLinkMetadata, updateExtraSchema } from './schemas';
import { EmbeddedLinkService } from './service';
import { ensureProtocol } from './utils';

interface GraaspEmbeddedLinkItemOptions {
  /** \<protocol\>://\<hostname\>:\<port\> */
  iframelyHrefOrigin: string;
}

const plugin: FastifyPluginAsync<GraaspEmbeddedLinkItemOptions> = async (fastify, options) => {
  const { iframelyHrefOrigin } = options;
  const {
    log,
    items: { extendCreateSchema, extendExtrasUpdateSchema, service: itemService },
  } = fastify;
  const embeddedLinkService = new EmbeddedLinkService();

  if (!iframelyHrefOrigin) {
    throw new Error('graasp-embedded-link-item: mandatory options missing');
  }
  // "install" custom schema for validating embedded link items creation
  extendCreateSchema(createSchema);
  // add link extra update schema that allows to update url
  extendExtrasUpdateSchema(updateExtraSchema);

  fastify.get<{ Querystring: { link: string } }>(
    '/metadata',
    { preHandler: fastify.verifyAuthentication, schema: getLinkMetadata },
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
      // only override item name if it is an empty string (should not happen)
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
