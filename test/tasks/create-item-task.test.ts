import { DatabaseTransactionConnectionType } from 'slonik';

import { MAX_TREE_LEVELS, MAX_NUMBER_OF_CHILDREN } from '../../src/util/config';

import { GraaspError, GraaspErrorCode } from '../../src/util/graasp-error';
import { Member } from '../../src/services/members/interfaces/member';
import { Item } from '../../src/services/items/interfaces/item';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { CreateItemTask } from '../../src/services/items/tasks/create-item-task';
import { PermissionLevel } from '../../src/services/item-memberships/interfaces/item-membership';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('CreateItemTask', () => {
  const itemData = { name: 'new item name' };
  const itemService = new ItemService();
  const itemMembershipService = new ItemMembershipService();
  const dbHandler = {} as DatabaseTransactionConnectionType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`Task's \`name\` property should contain the classname: ${CreateItemTask.name}`, () => {
    const task = new CreateItemTask(member, itemData, itemService, itemMembershipService);
    expect(task.name).toBe(CreateItemTask.name);
  });

  test('Should create new item and new membership - no `parentItemId`', async () => {
    itemService.create =
      jest.fn(async () => Object.assign({ id: 'item-id', path: 'item_id' }, itemData) as Item);

    const task = new CreateItemTask(member, itemData, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(itemService.create).toHaveBeenCalled();
    expect(itemMembershipService.create).toHaveBeenCalled();
  });

  test('Should fail if `parentItemId` does not match any existing item', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => null);

    try {
      const parentItemId = 'parent-item-id';
      const task = new CreateItemTask(member, itemData, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);

    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.ItemNotFound);
    }
  });

  test('Should fail when `member` has no permission over parent-item', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => ({ id: 'parent-item-id' } as Item));
    itemMembershipService.getPermissionLevel = jest.fn(async () => null);

    try {
      const parentItemId = 'parent-item-id';
      const task = new CreateItemTask(member, itemData, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.UserCannotWriteItem);
    }
  });

  test('Should fail when `member` has only \'read\' permission over parent-item', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => ({ id: 'parent-item-id' } as Item));
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);

    try {
      const parentItemId = 'parent-item-id';
      const task = new CreateItemTask(member, itemData, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.UserCannotWriteItem);
    }
  });

  test('Should fail if by creating item, `MAX_TREE_LEVELS` is crossed', async () => {
    expect.assertions(2);

    // make a parent-item's path as big as `MAX_TREE_LEVELS`
    const parentPath = [...Array(MAX_TREE_LEVELS).keys()].join('.');
    itemService.get =
      jest.fn(async () => ({ id: 'parent-item-id', path: parentPath } as Item));
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);

    try {
      const parentItemId = 'parent-item-id';
      const task = new CreateItemTask(member, itemData, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.HierarchyTooDeep);
    }
  });

  test('Should fail if by creating item, the parent-item\'s children count crosses `MAX_NUMBER_OF_CHILDREN`', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => ({ id: 'parent-item-id', path: 'parent_item_id' } as Item));
    itemService.getNumberOfChildren = jest.fn(async () => MAX_NUMBER_OF_CHILDREN);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);

    try {
      const parentItemId = 'parent-item-id';
      const task = new CreateItemTask(member, itemData, itemService, itemMembershipService, parentItemId);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.TooManyChildren);
    }
  });

  test('Should create new item under parent-item with given `parentItemId` and new membership', async () => {
    itemService.get = jest.fn(async () => ({ id: 'parent-item-id', path: 'parent_item_id' } as Item));
    itemService.getNumberOfChildren = jest.fn(async () => 0);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);

    const parentItemId = 'parent-item-id';
    const task = new CreateItemTask(member, itemData, itemService, itemMembershipService, parentItemId);
    await task.run(dbHandler);

    expect(itemService.create).toHaveBeenCalled();
    expect(itemMembershipService.create).toHaveBeenCalled();
  });

  test('Should create new item under parent-item with given `parentItemId`', async () => {
    itemService.get = jest.fn(async () => ({ id: 'parent-item-id', path: 'parent_item_id' } as Item));
    itemService.getNumberOfChildren = jest.fn(async () => 0);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Admin);

    const parentItemId = 'parent-item-id';
    const task = new CreateItemTask(member, itemData, itemService, itemMembershipService, parentItemId);
    await task.run(dbHandler);

    expect(itemService.create).toHaveBeenCalled();
    expect(itemMembershipService.create).not.toHaveBeenCalled();
  });
});
