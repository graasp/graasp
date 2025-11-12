import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DocumentItemExtraFlavor,
  DocumentItemFactory,
  FolderItemFactory,
  ItemType,
} from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app.vitest';
import { db } from '../../../../drizzle/db';
import type { ItemRaw } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { ItemWrapperService } from '../../ItemWrapper';
import type { DocumentItem } from '../../discrimination';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { DocumentItemService } from './document.service';

const MOCK_ITEM = DocumentItemFactory({ id: v4() }) as unknown as DocumentItem;

const MOCK_MEMBER = {} as MinimalMember;
const itemRepository = {
  getOneOrThrow: async () => {
    return MOCK_ITEM;
  },
} as unknown as ItemRepository;

const documentService = new DocumentItemService(
  {} as ThumbnailService,
  {} as ItemThumbnailService,
  {} as ItemMembershipRepository,
  {} as MeiliSearchWrapper,
  itemRepository,
  {} as ItemPublishedRepository,
  {} as ItemGeolocationRepository,
  {} as AuthorizedItemService,
  {} as ItemWrapperService,
  {} as ItemVisibilityRepository,
  {} as RecycledBinService,
  MOCK_LOGGER,
);

describe('Document Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('postWithOptions', () => {
    it('set correct default values for type and extra', async () => {
      const itemServicePostMock = vi
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as ItemRaw;
        });

      await documentService.postWithOptions(db, MOCK_MEMBER, {
        name: 'name',
        content: 'text',
      });

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(db, MOCK_MEMBER, {
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
      const itemServicePostMock = vi
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as ItemRaw;
        });

      await documentService.postWithOptions(db, MOCK_MEMBER, {
        name: 'name',
        content: 'mycontent<script>text</script>',
      });

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(db, MOCK_MEMBER, {
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
      const itemServicePostMock = vi
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as ItemRaw;
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
      await documentService.postWithOptions(db, MOCK_MEMBER, args);

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(db, MOCK_MEMBER, {
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
        documentService.patchWithOptions(db, MOCK_MEMBER, FOLDER_ITEM.id, { name: 'name' }),
      ).rejects.toThrow();
    });
    it('sanitize content', async () => {
      const itemServicePatchMock = vi
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      expect(MOCK_ITEM.extra.document.content).toBeDefined();

      const args = {
        content: 'mycontent<script>script</script>',
      };
      await documentService.patchWithOptions(db, MOCK_MEMBER, MOCK_ITEM.id, args);

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(db, MOCK_MEMBER, MOCK_ITEM.id, {
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
      const itemServicePatchMock = vi
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
      await documentService.patchWithOptions(db, MOCK_MEMBER, MOCK_ITEM.id, args);

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(db, MOCK_MEMBER, MOCK_ITEM.id, {
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
      vi.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        documentService.patchWithOptions(db, MOCK_MEMBER, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
