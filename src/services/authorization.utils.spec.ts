import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ItemVisibilityType, PackedFolderItemFactory } from '@graasp/sdk';

import { ItemFactory } from '../../test/factories/item.factory';
import { MemberFactory } from '../../test/factories/member.factory';
import type { DBConnection } from '../drizzle/db';
import type { ItemRaw, ItemVisibilityRaw, ItemVisibilityWithItem } from '../drizzle/types';
import { AccountType, MinimalMember, PermissionLevel } from '../types';
import { filterOutPackedDescendants } from './authorization.utils';
import type { PackedItem } from './item/ItemWrapper';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import { expectItem } from './item/test/fixtures/items.vitest';
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
  itemPath: descendants[2].path,
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
  arr[idx].hidden = hiddenVisibility;
  return arr as unknown as PackedItem[];
};

const expectPackedItem = (
  newItem: Partial<PackedItem> | undefined | null,
  correctItem:
    | (Partial<Omit<PackedItem, 'createdAt' | 'updatedAt' | 'creator'>> &
        Pick<PackedItem, 'permission'>)
    | undefined
    | null,
  creator?: MinimalMember,
  parent?: ItemRaw,
  visibilities?: Pick<ItemVisibilityRaw, 'id' | 'type' | 'itemPath'>[],
) => {
  expectItem(newItem, correctItem, creator, parent);

  expect(newItem!.permission).toEqual(correctItem?.permission);

  const pVisibility = visibilities?.find((t) => t.type === ItemVisibilityType.Public);
  if (pVisibility) {
    expect(newItem!.public!.type).toEqual(pVisibility.type);
    expect(newItem!.public!.id).toEqual(pVisibility.id);
    expect(newItem!.public!.itemPath).toEqual(pVisibility.itemPath);
  }
  const hVisibility = visibilities?.find((t) => t.type === ItemVisibilityType.Hidden);
  if (hVisibility) {
    expect(newItem!.hidden!.type).toEqual(hVisibility.type);
    expect(newItem!.hidden!.id).toEqual(hVisibility.id);
    expect(newItem!.hidden!.itemPath).toEqual(hVisibility.itemPath);
  }
};

describe('filterOutPackedDescendants', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Admin returns all', async () => {
    // one parent membership
    const memberships = [{ item, member: OWNER, permission: 'admin' as const }];
    // packed descendants for expect
    // one item is hidden but this item should be returned
    const packedDescendants = buildPackedDescendants(memberships[0].permission, hiddenVisibility);

    const repositories = {
      itemMembershipRepository: {
        getAllBelow: vi.fn(async () => memberships),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository: {
        getManyBelowAndSelf: vi.fn(async () => [hiddenVisibility]),
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
    const memberships = [{ item, member: OWNER, permission: 'write' as const }];
    // packed descendants for expect
    // one item is hidden but this item should be returned
    const packedDescendants = buildPackedDescendants(memberships[0].permission, hiddenVisibility);

    const repositories = {
      itemMembershipRepository: {
        getAllBelow: vi.fn(async () => memberships),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository: {
        getManyBelowAndSelf: vi.fn(async () => [hiddenVisibility]),
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
    const memberships = [{ item, member: OWNER, permission: 'read' as const }];
    // packed descendants for expect
    // one item is hidden, this item should not be returned!
    const packedDescendants = buildPackedDescendants(memberships[0].permission, hiddenVisibility);

    const repositories = {
      itemMembershipRepository: {
        getAllBelow: vi.fn(async () => memberships),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository: {
        getManyBelowAndSelf: vi.fn(async () => [hiddenVisibility]),
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
        getAllBelow: vi.fn(async () => []),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository: {
        getManyBelowAndSelf: vi.fn(async () => [hiddenVisibility]),
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
