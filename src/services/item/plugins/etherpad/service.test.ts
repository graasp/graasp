import { v4 } from 'uuid';

import Etherpad, { AuthorSession } from '@graasp/etherpad-api';
import {
  EtherpadItemFactory,
  EtherpadReaderPermission,
  FolderItemFactory,
  ItemType,
  PermissionLevel,
} from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { resolveDependency } from '../../../../di/utils';
import * as repositoriesUtils from '../../../../utils/repositories';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { EtherpadItem } from '../../entities/Item';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../repository';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';
import { EtherpadItemService } from './service';
import { EtherpadServiceConfig } from './serviceConfig';
import { PadNameFactory } from './types';

jest.mock('node-fetch');

const padNameFactory = {
  getName: () => 'padName',
} as PadNameFactory;
const etherPadConfig = resolveDependency(EtherpadServiceConfig);
const itemService = new ItemService(
  {} as ThumbnailService,
  {} as ItemThumbnailService,
  {} as MeiliSearchWrapper,
  MOCK_LOGGER,
);
const etherpad = {
  getReadOnlyID: () => {},
  createAuthorIfNotExistsFor: () => {},
  createSession: () => {},
  deleteSession: () => {},
  listSessionsOfAuthor: () => {},
  createGroupPad: async () => {},
  createGroupIfNotExistsFor: async () => ({ groupID: 'groupId' }),
} as unknown as Etherpad;

const etherpadService = new EtherpadItemService(
  etherpad,
  padNameFactory,
  etherPadConfig,
  itemService,
  MOCK_LOGGER,
);
const id = v4();
const MOCK_ITEM = EtherpadItemFactory({
  id,
  extra: { etherpad: { readerPermission: undefined, padID: v4(), groupID: v4() } },
  settings: {
    isCollapsible: false,
  },
}) as unknown as EtherpadItem;

const MOCK_MEMBER = {} as Member;
const repositories = {
  itemRepository: {
    getOneOrThrow: async () => {
      return MOCK_ITEM;
    },
  } as unknown as ItemRepository,
  itemMembershipRepository: {
    getOneOrThrow: async () => {
      return MOCK_ITEM;
    },
    getInherited: async () => {
      return {};
    },
  } as unknown as ItemMembershipRepository,
} as repositoriesUtils.Repositories;

describe('Etherpad Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEtherpadItem', () => {
    it('create with readerPermission', async () => {
      const itemServiceCreateMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      const readerPermission = EtherpadReaderPermission.Write;
      await etherpadService.createEtherpadItem(MOCK_MEMBER, repositories, {
        name: 'newName',
        readerPermission,
      });

      expect(itemServiceCreateMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, {
        item: {
          name: 'newName',
          type: ItemType.ETHERPAD,
          extra: {
            [ItemType.ETHERPAD]: {
              groupID: expect.anything(),
              padID: expect.anything(),
              readerPermission,
            },
          },
        },
        parentId: undefined,
      });
    });
    it('create with default readerPermission', async () => {
      const itemServiceCreateMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      await etherpadService.createEtherpadItem(MOCK_MEMBER, repositories, {
        name: 'newName',
      });

      expect(itemServiceCreateMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, {
        item: {
          name: 'newName',
          type: ItemType.ETHERPAD,
          extra: {
            [ItemType.ETHERPAD]: {
              groupID: expect.anything(),
              padID: expect.anything(),
              readerPermission: EtherpadReaderPermission.Read,
            },
          },
        },
        parentId: undefined,
      });
    });
  });

  describe('patchWithOptions', () => {
    it('throw if item is not an etherpad', async () => {
      const FOLDER_ITEM = FolderItemFactory();
      await expect(() =>
        etherpadService.patchWithOptions(
          MOCK_MEMBER,
          {
            itemRepository: {
              getOneOrThrow: async () => {
                return FOLDER_ITEM;
              },
            } as unknown as ItemRepository,
          } as repositoriesUtils.Repositories,
          FOLDER_ITEM.id,
          { readerPermission: EtherpadReaderPermission.Write },
        ),
      ).rejects.toBeInstanceOf(WrongItemTypeError);
    });
    it('patch readerPermission', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      expect(MOCK_ITEM.extra.etherpad.readerPermission).toBeUndefined();

      const readerPermission = PermissionLevel.Write;
      await etherpadService.patchWithOptions(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
        readerPermission,
      });

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
        extra: {
          [ItemType.ETHERPAD]: {
            readerPermission: PermissionLevel.Write,
            padID: MOCK_ITEM.extra.etherpad.padID,
            groupID: MOCK_ITEM.extra.etherpad.groupID,
          },
        },
      });
    });
    it('patch name and settings', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      await etherpadService.patchWithOptions(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
        name: 'newName',
        settings: { isCollapsible: true },
      });

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
        name: 'newName',
        settings: { isCollapsible: true },
      });
    });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        etherpadService.patchWithOptions(MOCK_MEMBER, repositories, v4(), {
          readerPermission: PermissionLevel.Write,
        }),
      ).rejects.toThrow();
    });
  });
  describe('getEtherpadFromItem', () => {
    beforeEach(() => {
      jest.spyOn(repositoriesUtils, 'buildRepositories').mockReturnValue(repositories);
      jest.spyOn(etherpad, 'createAuthorIfNotExistsFor').mockResolvedValue({ authorID: v4() });
      jest.spyOn(etherpad, 'createSession').mockResolvedValue({ sessionID: v4() });
      jest.spyOn(etherpad, 'deleteSession').mockResolvedValue(null);
      jest
        .spyOn(etherpad, 'listSessionsOfAuthor')
        .mockResolvedValue({ id: { validUntil: 1 } as AuthorSession });
    });

    it('return write for reader with write permission', async () => {
      // readerPermission is write
      jest.spyOn(itemService, 'get').mockResolvedValue(
        EtherpadItemFactory({
          extra: {
            etherpad: { padID: v4(), groupID: v4(), readerPermission: PermissionLevel.Write },
          },
        }) as unknown as EtherpadItem,
      );

      // actor has read permission
      jest
        .spyOn(repositories.itemMembershipRepository, 'getInherited')
        .mockResolvedValue({ permission: PermissionLevel.Read } as unknown as ItemMembership);
      const getReadOnlyIDMock = jest.spyOn(etherpad, 'getReadOnlyID');

      // actor require write
      await etherpadService.getEtherpadFromItem(MOCK_MEMBER, MOCK_ITEM.id, 'write');

      // this is called only if returned mode is read, which shouldn't be the case here
      expect(getReadOnlyIDMock).not.toHaveBeenCalled();
    });
    it('return read for reader with no permission even if asked for write', async () => {
      // readerPermission is read
      jest.spyOn(itemService, 'get').mockResolvedValue(
        EtherpadItemFactory({
          extra: {
            etherpad: { padID: v4(), groupID: v4(), readerPermission: PermissionLevel.Read },
          },
        }) as unknown as EtherpadItem,
      );

      // permission is read
      jest
        .spyOn(repositories.itemMembershipRepository, 'getInherited')
        .mockResolvedValue({ permission: PermissionLevel.Read } as unknown as ItemMembership);
      const getReadOnlyIDMock = jest
        .spyOn(etherpad, 'getReadOnlyID')
        .mockResolvedValue({ readOnlyID: v4() });

      // request write
      await etherpadService.getEtherpadFromItem(MOCK_MEMBER, MOCK_ITEM.id, 'write');

      // this is called only if returned mode is read, which is the case here
      expect(getReadOnlyIDMock).toHaveBeenCalled();
    });
  });
});
