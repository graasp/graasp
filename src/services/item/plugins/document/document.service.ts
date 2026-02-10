import sanitize from 'sanitize-html';
import { singleton } from 'tsyringe';

import { type DocumentItemExtraProperties, type ItemGeolocation, type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import type { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { WrongItemTypeError } from '../../errors';
import { DocumentItem, type ItemRaw, isDocumentItem } from '../../item';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { PackedItemService } from '../../packedItem.dto';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';

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
    authorizedItemService: AuthorizedItemService,
    itemWrapperService: PackedItemService,
    itemVisibilityRepository: ItemVisibilityRepository,
    recycledBinService: RecycledBinService,
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
      authorizedItemService,
      itemWrapperService,
      itemVisibilityRepository,
      recycledBinService,
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
      type: 'document' as const,
      extra: { document: documentExtraProps },
    };
  }

  async postWithOptions(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: {
      name: ItemRaw['name'];
      content: DocumentItemExtraProperties['content'];
      description?: ItemRaw['description'];
      lang?: ItemRaw['lang'];
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      previousItemId?: ItemRaw['id'];
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
    return (await this.post(dbConnection, member, {
      item: newItem,
      ...options,
    })) as DocumentItem;
  }

  async patchWithOptions(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    args: Partial<Pick<ItemRaw, 'name' | 'description' | 'lang'>> &
      Partial<DocumentItemExtraProperties>,
  ): Promise<DocumentItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is document
    if (!isDocumentItem(item)) {
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
    return (await this.patch(dbConnection, member, itemId, newItem)) as DocumentItem;
  }
}
