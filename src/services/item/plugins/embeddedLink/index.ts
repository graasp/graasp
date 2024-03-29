import fetch from 'node-fetch';

import { FastifyPluginAsync } from 'fastify';

import { ItemType } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { createSchema } from './schemas';

interface GraaspEmbeddedLinkItemOptions {
  /** \<protocol\>://\<hostname\>:\<port\> */
  iframelyHrefOrigin: string;
}

type IframelyLink = {
  rel: string[];
  href: string;
};

type IframelyResponse = {
  meta: {
    title?: string;
    description?: string;
  };
  html: string;
  links: IframelyLink[];
};

const plugin: FastifyPluginAsync<GraaspEmbeddedLinkItemOptions> = async (fastify, options) => {
  const { iframelyHrefOrigin } = options;
  const {
    items: { extendCreateSchema, service: itemService },
  } = fastify;

  if (!iframelyHrefOrigin) {
    throw new Error('graasp-embedded-link-item: mandatory options missing');
  }
  // "install" custom schema for validating embedded link items creation
  extendCreateSchema(createSchema);

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

    const response = await fetch(`${iframelyHrefOrigin}/iframely?uri=${encodeURIComponent(url)}`);
    // better clues on how to extract the metadata here: https://iframely.com/docs/links
    const { meta = {}, html, links = [] } = (await response.json()) as IframelyResponse;
    const { title, description } = meta;

    // TODO: maybe all the code below should be moved to another place if it gets more complex
    if (title) {
      item.name = title.trim();
    }
    if (description) {
      item.description = description.trim();
    }
    if (html) {
      embeddedLink.html = html;
    }

    embeddedLink.thumbnails = links
      .filter(({ rel }) => hasThumbnailRel(rel))
      .map(({ href }) => href);

    embeddedLink.icons = links
      .filter(({ rel }: { rel: string[] }) => hasIconRel(rel))
      .map(({ href }) => href);

    // default settings
    item.settings = {
      showLinkButton: true,
      showLinkIframe: false,
      ...(item.settings ?? {}),
    };
  };

  itemService.hooks.setPreHook('create', hook);
};

const hasRel = (rel: string[], value: string) => rel.some((r) => r === value);
const hasThumbnailRel = (rel: string[]) => hasRel(rel, 'thumbnail');
const hasIconRel = (rel: string[]) => hasRel(rel, 'icon');

export default plugin;
