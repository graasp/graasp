import { DatabaseTransactionConnectionType } from 'slonik';

import { MAX_TREE_LEVELS, MAX_DESCENDANTS_FOR_COPY } from '../../src/util/config';
import { HierarchyTooDeep, ItemNotFound, TooManyDescendants, UserCannotReadItem, UserCannotWriteItem } from '../../src/util/graasp-error';
import { Member, MemberType } from '../../src/services/members/interfaces/member';
import { Item } from '../../src/services/items/interfaces/item';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { CopyItemTask } from '../../src/services/items/tasks/copy-item-task';
import { PermissionLevel } from '../../src/services/item-memberships/interfaces/item-membership';
import { getDummyItem } from './utils';
import { UnknownExtra } from '../../src/interfaces/extra';

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
  (item: Item, itemCopy: Item, pathMapping: Map<string, string>, parentItemId?: string) => {
    const {
      id: newId,
      name: newName,
      description: newDescription,
      extra: newExtra,
      creator: newCreator,
      path: newPath
    } = itemCopy;
    const { id, name, description, extra, path } = item;

    pathMapping.set(id.replace(/-/g, '_'), newId.replace(/-/g, '_'));

    expect(itemCopy).not.toEqual(item);

    // should be different
    expect(newId).not.toEqual(id);

    // path should stay in order and have the same structure
    expect(newPath).not.toEqual(path);
    const parsedPath = path
      .split('.')
      .map(id => pathMapping.has(id) ? pathMapping.get(id) : id)
      .join('.');
    const withParentId = parentItemId ? `${parentItemId.replace(/-/g, '_')}.` : '';
    expect(newPath).toEqual(`${withParentId}${parsedPath}`);

    // should be same
    expect(newName).toEqual(name);
    expect(newDescription).toEqual(description);
    expect(newExtra).toEqual(extra);

    // creator is member id
    expect(newCreator).toEqual(member.id);
  };

