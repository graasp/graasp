import { DatabaseTransactionConnectionType } from 'slonik';

import { Member } from '../../src/services/members/interfaces/member';
import { ItemService } from '../../src/services/items/db-service';
import { ItemMembershipService } from '../../src/services/item-memberships/db-service';
import { GetItemsSharedWithTask } from '../../src/services/items/tasks/get-items-shared-with-task';
import { getDummyItem } from './utils';

jest.mock('../../src/services/items/db-service');
jest.mock('../../src/services/item-memberships/db-service');

const member = {} as Member;

describe('GetItemsSharedWithTask', () => {
  const itemService = new ItemService();
  const itemMembershipService = new ItemMembershipService();
  const dbHandler = {} as DatabaseTransactionConnectionType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`Task's \`name\` property should contain the classname: ${GetItemsSharedWithTask.name}`, () => {
    const task = new GetItemsSharedWithTask(member, itemService, itemMembershipService);
    expect(task.name).toBe(GetItemsSharedWithTask.name);
  });

  test('Should return items "shared with" `member`', async () => {
    const items = [...Array(3).keys()].map(() => getDummyItem());
    itemService.getSharedWith = jest.fn(async () => items);

    const task = new GetItemsSharedWithTask(member, itemService, itemMembershipService);
    await task.run(dbHandler);

    expect(task.result).toMatchObject(items);
  });
});
