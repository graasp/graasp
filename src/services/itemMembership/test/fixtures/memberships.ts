import { ItemMembership } from '../../entities/ItemMembership';

export const expectMembership = (
  newMembership:
    | undefined
    | (Pick<ItemMembership, 'permission' | 'item' | 'account'> & {
        creator?: ItemMembership['creator'];
      }),
  correctMembership:
    | undefined
    | Pick<ItemMembership, 'permission' | 'item' | 'account' | 'creator'>,
  creator?: ItemMembership['creator'],
) => {
  if (!newMembership || !correctMembership) {
    throw new Error(
      'expectMembership.newMembership or expectMembership.correctMembership is undefined',
    );
  }
  expect(newMembership.permission).toEqual(correctMembership.permission);
  expect(newMembership.item.id).toContain(correctMembership.item.id);
  expect(newMembership.account.type).toBeDefined();
  if (newMembership.creator && creator) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(newMembership.creator.id).toEqual(correctMembership!.creator!.id);
  }

  expect(newMembership.account.id).toEqual(correctMembership.account.id);
};
