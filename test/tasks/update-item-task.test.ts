import { DatabaseTransactionConnectionType } from 'slonik';

import { ItemNotFound, UserCannotWriteItem } from '../../src/util/graasp-error';
import { Member } from '../../src/services/members/interfaces/member';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { UpdateItemTask } from '../../src/services/items/tasks/update-item-task';
import { getDummyItem } from '../utils';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('UpdateItemTask', () => {
  const itemId = 'item-id';
  const updatedItemData = { description: 'item-description' };
  const itemService = new ItemService();
  const itemMembershipService = new ItemMembershipService();
  const dbHandler = {} as DatabaseTransactionConnectionType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`Task's \`name\` property should contain the classname: ${UpdateItemTask.name}`, () => {
    const task = new UpdateItemTask(member, itemId, updatedItemData, itemService, itemMembershipService);
    expect(task.name).toBe(UpdateItemTask.name);
  });

  test('Should fail if no item corresponds to `itemId`', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => null);

    try {
      const task = new UpdateItemTask(member, itemId, updatedItemData, itemService, itemMembershipService);
      await task.run(dbHandler, null);
    } catch (error) {
      expect(error).toBeInstanceOf(ItemNotFound);
    }
  });

  test('Should fail when `member` can not \'write\' permission over item', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => getDummyItem());
    itemMembershipService.canWrite = jest.fn(async () => false);

    try {
      const task = new UpdateItemTask(member, itemId, updatedItemData, itemService, itemMembershipService);
      await task.run(dbHandler, null);
    } catch (error) {
      expect(error).toBeInstanceOf(UserCannotWriteItem);
    }
  });

  // add this test once propagating changes are defined
  // test('Should fail if when updating item, it has too many descendants to propagate changes', async () => {
  //   expect.assertions(1);
  //   itemService.get = jest.fn(async () => fakeItem);
  //   itemMembershipService.canWrite = jest.fn(async () => true);
  //   itemService.getDescendants = jest.fn(async () => new Array(MAX_DESCENDANTS_FOR_UPDATE+1));

  //   try {
  //     const task = new UpdateItemTask(member, itemId, itemData, itemService, itemMembershipService);
  //     await task.run(dbHandler);
  //   } catch (error) {
  //     expect(error).toBeInstanceOf(TooManyDescendants);
  //   }
  // });

  test('Should update item when `member` can write it', async () => {
    const item = getDummyItem();

    itemService.get = jest.fn(async () => item);
    itemMembershipService.canWrite = jest.fn(async () => true);

    const updatedItem = Object.assign(item, updatedItemData);
    itemService.update = jest.fn(async () => updatedItem);

    const task = new UpdateItemTask(member, itemId, updatedItemData, itemService, itemMembershipService);
    await task.run(dbHandler, null);

    expect(itemService.update).toHaveBeenCalled();
    expect(task.result).toBe(updatedItem);
  });

  test('Should update item with extra data when `member` can write it', async () => {
    const updatedExtra = { type: 'type1', extra: { prop1: 123, prop2: 'abc' } };
    const item = getDummyItem({ type: 'type1' });

    itemService.get = jest.fn(async () => item);
    itemMembershipService.canWrite = jest.fn(async () => true);
    itemService.update = jest.fn(async () => Object.assign(item, updatedExtra));

    const task = new UpdateItemTask(member, itemId, updatedExtra, itemService, itemMembershipService);
    await task.run(dbHandler, null);

    expect(itemService.update).toHaveBeenCalled();
    expect(task.result).toBe(item);
    // extra is correctly updated with new values
    expect(task.data.extra).toStrictEqual(updatedExtra.extra);
  });
});
