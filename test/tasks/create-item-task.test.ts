import { DatabaseTransactionConnectionType } from 'slonik';

import { MAX_TREE_LEVELS, MAX_NUMBER_OF_CHILDREN } from '../../src/util/config';

import {
  HierarchyTooDeep,
  ItemNotFound,
  TooManyChildren,
  UserCannotWriteItem,
} from '../../src/util/graasp-error';
import { Member } from '../../src/services/members/interfaces/member';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { CreateItemTask } from '../../src/services/items/tasks/create-item-task';
import { PermissionLevel } from '../../src/services/item-memberships/interfaces/item-membership';
import { getDummyItem } from '../utils';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('CreateItemTask', () => {
  const itemData = { name: 'new item name' };

  const parentItem = getDummyItem();
  const parentItemId = parentItem.id;

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
    itemService.create = jest.fn(async () => getDummyItem());

    const task = new CreateItemTask(member, itemData, itemService, itemMembershipService);
    await task.run(dbHandler, null);

    expect(itemService.create).toHaveBeenCalled();
    expect(itemMembershipService.create).toHaveBeenCalled();
  });

  test('Should fail if `parentItemId` does not match any existing item', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => null);

    try {
      const task = new CreateItemTask(
        member,
        itemData,
        itemService,
        itemMembershipService,
        parentItemId,
      );
      await task.run(dbHandler, null);
    } catch (error) {
      expect(error).toBeInstanceOf(ItemNotFound);
    }
  });

  test('Should fail when `member` has no permission over parent-item', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => parentItem);
    itemMembershipService.getPermissionLevel = jest.fn(async () => null);

    try {
      const task = new CreateItemTask(
        member,
        itemData,
        itemService,
        itemMembershipService,
        parentItemId,
      );
      await task.run(dbHandler, null);
    } catch (error) {
      expect(error).toBeInstanceOf(UserCannotWriteItem);
    }
  });

  test("Should fail when `member` has only 'read' permission over parent-item", async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => parentItem);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Read);

    try {
      const task = new CreateItemTask(
        member,
        itemData,
        itemService,
        itemMembershipService,
        parentItemId,
      );
      await task.run(dbHandler, null);
    } catch (error) {
      expect(error).toBeInstanceOf(UserCannotWriteItem);
    }
  });

  test('Should fail if by creating item, `MAX_TREE_LEVELS` is crossed', async () => {
    expect.assertions(1);

    // make a parent-item's path as big as `MAX_TREE_LEVELS`
    const parentPath = [...Array(MAX_TREE_LEVELS).keys()].join('.');
    itemService.get = jest.fn(async () => getDummyItem({ parentPath }));
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);

    try {
      const task = new CreateItemTask(
        member,
        itemData,
        itemService,
        itemMembershipService,
        parentItemId,
      );
      await task.run(dbHandler, null);
    } catch (error) {
      expect(error).toBeInstanceOf(HierarchyTooDeep);
    }
  });

  test("Should fail if by creating item, the parent-item's children count crosses `MAX_NUMBER_OF_CHILDREN`", async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => parentItem);
    itemService.getNumberOfChildren = jest.fn(async () => MAX_NUMBER_OF_CHILDREN);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);

    try {
      const task = new CreateItemTask(
        member,
        itemData,
        itemService,
        itemMembershipService,
        parentItemId,
      );
      await task.run(dbHandler, null);
    } catch (error) {
      expect(error).toBeInstanceOf(TooManyChildren);
    }
  });

  test('Should create new item under parent-item with given `parentItemId` and new membership', async () => {
    itemService.get = jest.fn(async () => parentItem);
    itemService.getNumberOfChildren = jest.fn(async () => 0);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Write);

    const task = new CreateItemTask(
      member,
      itemData,
      itemService,
      itemMembershipService,
      parentItemId,
    );
    await task.run(dbHandler, null);

    expect(itemService.create).toHaveBeenCalled();
    expect(itemMembershipService.create).toHaveBeenCalled();
  });

  test('Should create new item under parent-item with given `parentItemId`', async () => {
    itemService.get = jest.fn(async () => parentItem);
    itemService.getNumberOfChildren = jest.fn(async () => 0);
    itemMembershipService.getPermissionLevel = jest.fn(async () => PermissionLevel.Admin);

    const task = new CreateItemTask(
      member,
      itemData,
      itemService,
      itemMembershipService,
      parentItemId,
    );
    await task.run(dbHandler, null);

    expect(itemService.create).toHaveBeenCalled();
    expect(itemMembershipService.create).not.toHaveBeenCalled();
  });
});
