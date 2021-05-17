import { DatabaseTransactionConnectionType } from 'slonik';

import { ItemNotFound, UserCannotReadItem } from '../../src/util/graasp-error';
import { Member } from '../../src/services/members/interfaces/member';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { GetItemChildrenTask } from '../../src/services/items/tasks/get-item-children-task';
import { getDummyItem } from './utils';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('GetItemChildrenTask', () => {
  const item = getDummyItem();
  const itemId = item.id;

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
    expect.assertions(1);
    itemService.get = jest.fn(async () => null);

    try {
      const task = new GetItemChildrenTask(member, itemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(ItemNotFound);
    }
  });

  test('Should fail when `member` can\'t read item', async () => {
    expect.assertions(1);
    itemService.get = jest.fn(async () => getDummyItem());
    itemMembershipService.canRead = jest.fn(async () => false);

    try {
      const task = new GetItemChildrenTask(member, itemId, itemService, itemMembershipService);
      await task.run(dbHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(UserCannotReadItem);
    }
  });

  test('Should return item\'s children when `member` can read item', async () => {
    const childrenItems = [...Array(3).keys()].map(() => getDummyItem());
    itemService.get = jest.fn(async () => getDummyItem());
    itemMembershipService.canRead = jest.fn(async () => true);
    itemService.getDescendants = jest.fn(async () => childrenItems);

    const task = new GetItemChildrenTask(member, itemId, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(task.result).toMatchObject(childrenItems);
  });
});
