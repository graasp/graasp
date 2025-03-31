import { v4 } from 'uuid';

import { ItemVisibilityType, PackedFolderItemFactory, PermissionLevel } from '@graasp/sdk';

import { ItemFactory } from '../../test/factories/item.factory';
import { MemberFactory } from '../../test/factories/member.factory';
import { DBConnection } from '../drizzle/db';
import { ItemVisibilityWithItem } from '../drizzle/types';
import { AccountType } from '../types';
import { filterOutPackedDescendants } from './authorization.utils';
import { PackedItem } from './item/ItemWrapper';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import { expectPackedItem } from './item/test/fixtures/items';
import { ItemMembershipRepository } from './itemMembership/membership.repository';

const OWNER = { id: 'owner', name: 'owner', type: AccountType.Individual, isValidated: true };

const MOCK_DB = {} as unknown as DBConnection;

const item = ItemFactory({});

// raw descendants to pass to function
const descendants = [
  { ...ItemFactory({ parentPath: item.path }), creator: MemberFactory() },
  { ...ItemFactory({ parentPath: item.path }), creator: MemberFactory() },
  { ...ItemFactory({ parentPath: item.path }), creator: MemberFactory() },
  { ...ItemFactory({ parentPath: item.path }), creator: MemberFactory() },
  { ...ItemFactory({ parentPath: item.path }), creator: MemberFactory() },
];
const hiddenVisibility = {
  id: v4(),
  createdAt: new Date().toISOString(),
  creatorId: null,
  type: ItemVisibilityType.Hidden,
  item: descendants[2],
} as ItemVisibilityWithItem;

/** build packed descendants for checking returned values
 * types don't play nicely because factory does not use the same types as the backend
 */
const buildPackedDescendants = (
  permission: PermissionLevel | null,
  hiddenVisibility: ItemVisibilityWithItem,
): PackedItem[] => {
  const arr = descendants.map((descendant) =>
    PackedFolderItemFactory(descendant as never, {
      permission,
    }),
  );
  const idx = arr.findIndex(({ id }) => id === hiddenVisibility.item.id);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  arr[idx].hidden = hiddenVisibility;
  return arr as unknown as PackedItem[];
};

describe('filterOutPackedDescendants', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Admin returns all', async () => {
    // one parent membership
    const memberships = [{ item, member: OWNER, permission: PermissionLevel.Admin }];
    // packed descendants for expect
    // one item is hidden but this item should be returned
    const packedDescendants = buildPackedDescendants(memberships[0].permission, hiddenVisibility);

    const repositories = {
      itemMembershipRepository: {
        getAllBelow: jest.fn(async () => memberships),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository: {
        getManyBelowAndSelf: jest.fn(async () => [hiddenVisibility]),
      } as unknown as ItemVisibilityRepository,
    };

    const result = await filterOutPackedDescendants(
      MOCK_DB,
      OWNER,
      repositories,
      item,
      descendants,
    );

    expect(result).toHaveLength(descendants.length);
    for (let i = 0; i < result.length; i += 1) {
      expectPackedItem(result[i], packedDescendants[i]);
    }
  });

  it('Writer returns all', async () => {
    // one parent membership
    const memberships = [{ item, member: OWNER, permission: PermissionLevel.Write }];
    // packed descendants for expect
    // one item is hidden but this item should be returned
    const packedDescendants = buildPackedDescendants(memberships[0].permission, hiddenVisibility);

    const repositories = {
      itemMembershipRepository: {
        getAllBelow: jest.fn(async () => memberships),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository: {
        getManyBelowAndSelf: jest.fn(async () => [hiddenVisibility]),
      } as unknown as ItemVisibilityRepository,
    };

    const result = await filterOutPackedDescendants(
      MOCK_DB,
      OWNER,
      repositories,
      item,
      descendants,
    );

    expect(descendants).toHaveLength(result.length);
    for (let i = 0; i < result.length; i += 1) {
      expectPackedItem(packedDescendants[i], result[i]);
    }
  });

  it('Reader does not return hidden', async () => {
    // one parent membership
    const memberships = [{ item, member: OWNER, permission: PermissionLevel.Read }];
    // packed descendants for expect
    // one item is hidden, this item should not be returned!
    const packedDescendants = buildPackedDescendants(memberships[0].permission, hiddenVisibility);

    const repositories = {
      itemMembershipRepository: {
        getAllBelow: jest.fn(async () => memberships),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository: {
        getManyBelowAndSelf: jest.fn(async () => [hiddenVisibility]),
      } as unknown as ItemVisibilityRepository,
    };

    const result = await filterOutPackedDescendants(
      MOCK_DB,
      OWNER,
      repositories,
      item,
      descendants,
    );

    expect(result).toHaveLength(descendants.length - 1);
    result.forEach((r) => {
      const d = packedDescendants.find((i) => i.id === r.id);
      expectPackedItem(d, r);
    });
  });

  it('No membership does not return hidden', async () => {
    // packed descendants for expect
    // one item is hidden, this item should not be returned!
    const packedDescendants = buildPackedDescendants(null, hiddenVisibility);

    const repositories = {
      itemMembershipRepository: {
        getAllBelow: jest.fn(async () => []),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository: {
        getManyBelowAndSelf: jest.fn(async () => [hiddenVisibility]),
      } as unknown as ItemVisibilityRepository,
    };

    const result = await filterOutPackedDescendants(
      MOCK_DB,
      OWNER,
      repositories,
      item,
      descendants,
    );

    expect(result).toHaveLength(descendants.length - 1);
    result.forEach((r) => {
      const d = packedDescendants.find((i) => i.id === r.id);
      expectPackedItem(d, r);
    });
  });
});
