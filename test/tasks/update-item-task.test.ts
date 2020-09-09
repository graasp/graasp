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
  const fakeItem = ({ id: itemId } as Item);
  const updatedItemData = {description: 'item-description'}
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
    itemMembershipService.canWrite = jest.fn(async () =>  true);

    const task = new UpdateItemTask(member, itemId, updatedItemData, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(itemService.update).toHaveBeenCalled();
    expect(itemMembershipService.update).not.toHaveBeenCalled();
  });

  test('Should update item with extra data when `member` can write it', async () => {
    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.canWrite = jest.fn(async () =>  true);

    const itemDataWithExtra = {extra: {data: "somedata"}};
    const task = new UpdateItemTask(member, itemId, itemDataWithExtra, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(itemService.update).toHaveBeenCalled();
    expect(itemMembershipService.update).not.toHaveBeenCalled();
  });
});
