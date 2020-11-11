import { DatabaseTransactionConnectionType } from 'slonik';

import { GraaspError, GraaspErrorCode } from '../../src/util/graasp-error';
import { Member } from '../../src/services/members/interfaces/member';
import { Item } from '../../src/services/items/interfaces/item';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { GetItemChildrenTask } from '../../src/services/items/tasks/get-item-children-task';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('GetItemChildrenTask', () => {
  const itemId = 'item-id';
  const fakeItem = { id: itemId } as Item;
  const itemService = new ItemService();
  const itemMembershipService = new ItemMembershipService();
  const dbHandler = {} as DatabaseTransactionConnectionType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`Task's \`name\` property should contain the classname: ${GetItemChildrenTask.name}`, () => {
    const task = new GetItemChildrenTask(member, itemId, itemService, itemMembershipService);
    expect(task.name).toBe(GetItemChildrenTask.name);
  });

  test('Should fail when `itemId` does not match any existing item', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => null);

    try {
      const task = new GetItemChildrenTask(member, itemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.ItemNotFound);
    }
  });

  test('Should fail when `member` can\'t read item', async () => {
    expect.assertions(2);
    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.canRead = jest.fn(async () => false);

    try {
      const task = new GetItemChildrenTask(member, itemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(GraaspError);
      expect(error.name).toBe(GraaspErrorCode.UserCannotReadItem);
    }
  });

  test('Should return item\'s children when `member` can read item', async () => {
    const fakeItemChildren = [{ id: '1' }, { id: '2' }, { id: '2' }] as Item[];

    itemService.get = jest.fn(async () => fakeItem);
    itemMembershipService.canRead = jest.fn(async () => true);
    itemService.getDescendants = jest.fn(async () => fakeItemChildren);

    const task = new GetItemChildrenTask(member, itemId, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(task.result).toMatchObject(fakeItemChildren);
  });
});
