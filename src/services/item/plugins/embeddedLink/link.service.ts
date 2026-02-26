import { captureException } from '@sentry/node';
import fetch from 'node-fetch';
import { inject, singleton } from 'tsyringe';

import type { FastifyBaseLogger } from 'fastify';

import {
  type ItemGeolocation,
  type LinkItemExtra,
  type LinkItemExtraProperties,
  type UUID,
} from '@graasp/sdk';

import { IFRAMELY_API_DI_KEY } from '../../../../di/constants';
import { type DBConnection } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import type { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { WrongItemTypeError } from '../../errors';
import { EmbeddedLinkItem, type ItemRaw, isEmbeddedLinkItem } from '../../item';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { PackedItemService } from '../../packedItem.dto';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
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
  thumbnails: string[];
  icons: string[];
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
export class EmbeddedLinkItemService extends ItemService {
  private readonly iframelyHrefOrigin: string;

  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    itemMembershipRepository: ItemMembershipRepository,
    meilisearchWrapper: MeiliSearchWrapper,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    authorizedItemService: AuthorizedItemService,
    itemWrapperService: PackedItemService,
    itemVisibilityRepository: ItemVisibilityRepository,
    recycledBinService: RecycledBinService,
    log: BaseLogger,
    @inject(IFRAMELY_API_DI_KEY) iframelyHrefOrigin: string,
  ) {
    super(
      thumbnailService,
      itemThumbnailService,
      itemMembershipRepository,
      meilisearchWrapper,
      itemRepository,
      itemPublishedRepository,
      itemGeolocationRepository,
      authorizedItemService,
      itemWrapperService,
      itemVisibilityRepository,
      recycledBinService,
      log,
    );
    this.iframelyHrefOrigin = iframelyHrefOrigin;
  }

  private assertUrlIsValid(url: string) {
    if (!isValidUrl(url)) {
      throw new InvalidUrl(url);
    }
  }

  public async getLinkMetadata(url: string): Promise<LinkMetadata> {
    this.assertUrlIsValid(url);
    try {
      const response = await fetch(
        `${this.iframelyHrefOrigin}/iframely?uri=${encodeURIComponent(url)}`,
      );

      // better clues on how to extract the metadata here: https://iframely.com/docs/links
      const { meta = {}, html, links = [] } = (await response.json()) as IframelyResponse;
      const { title, description } = meta;

      // does not accept weird unicode characters, non-breaking spaces, tabs, breaking lines
      const r = new RegExp('[ \t\u{0000}-\u{001F}\u{007F}-\u{009F}]', 'gu');

      return {
        title: title?.trim()?.replaceAll(r, ' '),
        description: description?.trim(),
        html,
        thumbnails: links.filter(({ rel }) => hasThumbnailRel(rel)).map(({ href }) => href),
        icons: links
          .filter(({ rel }: { rel: string[] }) => hasIconRel(rel))
          .map(({ href }) => href),
      };
    } catch (e) {
      // do not fail on iframely error
      // send error to sentry
      captureException(e);
      console.error(e);
      // return empty values to reset fields
      return { icons: [], thumbnails: [], title: '', html: '', description: '' };
    }
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
    let metadata = {};
    if (!itemExtra || url !== itemExtra.url) {
      metadata = await this.getLinkMetadata(url);
    }
    return {
      ...itemExtra,
      ...metadata,
      url,
    };
  }

  /**
   * Create a valid link embedded item object
   * @param item initial item properties
   * @param data link properties
   * @returns complete link object
   */
  private async createLink(
    item: Partial<EmbeddedLinkItem> & Pick<EmbeddedLinkItem, 'name'>,
    settings: {
      showLinkIframe?: boolean;
      showLinkButton?: boolean;
    },
    extra: LinkItemExtra,
  ) {
    return {
      ...item,
      type: 'embeddedLink' as const,
      extra,
      settings: {
        ...item.settings,
        // default settings
        showLinkButton: settings.showLinkButton ?? true,
        showLinkIframe: settings.showLinkIframe ?? false,
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
    } catch (error: unknown) {
      const msgError = 'Error checking embedding permission:';
      if (logger) {
        logger?.error(`${msgError}: ${String(error)}`);
      } else {
        console.error(msgError, error);
      }
      return false;
    }
  }

  async postWithOptions(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: Partial<Pick<ItemRaw, 'description' | 'lang'>> &
      Pick<ItemRaw, 'name'> & {
        url: string;
        showLinkIframe?: boolean;
        showLinkButton?: boolean;
        parentId?: string;
        geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
        previousItemId?: ItemRaw['id'];
      },
  ): Promise<EmbeddedLinkItem> {
    const { name, description, lang, url, showLinkIframe, showLinkButton, ...options } = args;

    const embeddedLink = await this.createExtra(url);

    const newItem = await this.createLink(
      { name, description, lang },
      { showLinkButton, showLinkIframe },
      { embeddedLink },
    );
    return (await super.post(dbConnection, member, {
      item: newItem,
      ...options,
    })) as EmbeddedLinkItem;
  }

  async patchWithOptions(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    args: Partial<Pick<ItemRaw, 'name' | 'description' | 'lang' | 'settings'>> & {
      url?: string;
      showLinkIframe?: boolean;
      showLinkButton?: boolean;
    },
  ): Promise<EmbeddedLinkItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is link
    if (!isEmbeddedLinkItem(item)) {
      throw new WrongItemTypeError(item.type);
    }

    const { name, description, lang, showLinkIframe, showLinkButton, url, settings } = args;

    // compute new extra if link is different
    let { embeddedLink } = item.extra;
    if (url && url !== item.extra.embeddedLink.url) {
      embeddedLink = await this.createExtra(url, item.extra?.embeddedLink);
    }

    const newItem = await this.createLink(
      // replace name if provided
      { name: name ?? item.name, description, lang, settings },
      {
        showLinkIframe,
        showLinkButton,
      },
      {
        embeddedLink,
      },
    );
    return (await super.patch(dbConnection, member, itemId, newItem)) as EmbeddedLinkItem;
  }
}
