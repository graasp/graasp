import { DatabaseTransactionConnectionType } from 'slonik';

import { Member } from '../../src/services/members/interfaces/member';
import { Item } from '../../src/services/items/interfaces/item';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { GetOwnItemsTask } from '../../src/services/items/tasks/get-own-items-task';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('GetOwnItemsTask', () => {
  const fakeItems = [{ id: '1' }, { id: '2' }] as Item[];
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
    itemService.getOwn = jest.fn(async () => fakeItems);

    const task = new GetOwnItemsTask(member, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(task.result).toMatchObject(fakeItems);
  });
});
