import {
  ItemMembershipRaw,
  ItemMembershipWithItemAndAccountAndCreator,
} from '../../../../drizzle/types';

export const expectMembership = (
  newMembership:
    | Pick<
        ItemMembershipWithItemAndAccountAndCreator,
        'creator' | 'account' | 'item' | 'permission'
      >
    | undefined,
  correctMembership: Omit<ItemMembershipRaw, 'id' | 'createdAt' | 'updatedAt'> | undefined,
) => {
  if (!newMembership || !correctMembership) {
    throw new Error(
      'expectMembership.newMembership or expectMembership.correctMembership is undefined',
    );
  }
  expect(newMembership.permission).toEqual(correctMembership.permission);
  expect(newMembership.item.path).toContain(correctMembership.itemPath);
  if (newMembership.creator) {
    expect(newMembership.creator.id).toEqual(correctMembership.creatorId);
  }
  expect(newMembership.account.type).toBeDefined();
  expect(newMembership.account.id).toEqual(correctMembership.accountId);
};

export const expectMembershipRaw = (
  newMembership: ItemMembershipRaw | undefined,
  correctMembership: ItemMembershipRaw | undefined,
) => {
  if (!newMembership || !correctMembership) {
    throw new Error(
      'expectMembership.newMembership or expectMembership.correctMembership is undefined',
    );
  }
  expect(newMembership.permission).toEqual(correctMembership.permission);
  expect(newMembership.itemPath).toContain(correctMembership.itemPath);
  // expect(newMembership.account.type).toBeDefined();
  expect(newMembership.creatorId).toEqual(correctMembership.creatorId);

  expect(newMembership.accountId).toEqual(correctMembership.accountId);
};