describe('CopyItemTask', () => {
  const fakeTargetParentItem = getDummyItem();
  const fakeTargetParentItemId = fakeTargetParentItem.id;
  const fakeItem = getDummyItem();
  const fakeItemId = fakeItem.id;

  const fakeItem1 = getDummyItem({}, { prop1: 123 });
  const fakeItem2 = getDummyItem({ parentPath: fakeItem1.path }, { prop2: 123 });
  const fakeItem3 = getDummyItem({ parentPath: fakeItem1.path }, { prop3: 123 });

  const itemService = new ItemService();
  const itemMembershipService = new ItemMembershipService();
  const dbHandler = {} as DatabaseTransactionConnectionType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`CopyItemTask's \`name\` property should contain the classname: ${CopyItemTask.name}`, () => {
    const task = new CopyItemTask(member, fakeItemId, itemService, itemMembershipService);
    expect(task.name).toBe(CopyItemTask.name);
  });

  test('Should fail if no item corresponds to `itemId``', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => null);

    try {
      const task = new CopyItemTask(member, fakeItemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(ItemNotFound);
    }
  });

  test('Should fail when `member` can\'t read item', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.getPermissionLevel = jest.fn(async () => null);

    try {
      const task = new CopyItemTask(member, fakeItemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(UserCannotReadItem);
    }
  });

  test('Should fail when number of descendants exceeds `MAX_DESCENDANTS_FOR_COPY`', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);
    itemService.getNumberOfDescendants = jest.fn(async () => MAX_DESCENDANTS_FOR_COPY + 1);

    try {
      const task = new CopyItemTask(member, fakeItemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(TooManyDescendants);
    }
  });

  test('Should fail if no item corresponds to `parentItemId`', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case fakeItemId:
          return fakeItem;
        case fakeTargetParentItemId:
        default:
          return null;
      }
    });
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);
    itemService.getNumberOfDescendants = jest.fn(async () => 0);

    try {
      const task = new CopyItemTask(member, fakeItemId, itemService, itemMembershipService, fakeTargetParentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(ItemNotFound);
    }
  });

  test('Should fail when `member` cannot write in parent item', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case fakeItemId:
          return fakeItem;
        case fakeTargetParentItemId:
          return fakeTargetParentItem;
        default:
          return null;
      }
    });
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);
    itemService.getNumberOfDescendants = jest.fn(async () => 0);

    try {
      const task = new CopyItemTask(member, fakeItemId, itemService, itemMembershipService, fakeTargetParentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(UserCannotWriteItem);
    }
  });

  test('Should fail when resulting tree depth levels exceeds `MAX_TREE_LEVELS`', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case fakeItemId:
          return fakeItem;
        case fakeTargetParentItemId:
          return fakeTargetParentItem;
        default:
          return null;
      }
    });
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);
    itemService.getNumberOfDescendants = jest.fn(async () => 0);
    itemService.getNumberOfLevelsToFarthestChild = jest.fn(async () => MAX_TREE_LEVELS - 1);

    try {
      const task = new CopyItemTask(member, fakeItemId, itemService, itemMembershipService, fakeTargetParentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(HierarchyTooDeep);
    }
  });

  test('Should copy item and its descendants into a separate tree', async () => {
    itemService.get = jest.fn(async () => fakeItem1);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);
    itemService.getNumberOfDescendants = jest.fn(async () => 2);
    itemService.getDescendants = jest.fn(async () => [fakeItem2, fakeItem3]);
    itemService.create =
      jest.fn(async <T extends UnknownExtra>(i: Partial<Item<T>>) => i as Item<T>);

    const itemTree = [fakeItem1, fakeItem2, fakeItem3];

    const task = new CopyItemTask(member, fakeItem1.id, itemService, itemMembershipService);
    const subTasks = await task.run(dbHandler);
    const pathMapping = new Map();

    expect(subTasks.length).toBe(itemTree.length);

    for (const [i, subTask] of subTasks.entries()) {
      await subTask.run(dbHandler, null);

      compareItemtoItemCopy(itemTree[i], subTask.result as Item, pathMapping);
    }

    expect(itemService.create).toHaveBeenCalledTimes(itemTree.length);

    // create membership
    expect(itemMembershipService.create).toHaveBeenCalled();
  });

  test('Should copy item and its descendants into parentItem with membership', async () => {
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case fakeItem1.id:
          return fakeItem1;
        case fakeTargetParentItemId:
          return fakeTargetParentItem;
        default:
          return null;
      }
    });
    itemService.getNumberOfDescendants = jest.fn(async () => 0);
    itemService.getDescendants = jest.fn(async () => [fakeItem2, fakeItem3]);
    itemService.getNumberOfLevelsToFarthestChild = jest.fn(async () => 2);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);
    itemService.create =
      jest.fn(async <T extends UnknownExtra>(i: Partial<Item<T>>) => i as Item<T>);

    const itemTree = [fakeItem1, fakeItem2, fakeItem3];

    const task = new CopyItemTask(member, fakeItem1.id, itemService, itemMembershipService, fakeTargetParentItemId);
    const subTasks = await task.run(dbHandler);
    const pathMapping = new Map();

    expect(subTasks.length).toBe(itemTree.length);

    for (const [i, subTask] of subTasks.entries()) {
      await subTask.run(dbHandler, null);

      compareItemtoItemCopy(itemTree[i], subTask.result as Item, pathMapping, fakeTargetParentItemId);
    }

    expect(itemService.create).toHaveBeenCalledTimes(itemTree.length);
    expect(itemMembershipService.create).toHaveBeenCalled();
  });

  test('Should copy item and its descendants into parentItem without membership', async () => {
    itemService.get = jest.fn(async (id) => {
      switch (id) {
        case fakeItemId:
          return fakeItem1;
        case fakeTargetParentItemId:
          return fakeTargetParentItem;
        default:
          return null;
      }
    });
    itemService.getNumberOfDescendants = jest.fn(async () => 0);
    itemService.getDescendants = jest.fn(async () => [fakeItem2, fakeItem3]);
    itemService.getNumberOfLevelsToFarthestChild = jest.fn(async () => 0);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Admin);
    itemService.create =
      jest.fn(async <T extends UnknownExtra>(i: Partial<Item<T>>) => i as Item<T>);

    const itemTree = [fakeItem1, fakeItem2, fakeItem3];

    const task = new CopyItemTask(member, fakeItemId, itemService, itemMembershipService, fakeTargetParentItemId);
    const subTasks = await task.run(dbHandler);
    const pathMapping = new Map();

    expect(subTasks.length).toBe(itemTree.length);
    for (const [i, subTask] of subTasks.entries()) {
      await subTask.run(dbHandler, null);

      compareItemtoItemCopy(itemTree[i], subTask.result as Item, pathMapping, fakeTargetParentItemId);
    }

    expect(itemService.create).toHaveBeenCalledTimes(itemTree.length);

    // membership not created
    expect(itemMembershipService.create).not.toHaveBeenCalled();
  });
});
