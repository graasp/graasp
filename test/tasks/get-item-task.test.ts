import { DatabaseTransactionConnectionType } from 'slonik';

import { ItemNotFound, UserCannotReadItem } from '../../src/util/graasp-error';
import { Member } from '../../src/services/members/interfaces/member';
import { Item } from '../../src/services/items/interfaces/item';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { GetItemTask } from '../../src/services/items/tasks/get-item-task';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('GetItemTask', () => {
  const itemId = 'item-id';
  const fakeItem = { id: itemId } as Item;
  const itemService = new ItemService();
  const itemMembershipService = new ItemMembershipService();
  const dbHandler = {} as DatabaseTransactionConnectionType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`Task's \`name\` property should contain the classname: ${GetItemTask.name}`, () => {
    const task = new GetItemTask(member, itemId, itemService, itemMembershipService);
    expect(task.name).toBe(GetItemTask.name);
  });

  test('Should fail when `itemId` does not match any existing item', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => null);

    try {
      const task = new GetItemTask(member, itemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(ItemNotFound);
    }
  });

  test('Should fail when `member` can\'t read item', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.canRead = jest.fn(async () => false);

    try {
      const task = new GetItemTask(member, itemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(UserCannotReadItem);
    }
  });

  test('Should return item when `member` can read it', async () => {
    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.canRead = jest.fn(async () => true);

    const task = new GetItemTask(member, itemId, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(task.result).toMatchObject(fakeItem);
  });
});
