import sanitize from 'sanitize-html';
import { singleton } from 'tsyringe';

import { DocumentItemExtraProperties, ItemGeolocation, ItemType, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import { MinimalMember } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/service';
import { ItemWrapperService } from '../../ItemWrapper';
import { BasicItemService } from '../../basic.service';
import { DocumentItem, isItemType } from '../../discrimination';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../service';
import { ItemGeolocationRepository } from '../geolocation/geolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';

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
