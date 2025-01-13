import sanitize from 'sanitize-html';
import { singleton } from 'tsyringe';

import { DocumentItemExtraProperties, ItemGeolocation, ItemType, UUID } from '@graasp/sdk';

import { BaseLogger } from '../../../../logger';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { DocumentItem, Item, isItemType } from '../../entities/Item';
import { WrongItemTypeError } from '../../errors';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';

export const PREFIX_DOCUMENT = 'documents';

@singleton()
export class DocumentItemService extends ItemService {
  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    meilisearchWrapper: MeiliSearchWrapper,
    log: BaseLogger,
  ) {
    super(thumbnailService, itemThumbnailService, meilisearchWrapper, log);
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
    member: Member,
    repositories: Repositories,
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
    return (await this.post(member, repositories, {
      item: newItem,
      ...options,
    })) as DocumentItem;
  }

  async patchWithOptions(
    member: Member,
    repositories: Repositories,
    itemId: UUID,
    args: Partial<Pick<Item, 'name' | 'description' | 'lang'>> &
      Partial<DocumentItemExtraProperties>,
  ): Promise<DocumentItem> {
    const { itemRepository } = repositories;

    const item = await itemRepository.getOneOrThrow(itemId);

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
    return (await this.patch(member, repositories, itemId, newItem)) as DocumentItem;
  }
}
