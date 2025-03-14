import sanitize from 'sanitize-html';
import { singleton } from 'tsyringe';

import {
  type DocumentItemExtraProperties,
  type ItemGeolocation,
  ItemType,
  type UUID,
} from '@graasp/sdk';

import type { DBConnection } from '../../../../drizzle/db.js';
import type { Item } from '../../../../drizzle/types.js';
import { BaseLogger } from '../../../../logger.js';
import type { MinimalMember } from '../../../../types.js';
import { AuthorizationService } from '../../../authorization.js';
import { ItemMembershipRepository } from '../../../itemMembership/repository.js';
import { ThumbnailService } from '../../../thumbnail/service.js';
import { ItemWrapperService } from '../../ItemWrapper.js';
import { BasicItemService } from '../../basic.service.js';
import { type DocumentItem, isItemType } from '../../discrimination.js';
import { WrongItemTypeError } from '../../errors.js';
import { ItemRepository } from '../../repository.js';
import { ItemService } from '../../service.js';
import { ItemGeolocationRepository } from '../geolocation/geolocation.repository.js';
import { ItemVisibilityRepository } from '../itemVisibility/repository.js';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository.js';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch.js';
import { ItemThumbnailService } from '../thumbnail/service.js';

export const PREFIX_DOCUMENT = 'documents';

@singleton()
export class DocumentItemService extends ItemService {
  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    itemMembershipRepository: ItemMembershipRepository,
    meilisearchWrapper: MeiliSearchWrapper,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    authorizationService: AuthorizationService,
    itemWrapperService: ItemWrapperService,
    itemVisibilityRepository: ItemVisibilityRepository,
    basicItemService: BasicItemService,
    log: BaseLogger,
  ) {
    super(
      thumbnailService,
      itemThumbnailService,
      itemMembershipRepository,
      meilisearchWrapper,
      itemRepository,
      itemPublishedRepository,
      itemGeolocationRepository,
      authorizationService,
      itemWrapperService,
      itemVisibilityRepository,
      basicItemService,
      log,
    );
  }

  /**
   * Create document extra object given content and initial data
   * @param extra text extra to save
   * @param itemExtra initial document extra
   * @returns valid document extra object
   */
  private createExtra(
    { content, isRaw, flavor }: Partial<DocumentItemExtraProperties>,
    itemExtra?: DocumentItemExtraProperties,
  ): DocumentItemExtraProperties {
    return {
      content: sanitize(content ?? itemExtra?.content ?? ''),
      isRaw: isRaw ?? itemExtra?.isRaw,
      flavor: flavor ?? itemExtra?.flavor,
    };
  }

  /**
   * Create a valid document item object
   * @param item initial item properties
   * @param data document properties
   * @returns complete document object
   */
  private createDocument(
    item: Partial<DocumentItem> & Pick<DocumentItem, 'name'>,
    documentExtraProps: DocumentItemExtraProperties,
  ) {
    return {
      ...item,
      type: ItemType.DOCUMENT,
      extra: { document: documentExtraProps },
    };
  }

  async postWithOptions(
    db: DBConnection,
    member: MinimalMember,
    args: {
      name: Item['name'];
      content: DocumentItemExtraProperties['content'];
      description?: Item['description'];
      lang?: Item['lang'];
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      previousItemId?: Item['id'];
    } & Partial<DocumentItemExtraProperties>,
  ): Promise<DocumentItem> {
    const { name, description, lang, content, isRaw, flavor, ...options } = args;

    const newItem = this.createDocument(
      { name, description, lang },
      this.createExtra({
        content,
        isRaw,
        flavor,
      }),
    );
    return (await this.post(db, member, {
      item: newItem,
      ...options,
    })) as DocumentItem;
  }

  async patchWithOptions(
    db: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    args: Partial<Pick<Item, 'name' | 'description' | 'lang'>> &
      Partial<DocumentItemExtraProperties>,
  ): Promise<DocumentItem> {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // check item is document
    if (!isItemType(item, ItemType.DOCUMENT)) {
      throw new WrongItemTypeError(item.type);
    }

    const { name, description, lang, content, isRaw, flavor } = args;

    const newItem = this.createDocument(
      // replace name if provided
      { name: name ?? item.name, description, lang },
      this.createExtra(
        {
          content,
          isRaw,
          flavor,
        },
        item.extra.document,
      ),
    );
    return (await this.patch(db, member, itemId, newItem)) as DocumentItem;
  }
}
