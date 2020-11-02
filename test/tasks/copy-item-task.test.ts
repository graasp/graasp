import { DatabaseTransactionConnectionType } from 'slonik';

import { MAX_TREE_LEVELS, MAX_DESCENDANTS_FOR_COPY } from '../../src/util/config';
import { GraaspError, GraaspErrorCode } from '../../src/util/graasp-error';
import { Member, MemberType } from '../../src/services/members/interfaces/member';
import { Item } from '../../src/services/items/interfaces/item';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { CopyItemTask } from '../../src/services/items/tasks/copy-item-task';
import { PermissionLevel } from '../../src/services/item-memberships/interfaces/item-membership';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {
  id: 'memberId',
  name: 'memberName',
  type: MemberType.Individual,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  email: 'email'
} as Member;

const compareItemtoItemCopy =
  (item: Item, itemCopy: Item, idMapping: Map<string, string>, parentItemId?: string) => {
    const {
      id: newId,
      name: newName,
      description: newDescription,
      extra: newExtra,
      creator: newCreator,
      path: newPath
    } = itemCopy;
    const { id, name, description, extra, path } = item;
    // path uses _ instead of -
    idMapping.set(id, newId.split('-').join('_'));

    expect(itemCopy).not.toEqual(item);

    // should be different
    expect(newId).not.toEqual(id);

    // path should stay in order and have the same structure
    expect(newPath).not.toEqual(path);
    const parsedPath = path
      .split('.')
      .map((id) => (idMapping.has(id) ? idMapping.get(id) : id))
      .join('.');
    const withParentId = parentItemId ? `${parentItemId}.` : '';
    expect(newPath).toEqual(`${withParentId}${parsedPath}`);

    // should be same
    expect(newName).toEqual(name);
    expect(newDescription).toEqual(description);
    expect(newExtra).toEqual(extra);

    // creator is member id
    expect(newCreator).toEqual(member.id);
  };

