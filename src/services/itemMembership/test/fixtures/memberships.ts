import { PermissionLevel } from '@graasp/sdk';

import { Item } from '../../../item/entities/Item';
import { getDummyItem, saveItem } from '../../../item/test/fixtures/items';
import { Member } from '../../../member/entities/member';
import { ItemMembership } from '../../entities/ItemMembership';
import { ItemMembershipRepository } from '../../repository';

export const saveMembership = ({
  item,
  member,
  permission = PermissionLevel.Admin,
}: {
  item: Item;
  member: Member;
  permission?: PermissionLevel;
}) => {
  return ItemMembershipRepository.save({ item, member, permission });
};

export const saveItemAndMembership = async (options: {
  member: Member;
  item?: Partial<Item>;
  permission?: PermissionLevel;
  creator?: Member;
  parentItem?: Item;
}) => {
  const { item = getDummyItem(), member, permission, creator, parentItem } = options;
  const newItem = await saveItem({ item, actor: creator ?? member, parentItem });
  const im = await saveMembership({ item: newItem, member, permission });
  return { item: newItem, itemMembership: im };
};

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
    expect(newMembership.creator.id).toEqual(correctMembership!.creator!.id);
  }

  expect(newMembership.member.id).toEqual(correctMembership.member.id);
};
