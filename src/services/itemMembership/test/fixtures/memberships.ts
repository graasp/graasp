import { Member } from '../../../member/entities/member';
import { ItemMembership } from '../../entities/ItemMembership';

export const expectMembership = (
  newMembership:
    | undefined
    | (Pick<ItemMembership, 'permission' | 'item' | 'member'> & { creator?: Member | null }),
  correctMembership: undefined | Pick<ItemMembership, 'permission' | 'item' | 'member' | 'creator'>,
  creator?: Member,
) => {
  if (!newMembership || !correctMembership) {
    throw new Error(
      'expectMembership.newMembership or expectMembership.correctMembership is undefined',
    );
  }
  expect(newMembership.permission).toEqual(correctMembership.permission);
  expect(newMembership.item.id).toContain(correctMembership.item.id);
  if (newMembership.creator && creator) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(newMembership.creator.id).toEqual(correctMembership!.creator!.id);
  }

  expect(newMembership.member.id).toEqual(correctMembership.member.id);
};