describe('CopyItemTask', () => {
  const itemId = 'someid';
  const parentItemId = 'parentid';
  const fakeItem = { id: itemId, path: `${parentItemId}.${itemId}` } as Item;
  const fakeParentItem = { id: parentItemId, path: `${parentItemId}` } as Item;
  // items need paths to avoid error
  type SomeExtra = { some: string }
  const fakeItem1 = {
    id: 'fakeItem1',
    path: 'fakeItem1',
    name: 'name1',
    description: 'description1',
    extra: { some: 'extra1' }
  } as Item<SomeExtra>;
  const fakeItem2 = {
    id: 'fakeItem2',
    path: 'fakeItem1.fakeItem2',
    name: 'name2',
    description: 'description2',
    extra: { some: 'extra2' }
  } as Item<SomeExtra>;
  const fakeItem3 = {
    id: 'fakeItem3',
    path: 'fakeItem1.fakeItem3',
    name: 'name3',
    description: 'description3',
    extra: { some: 'extra3' }
  } as Item<SomeExtra>;
  const itemService = new ItemService();
  const itemMembershipService = new ItemMembershipService();
  const dbHandler = {} as DatabaseTransactionConnectionType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`CopyItemTask's \`name\` property should contain the classname: ${CopyItemTask.name}`, () => {
    const task = new CopyItemTask(member, itemId, itemService, itemMembershipService);
    expect(task.name).toBe(CopyItemTask.name);
  });

  test('Should fail if no item corresponds to `itemId``', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => null);

    try {
      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.ItemNotFound);
    }
  });

  test('Should fail when `member` can\'t read item', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => fakeItem);
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
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);
    itemService.getNumberOfDescendants = jest.fn(async () => MAX_DESCENDANTS_FOR_COPY + 1);

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
      switch (id) {
        case itemId:
          return fakeItem;
        case parentItemId:
        default:
          return null;
      }
    });
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);
    itemService.getNumberOfDescendants = jest.fn(async () => 0);

    try {
      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.ItemNotFound);
    }
  });

  test('Should fail when `member` cannot write in parent item', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case itemId:
          return fakeItem;
        case parentItemId:
          return fakeParentItem;
        default:
          return null;
      }
    });
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);
    itemService.getNumberOfDescendants = jest.fn(async () => 0);

    try {
      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.UserCannotWriteItem);
    }
  });

  test('Should fail when resulting tree depth levels exceeds `MAX_TREE_LEVELS`', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case itemId:
          return fakeItem;
        case parentItemId:
          return fakeParentItem;
        default:
          return null;
      }
    });
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);
    itemService.getNumberOfDescendants = jest.fn(async () => 0);
    itemService.getNumberOfLevelsToFarthestChild = jest.fn(async () => MAX_TREE_LEVELS - 1);

    try {
      const task = new CopyItemTask(member, itemId, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.HierarchyTooDeep);
    }
  });

  test('Should copy item and its descendants into a separate tree', async () => {
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case itemId:
          return fakeItem1;
        default:
          return null;
      }
    });
    itemService.getNumberOfDescendants = jest.fn(async () => 0);
    itemService.getDescendants = jest.fn(async () => [fakeItem2, fakeItem3]);
    itemService.getNumberOfLevelsToFarthestChild = jest.fn(async () => 0);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);
    itemService.create = jest.fn(async (data) => data as Item);

    const itemTree = [fakeItem1, fakeItem2, fakeItem3];

    const task = new CopyItemTask(member, itemId, itemService, itemMembershipService);
    const subTasks = await task.run(dbHandler);
    const idMapping = new Map();

    expect(subTasks.length).toBe(itemTree.length);

    for (const [i, subTask] of subTasks.entries()) {
      await subTask.run(dbHandler);

      compareItemtoItemCopy(itemTree[i], subTask.result as Item, idMapping);
    }

    expect(itemService.create).toHaveBeenCalledTimes(itemTree.length);

    // create membership
    expect(itemMembershipService.create).toHaveBeenCalled();
  });

  test('Should copy item and its descendants into parentItem with membership', async () => {
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case itemId:
          return fakeItem1;
        case parentItemId:
          return fakeParentItem;
        default:
          return null;
      }
    });
    itemService.getNumberOfDescendants = jest.fn(async () => 0);
    itemService.getDescendants = jest.fn(async () => [fakeItem2, fakeItem3]);
    itemService.getNumberOfLevelsToFarthestChild = jest.fn(async () => 0);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);
    itemService.create = jest.fn(async (data) => data as Item);

    const itemTree = [fakeItem1, fakeItem2, fakeItem3];

    const task = new CopyItemTask(member, itemId, itemService, itemMembershipService, parentItemId);
    const subTasks = await task.run(dbHandler);
    const idMapping = new Map();

    expect(subTasks.length).toBe(itemTree.length);

    for (const [i, subTask] of subTasks.entries()) {
      await subTask.run(dbHandler);

      compareItemtoItemCopy(itemTree[i], subTask.result as Item, idMapping, parentItemId);
    }

    expect(itemService.create).toHaveBeenCalledTimes(itemTree.length);
    expect(itemMembershipService.create).toHaveBeenCalled();
  });

  test('Should copy item and its descendants into parentItem without membership', async () => {
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case itemId:
          return fakeItem1;
        case parentItemId:
          return fakeParentItem;
        default:
          return null;
      }
    });
    itemService.getNumberOfDescendants = jest.fn(async () => 0);
    itemService.getDescendants = jest.fn(async () => [fakeItem2, fakeItem3]);
    itemService.getNumberOfLevelsToFarthestChild = jest.fn(async () => 0);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Admin);
    itemService.create = jest.fn(async (data) => data as Item);

    const itemTree = [fakeItem1, fakeItem2, fakeItem3];

    const task = new CopyItemTask(member, itemId, itemService, itemMembershipService, parentItemId);
    const subTasks = await task.run(dbHandler);
    const idMapping = new Map();

    expect(subTasks.length).toBe(itemTree.length);
    for (const [i, subTask] of subTasks.entries()) {
      await subTask.run(dbHandler);

      compareItemtoItemCopy(itemTree[i], subTask.result as Item, idMapping, parentItemId);
    }

    expect(itemService.create).toHaveBeenCalledTimes(itemTree.length);

    // membership not created
    expect(itemMembershipService.create).not.toHaveBeenCalled();
  });
});
