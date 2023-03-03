import { PermissionLevel } from '@graasp/sdk';

import { Item } from '../../src/services/item/entities/Item';
import { ItemMembershipRepository } from '../../src/services/itemMembership/repository';
import { Member } from '../../src/services/member/entities/member';
import { getDummyItem, saveItem } from './items';

export const saveMembership = ({ item, member, permission = PermissionLevel.Admin }) => {
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

export const expectMembership = (newMembership, correctMembership, creator?: Member) => {
  expect(newMembership.permission).toEqual(correctMembership.permission);
  expect(newMembership.item.id).toContain(correctMembership.item.id);
  if (newMembership.creator && creator) {
    expect(newMembership.creator.id).toEqual(correctMembership.creator.id);
  }

  expect(newMembership.member.id).toEqual(correctMembership.member.id);
};
