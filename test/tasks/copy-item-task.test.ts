import { DatabaseTransactionConnectionType } from 'slonik';

import { MAX_TREE_LEVELS, MAX_NUMBER_OF_CHILDREN, MAX_DESCENDANTS_FOR_COPY } from '../../src/util/config';

import { GraaspError, GraaspErrorCode } from '../../src/util/graasp-error';
import { Member } from '../../src/services/members/interfaces/member';
import { Item, UnknownExtra } from '../../src/services/items/interfaces/item';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { CopyItemTask } from '../../src/services/items/tasks/copy-item-task';
import { PermissionLevel } from '../../src/services/item-memberships/interfaces/item-membership';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('CopyItemTask', () => {
  const itemId = 'someid';
  const parentItemId = 'parentid';
  const itemService = new ItemService();
  const fakeItem = { id: itemId, path: 'some/path'  } as Item;
  const fakeParentItem = { id: parentItemId, path: 'some/parent/path' } as Item;
  const itemMembershipService = new ItemMembershipService();
  const dbHandler = {} as DatabaseTransactionConnectionType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`Task's \`name\` property should contain the classname: ${CopyItemTask.name}`, () => {
    const task = new CopyItemTask(member, itemId, itemService, itemMembershipService);
    expect(task.name).toBe(CopyItemTask.name);
  });

  test('Should fail if no item corresponds to `itemId``', async () => {
     expect.assertions(2);
    itemService.get =
      jest.fn(async () => null);

      try {
    const task = new CopyItemTask(member, itemId, itemService, itemMembershipService);
    await task.run(dbHandler);
  } catch (error) {
    expect(error).toBeInstanceOf(GraaspError);
    expect(error.name).toBe(GraaspErrorCode.ItemNotFound);
  }
  });

  test('Should fail when `member` can not \'read\' permission over item', async () => {
    expect.assertions(2);
    itemService.get =
    jest.fn(async () => fakeItem);
    itemMembershipService.getPermissionLevel = jest.fn(async () => null);

    try {
      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.UserCannotReadItem);
    }
  });

  test('Should fail when number of descendants exceeds `MAX_DESCENDANTS_FOR_COPY`', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => fakeItem);
    itemService.getNumberOfDescendants = jest.fn(async() => MAX_DESCENDANTS_FOR_COPY+1)
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);

    try {
      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.TooManyDescendants);
    }
  });

  test('Should fail if no item corresponds to `parentItemId`', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async (id) => {
      switch(id) {
        case itemId:
          return fakeItem;
        case parentItemId:
        default:
          return null
      }
    });
    itemService.getNumberOfDescendants = jest.fn(async() => 0)
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);

    try {
      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.ItemNotFound);
    }
  });

  test('Should fail when `member` has no permission over parent-item', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async (id) => {
      switch(id) {
        case itemId:
          return fakeItem;
        case parentItemId:
          return fakeParentItem
        default:
          return null
      }
    });
    itemService.getNumberOfDescendants = jest.fn(async() => 0)
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);

    try {
      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.UserCannotWriteItem);
    }
  });

  test('Should fail when resulting tree number of levels exceeds `MAX_TREE_LEVELS`', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async (id) => {
      switch(id) {
        case itemId:
          return fakeItem;
        case parentItemId:
          return fakeParentItem
        default:
          return null
      }
    });
    itemService.getNumberOfDescendants = jest.fn(async() => 0)
    itemService.getNumberOfLevelsToFarthestChild = jest.fn(async() => MAX_TREE_LEVELS)
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);

    try {
      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.HierarchyTooDeep);
    }
  });

  test('Should copy item and its descendants', async () => {
    // items need paths to avoid error
    type Extra = {id: string, path: string}
    const fakeItem1 = {id: 'fakeItem1', path:'some.path1'} as Item<Extra>;
    const fakeItem2 = {id: 'fakeItem2', path: 'some.path2'} as Partial<Item<Extra>>;
    const fakeItem3 = {id: 'fakeItem3', path: 'some.path3'} as Partial<Item<Extra>>;
    itemService.get = jest.fn(async (id) => {
      switch(id) {
        case itemId:
          return fakeItem1;
        case parentItemId:
          return fakeParentItem;
        default:
          return null;
      }
    });
    itemService.getNumberOfDescendants = jest.fn(async () => 0);
    itemService.getDescendants = jest.fn(async () => [fakeItem2, fakeItem3])
    itemService.getNumberOfLevelsToFarthestChild = jest.fn(async () => 0);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);
    itemService.create = jest.fn(async (data) => data as Item)

      const itemTree = [fakeItem1, fakeItem2, fakeItem3]

      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService, parentItemId);
      const subTasks =await task.run(dbHandler);

      for(const [i, subTask] of subTasks.entries()) {
        await subTask.run(dbHandler)
        // item should be different
        expect(subTask.result).not.toEqual(itemTree[i])
      }

      expect(itemService.create).toHaveBeenCalledTimes(itemTree.length);
  });
});
