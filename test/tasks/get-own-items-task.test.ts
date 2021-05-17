import { DatabaseTransactionConnectionType } from 'slonik';

import { Member } from '../../src/services/members/interfaces/member';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { GetOwnItemsTask } from '../../src/services/items/tasks/get-own-items-task';
import { getDummyItem } from './utils';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('GetOwnItemsTask', () => {
  const itemService = new ItemService();
  const itemMembershipService = new ItemMembershipService();
  const dbHandler = {} as DatabaseTransactionConnectionType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`Task's \`name\` property should contain the classname: ${GetOwnItemsTask.name}`, () => {
    const task = new GetOwnItemsTask(member, itemService, itemMembershipService);
    expect(task.name).toBe(GetOwnItemsTask.name);
  });

  test('Should return `member`\'s "own" items', async () => {
    const items = [...Array(3).keys()].map(() => getDummyItem());
    itemService.getOwn = jest.fn(async () => items);

    const task = new GetOwnItemsTask(member, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(task.result).toMatchObject(items);
  });
});
