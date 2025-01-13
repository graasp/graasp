import { v4 } from 'uuid';

import {
  DocumentItemExtraFlavor,
  DocumentItemFactory,
  FolderItemFactory,
  ItemType,
} from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { DocumentItem, Item } from '../../entities/Item';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../repository';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';
import { DocumentItemService } from './service';

const documentService = new DocumentItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as unknown as MeiliSearchWrapper,
  MOCK_LOGGER,
);
const id = v4();
const MOCK_ITEM = DocumentItemFactory({ id }) as unknown as DocumentItem;

const MOCK_MEMBER = {} as Member;
const repositories = {
  itemRepository: {
    getOneOrThrow: async () => {
      return MOCK_ITEM;
    },
  } as unknown as ItemRepository,
} as Repositories;

describe('Document Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postWithOptions', () => {
    it('set correct default values for type and extra', async () => {
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as Item;
        });

      await documentService.postWithOptions(MOCK_MEMBER, repositories, {
        name: 'name',
        content: 'text',
      });

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, {
        item: {
          name: 'name',
          description: undefined,
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'text',
            },
          },
          type: ItemType.DOCUMENT,
          lang: undefined,
        },
        // lang is defined by super service
      });
    });
    it('sanitize content', async () => {
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as Item;
        });

      await documentService.postWithOptions(MOCK_MEMBER, repositories, {
        name: 'name',
        content: 'mycontent<script>text</script>',
      });

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, {
        item: {
          name: 'name',
          description: undefined,
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'mycontent',
            },
          },
          type: ItemType.DOCUMENT,
          lang: undefined,
        },
        // lang is defined by super service
      });
    });
    it('set defined values', async () => {
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as Item;
        });

      const args = {
        name: 'name',
        description: 'my description',
        content: 'text',
        isRaw: true,
        flavor: DocumentItemExtraFlavor.Info,
        lang: 'fr',
        parentId: v4(),
        geolocation: { lat: 1, lng: 1 },
        previousItemId: v4(),
      };
      await documentService.postWithOptions(MOCK_MEMBER, repositories, args);

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, {
        item: {
          name: args.name,
          description: args.description,
          extra: {
            [ItemType.DOCUMENT]: {
              content: args.content,
              isRaw: args.isRaw,
              flavor: args.flavor,
            },
          },
          type: ItemType.DOCUMENT,
          lang: args.lang,
        },
        parentId: args.parentId,
        geolocation: args.geolocation,
        previousItemId: args.previousItemId,
      });
    });
  });
  describe('patchWithOptions', () => {
    it('throw if item is not a document', async () => {
      const FOLDER_ITEM = FolderItemFactory();
      await expect(() =>
        documentService.patchWithOptions(
          MOCK_MEMBER,
          {
            itemRepository: {
              getOneOrThrow: async () => {
                return FOLDER_ITEM;
              },
            } as unknown as ItemRepository,
          } as Repositories,
          FOLDER_ITEM.id,
          { name: 'name' },
        ),
      ).rejects.toBeInstanceOf(WrongItemTypeError);
    });
    it('sanitize content', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      expect(MOCK_ITEM.extra.document.content).toBeDefined();

      const args = {
        content: 'mycontent<script>script</script>',
      };
      await documentService.patchWithOptions(MOCK_MEMBER, repositories, MOCK_ITEM.id, args);

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
        name: MOCK_ITEM.name,
        type: ItemType.DOCUMENT,
        extra: {
          document: {
            content: 'mycontent',
            isRaw: MOCK_ITEM.extra.document.isRaw,
            flavor: MOCK_ITEM.extra.document.flavor,
          },
        },
      });
    });
    it('patch many properties', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      expect(MOCK_ITEM.extra.document.content).toBeDefined();

      const args = {
        name: 'newname',
        description: 'newdescription',
        lang: 'de',
        isRaw: true,
        flavor: DocumentItemExtraFlavor.Error,
      };
      await documentService.patchWithOptions(MOCK_MEMBER, repositories, MOCK_ITEM.id, args);

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
        name: args.name,
        type: ItemType.DOCUMENT,
        description: args.description,
        lang: args.lang,
        extra: {
          document: {
            content: MOCK_ITEM.extra.document.content,
            isRaw: true,
            flavor: DocumentItemExtraFlavor.Error,
          },
        },
      });
    });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        documentService.patchWithOptions(MOCK_MEMBER, repositories, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
