import { v4 } from 'uuid';

import Etherpad from '@graasp/etherpad-api';
import { EtherpadItemFactory, EtherpadPermission, FolderItemFactory } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import type { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { EtherpadItem } from '../../item';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { EtherpadItemService } from './etherpad.service';
import { EtherpadServiceConfig } from './serviceConfig';
import type { PadNameFactory } from './types';

jest.mock('node-fetch');

const padNameFactory = {
  getName: () => 'padName',
} as PadNameFactory;
const etherPadConfig = resolveDependency(EtherpadServiceConfig);
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
  {} as ItemService,
  {} as ItemRepository,
  {} as ItemMembershipRepository,
  MOCK_LOGGER,
  {} as AuthorizedItemService,
);
const id = v4();
const MOCK_ITEM = EtherpadItemFactory({
  id,
  extra: { etherpad: { readerPermission: undefined, padID: v4(), groupID: v4() } },
  settings: {
    isCollapsible: false,
  },
}) as unknown as EtherpadItem;

const MOCK_MEMBER = {} as MinimalMember;
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
};

describe('Etherpad Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEtherpadItem', () => {
    // it('create with readerPermission', async () => {
    //   const itemServiceCreateMock = jest
    //     .spyOn(ItemService.prototype, 'post')
    //     .mockImplementation(async () => {
    //       return MOCK_ITEM;
    //     });
    //   const readerPermission = EtherpadPermission.Write;
    //   await etherpadService.createEtherpadItem(db, MOCK_MEMBER, {
    //     name: 'newName',
    //     readerPermission,
    //   });
    //   expect(itemServiceCreateMock).toHaveBeenCalledWith(db, MOCK_MEMBER, {
    //     item: {
    //       name: 'newName',
    //       type: 'etherpad',
    //       extra: {
    //         ['etherpad']: {
    //           groupID: expect.anything(),
    //           padID: expect.anything(),
    //           readerPermission,
    //         },
    //       },
    //     },
    //     parentId: undefined,
    //   });
    // });
    // it('create with default readerPermission', async () => {
    //   const itemServiceCreateMock = jest
    //     .spyOn(ItemService.prototype, 'post')
    //     .mockImplementation(async () => {
    //       return MOCK_ITEM;
    //     });
    //   await etherpadService.createEtherpadItem(db, MOCK_MEMBER, {
    //     name: 'newName',
    //   });
    //   expect(itemServiceCreateMock).toHaveBeenCalledWith(db, MOCK_MEMBER, {
    //     item: {
    //       name: 'newName',
    //       type: 'etherpad',
    //       extra: {
    //         ['etherpad']: {
    //           groupID: expect.anything(),
    //           padID: expect.anything(),
    //           readerPermission: EtherpadPermission.Read,
    //         },
    //       },
    //     },
    //     parentId: undefined,
    //   });
    // });
  });

  describe('patchWithOptions', () => {
    it('throw if item is not an etherpad', async () => {
      const FOLDER_ITEM = FolderItemFactory();
      await expect(() =>
        etherpadService.patchWithOptions(db, MOCK_MEMBER, FOLDER_ITEM.id, {
          readerPermission: EtherpadPermission.Write,
        }),
      ).rejects.toThrow();
    });
    // it('patch readerPermission', async () => {
    //   const itemServicePatchMock = jest
    //     .spyOn(ItemService.prototype, 'patch')
    //     .mockImplementation(async () => {
    //       return MOCK_ITEM;
    //     });

    //   expect(MOCK_ITEM.extra.etherpad.readerPermission).toBeUndefined();

    //   const readerPermission = "write";
    //   await etherpadService.patchWithOptions(db, MOCK_MEMBER, MOCK_ITEM.id, {
    //     readerPermission,
    //   });

    // call to item service with initial item name
    //   expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
    //     extra: {
    //       ['etherpad']: {
    //         readerPermission: "write",
    //         padID: MOCK_ITEM.extra.etherpad.padID,
    //         groupID: MOCK_ITEM.extra.etherpad.groupID,
    //       },
    //     },
    //   });
    // });
    // it('patch name and settings', async () => {
    //   const itemServicePatchMock = jest
    //     .spyOn(ItemService.prototype, 'patch')
    //     .mockImplementation(async () => {
    //       return MOCK_ITEM;
    //     });

    //   await etherpadService.patchWithOptions(db, MOCK_MEMBER, MOCK_ITEM.id, {
    //     name: 'newName',
    //     settings: { isCollapsible: true },
    //   });

    //   // call to item service with initial item name
    //   expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
    //     name: 'newName',
    //     settings: { isCollapsible: true },
    //   });
    // });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        etherpadService.patchWithOptions(db, MOCK_MEMBER, v4(), {
          readerPermission: 'write',
        }),
      ).rejects.toThrow();
    });
  });
  describe('getEtherpadFromItem', () => {
    // beforeEach(() => {
    //   jest.spyOn(etherpad, 'createAuthorIfNotExistsFor').mockResolvedValue({ authorID: v4() });
    //   jest.spyOn(etherpad, 'createSession').mockResolvedValue({ sessionID: v4() });
    //   jest.spyOn(etherpad, 'deleteSession').mockResolvedValue(null);
    //   jest
    //     .spyOn(etherpad, 'listSessionsOfAuthor')
    //     .mockResolvedValue({ id: { validUntil: 1 } as AuthorSession });
    // });
    // it('return write for reader with write permission', async () => {
    //   // readerPermission is write
    //   jest.spyOn(itemService, 'get').mockResolvedValue({
    //     ...EtherpadItemFactory({
    //       extra: {
    //         etherpad: { padID: v4(), groupID: v4(), readerPermission: "write" },
    //       },
    //     }),
    //     creatorId: 'some',
    //     order: 23,
    //     creator: {} as MemberRaw,
    //   });
    //   // actor has read permission
    //   jest.spyOn(repositories.itemMembershipRepository, 'getInherited').mockResolvedValue({
    //     permission: "read",
    //     item: {} as ItemRaw,
    //   } as ItemMembershipWithItemAndAccount);
    //   const getReadOnlyIDMock = jest.spyOn(etherpad, 'getReadOnlyID');
    //   // actor require write
    //   await etherpadService.getEtherpadFromItem(db, MOCK_MEMBER, MOCK_ITEM.id, 'write');
    //   // this is called only if returned mode is read, which shouldn't be the case here
    //   expect(getReadOnlyIDMock).not.toHaveBeenCalled();
    // });
    // it('return read for reader with no permission even if asked for write', async () => {
    //   // readerPermission is read
    //   jest.spyOn(itemService, 'get').mockResolvedValue({
    //     ...EtherpadItemFactory({
    //       extra: {
    //         etherpad: { padID: v4(), groupID: v4(), readerPermission: "read" },
    //       },
    //     }),
    //     creatorId: 'some',
    //     order: 23,
    //     creator: {} as MemberRaw,
    //   });
    //   // permission is read
    //   jest.spyOn(repositories.itemMembershipRepository, 'getInherited').mockResolvedValue({
    //     permission: "read",
    //   } as ItemMembershipWithItemAndAccount);
    //   const getReadOnlyIDMock = jest
    //     .spyOn(etherpad, 'getReadOnlyID')
    //     .mockResolvedValue({ readOnlyID: v4() });
    //   // request write
    //   await etherpadService.getEtherpadFromItem(db, MOCK_MEMBER, MOCK_ITEM.id, 'write');
    //   // this is called only if returned mode is read, which is the case here
    //   expect(getReadOnlyIDMock).toHaveBeenCalled();
    // });
  });

  describe('Service helper methods', () => {
    it('builds correct pad ID', () => {
      expect(
        EtherpadItemService.buildPadID({ groupID: 'g.s8oes9dhwrvt0zif', padName: 'test' }),
      ).toEqual('g.s8oes9dhwrvt0zif$test');
    });

    it('builds correct relative pad path', () => {
      expect(EtherpadItemService.buildPadPath({ padID: 'g.s8oes9dhwrvt0zif$test' })).toEqual(
        '/p/g.s8oes9dhwrvt0zif$test',
      );
    });

    it('builds correct absolute pad url', () => {
      expect(
        EtherpadItemService.buildPadPath(
          { padID: 'g.s8oes9dhwrvt0zif$test' },
          'http://localhost:9001',
        ),
      ).toEqual('http://localhost:9001/p/g.s8oes9dhwrvt0zif$test');
    });

    it('builds correct etherpad item extra', () => {
      expect(
        EtherpadItemService.buildEtherpadExtra({ groupID: 'g.s8oes9dhwrvt0zif', padName: 'test' }),
      ).toEqual({
        etherpad: {
          padID: 'g.s8oes9dhwrvt0zif$test',
          groupID: 'g.s8oes9dhwrvt0zif',
          readerPermission: EtherpadPermission.Read,
        },
      });
    });
  });
});
