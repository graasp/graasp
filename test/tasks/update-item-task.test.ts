import { DatabaseTransactionConnectionType } from 'slonik';

import { GraaspError, GraaspErrorCode } from '../../src/util/graasp-error';
import { Member } from '../../src/services/members/interfaces/member';
import { Item } from '../../src/services/items/interfaces/item';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { UpdateItemTask } from '../../src/services/items/tasks/update-item-task';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('UpdateItemTask', () => {
  const itemId = 'item-id';
  const extra = { data: 'somedata' };
  const fakeItem = { id: itemId, extra } as Item<typeof extra>;
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
    expect.assertions(2);
    itemService.get = jest.fn(async () => null);

    try {
      const task = new UpdateItemTask(member, itemId, updatedItemData, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.ItemNotFound);
    }
  });

  test('Should fail when `member` can not \'write\' permission over item', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.canWrite = jest.fn(async () => false);

    try {
      const task = new UpdateItemTask(member, itemId, updatedItemData, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.UserCannotWriteItem);
    }
  });

  // add this test once propagating changes are defined
  // test('Should fail if when updating item, it has too many descendants to propagate changes', async () => {
  //   expect.assertions(2);
  //   itemService.get = jest.fn(async () => fakeItem);
  //   itemMembershipService.canWrite = jest.fn(async () => true);
  //   itemService.getDescendants = jest.fn(async () => new Array(MAX_DESCENDANTS_FOR_UPDATE+1));

  //   try {
  //     const task = new UpdateItemTask(member, itemId, itemData, itemService, itemMembershipService);
  //     await task.run(dbHandler);
  //   } catch (error) {
  //     expect(error).toBeInstanceOf(GraaspError);
  //     expect(error.name).toBe(GraaspErrorCode.TooManyDescendants);
  //   }
  // });

  test('Should update item when `member` can write it', async () => {
    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.canWrite = jest.fn(async () => true);
    const updatedItem = { id: itemId, extra, ...updatedItemData } as Item<typeof extra>;
    itemService.update = jest.fn(async () => updatedItem);

    const task = new UpdateItemTask(member, itemId, updatedItemData, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(itemService.update).toHaveBeenCalled();
    expect(task.result).toBe(updatedItem);
  });

  test('Should update item with extra data when `member` can write it', async () => {
    const updatedExtra = { p1: 123, data: 'someotherdata' };
    const updatedItem = { id: itemId, extra: updatedExtra } as Item<typeof updatedExtra>;
    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.canWrite = jest.fn(async () => true);
    itemService.update = jest.fn(async () => updatedItem);

    const task = new UpdateItemTask(member, itemId, { extra: updatedExtra }, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(itemService.update).toHaveBeenCalled();
    expect(task.result).toBe(updatedItem);
    // extra is correctly updated with new values
    expect(task.data.extra).toStrictEqual(updatedExtra);
  });
});
