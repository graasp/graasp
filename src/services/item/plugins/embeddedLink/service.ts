import merge from 'lodash.merge';
import fetch from 'node-fetch';
import { inject, singleton } from 'tsyringe';

import { FastifyBaseLogger } from 'fastify';

import {
  ItemGeolocation,
  ItemType,
  LinkItemExtra,
  LinkItemExtraProperties,
  UUID,
} from '@graasp/sdk';

import { IFRAMELY_API_HOST_DI_KEY } from '../../../../di/constants';
import { BaseLogger } from '../../../../logger';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { EmbeddedLinkItem, Item, isItemType } from '../../entities/Item';
import { WrongItemTypeError } from '../../errors';
import { ItemService } from '../../service';
import { ItemThumbnailService } from '../thumbnail/service';
import { InvalidUrl } from './errors';
import { isValidUrl } from './utils';

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

type LinkMetadata = {
  title?: string;
  description?: string;
  html?: string;
  thumbnails?: string[];
  icons?: string[];
};

export const PREFIX_EMBEDDED_LINK = 'embedded-links';

const hasRel = (rel: string[], value: string) => rel.some((r) => r === value);
const hasThumbnailRel = (rel: string[]) => hasRel(rel, 'thumbnail');
const hasIconRel = (rel: string[]) => hasRel(rel, 'icon');

const CSP_KEY = 'Content-Security-Policy';
const X_FRAME_KEY = 'X-Frame-Options';
const CSP_FRAME_NONE = ["frame-ancestors 'none'", "frame-ancestors 'self'"];
const X_FRAME_DISABLED = ['sameorigin', 'deny'];

@singleton()
export class EmbeddedLinkService extends ItemService {
  private readonly iframelyHrefOrigin: string;

  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    log: BaseLogger,
    @inject(IFRAMELY_API_HOST_DI_KEY) iframelyHrefOrigin: string,
  ) {
    super(thumbnailService, itemThumbnailService, log);
    this.iframelyHrefOrigin = iframelyHrefOrigin;
  }

  private assertUrlIsValid(url: string) {
    if (!isValidUrl(url)) {
      throw new InvalidUrl(url);
    }
  }

  async getLinkMetadata(url: string): Promise<LinkMetadata> {
    this.assertUrlIsValid(url);

    const response = await fetch(
      `${this.iframelyHrefOrigin}/iframely?uri=${encodeURIComponent(url)}`,
    );
    // better clues on how to extract the metadata here: https://iframely.com/docs/links
    const { meta = {}, html, links = [] } = (await response.json()) as IframelyResponse;
    const { title, description } = meta;

    return {
      title: title?.trim(),
      description: description?.trim(),
      html,
      thumbnails: links.filter(({ rel }) => hasThumbnailRel(rel)).map(({ href }) => href),
      icons: links.filter(({ rel }: { rel: string[] }) => hasIconRel(rel)).map(({ href }) => href),
    };
  }

  /**
   * Create link extra object given url and initial data
   * @param url new url to get metadata from
   * @param itemExtra  initial link extra
   * @returns valid link extra object
   */
  private async createExtra(
    url: string,
    itemExtra?: LinkItemExtraProperties,
  ): Promise<LinkItemExtraProperties> {
    // get metadata for empty extra or new url
    let metadata: LinkMetadata = {};
    if (!itemExtra || url !== itemExtra.url) {
      metadata = await this.getLinkMetadata(url);
    }
    return merge(itemExtra, metadata, { url });
  }

  /**
   * Create a valid link embedded item object
   * @param item initial item properties
   * @param data link properties
   * @returns complete link object
   */
  private async createLink(
    item: Partial<EmbeddedLinkItem> & Pick<EmbeddedLinkItem, 'name'>,
    data: {
      url: string;
      showLinkIframe?: boolean;
      showLinkButton?: boolean;
    },
    extra: LinkItemExtra,
  ) {
    return {
      ...item,
      type: ItemType.LINK,
      extra,
      settings: {
        ...(item.settings ?? {}),
        // default settings
        showLinkButton: data.showLinkButton ?? true,
        showLinkIframe: data.showLinkIframe ?? false,
      },
    };
  }

  async checkEmbeddingAllowed(url: string, logger?: FastifyBaseLogger): Promise<boolean> {
    this.assertUrlIsValid(url);

    try {
      const { headers } = await fetch(url);
      const cspHeader = headers.get(CSP_KEY)?.toLowerCase() || '';
      const xFrameOptions = headers.get(X_FRAME_KEY)?.toLowerCase() || '';

      if (CSP_FRAME_NONE.some((x) => cspHeader.includes(x))) {
        return false;
      } else if (X_FRAME_DISABLED.some((x) => x === xFrameOptions)) {
        return false;
      }

      return true;
    } catch (error) {
      const msgError = 'Error checking embedding permission:';
      if (logger) {
        logger?.error(msgError, error);
      } else {
        console.error(msgError, error);
      }
      return false;
    }
  }

  async postWithOptions(
    member: Member,
    repositories: Repositories,
    args: Partial<Pick<Item, 'description' | 'lang'>> &
      Pick<Item, 'name'> & {
        url: string;
        showLinkIframe?: boolean;
        showLinkButton?: boolean;
        parentId?: string;
        geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
        previousItemId?: Item['id'];
      },
  ): Promise<EmbeddedLinkItem> {
    const { name, description, lang, ...options } = args;

    const embeddedLink = await this.createExtra(args.url);

    const newItem = await this.createLink({ name, description, lang }, options, { embeddedLink });
    return (await this.post(member, repositories, {
      item: newItem,
      ...options,
    })) as EmbeddedLinkItem;
  }

  async patchWithOptions(
    member: Member,
    repositories: Repositories,
    itemId: UUID,
    args: Partial<Pick<Item, 'name' | 'description' | 'lang'>> & {
      url?: string;
      showLinkIframe?: boolean;
      showLinkButton?: boolean;
    },
  ): Promise<EmbeddedLinkItem> {
    const { itemRepository } = repositories;

    const item = await itemRepository.getOneOrThrow(itemId);

    // check item is link
    if (!isItemType(item, ItemType.LINK)) {
      throw new WrongItemTypeError(item.type);
    }

    const { name, description, lang, ...options } = args;

    // compute new extra if link is different
    let { embeddedLink } = item.extra;
    if (args.url && args.url !== item.extra.embeddedLink.url) {
      embeddedLink = await this.createExtra(args.url, item.extra?.embeddedLink);
    }

    const newItem = await this.createLink(
      merge(item, { name, description, lang }),
      {
        ...options,
        url: options.url ?? item.extra.embeddedLink.url,
      },
      {
        embeddedLink,
      },
    );
    return (await this.patch(member, repositories, itemId, newItem)) as EmbeddedLinkItem;
  }
}
