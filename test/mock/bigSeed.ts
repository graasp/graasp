import { BaseEntity } from 'typeorm';
import { v4 } from 'uuid';

import { FolderItemFactory, MemberFactory, PermissionLevel, buildPathFromIds } from '@graasp/sdk';

import seed, { TableType } from '.';
import { Item } from '../../src/services/item/entities/Item';
import { ItemMembership } from '../../src/services/itemMembership/entities/ItemMembership';
import { Member } from '../../src/services/member/entities/member';

export default async function bigSeed() {
  const memberIds = Array.from({ length: 3000 }, () => ({ id: v4() }));
  const items = memberIds.map((m) => {
    const id = v4();
    return { id, path: buildPathFromIds(id), creator: m.id };
  });
  const itemMemberships = items.map((i) => ({
    id: v4(),
    permission: PermissionLevel.Admin,
    creator: i.creator,
    member: i.creator,
    item: i.path,
  }));

  const data: { [K in string]: TableType<BaseEntity, object> } = {
    members: {
      constructor: Member,
      factory: MemberFactory,
      entities: memberIds,
    },
    items: {
      constructor: Item,
      factory: FolderItemFactory,
      entities: items,
    },
    itemMemberships: {
      constructor: ItemMembership,
      entities: itemMemberships,
    },
  };

  await seed(data);
}
