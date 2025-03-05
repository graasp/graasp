import { faker } from '@faker-js/faker';
import { BaseEntity } from 'typeorm';
import { v4 } from 'uuid';

import { CompleteMember, ItemType, PermissionLevel, buildPathFromIds } from '@graasp/sdk';

import { Item, ItemWithCreator, MemberRaw } from '../../src/drizzle/types';
import { encryptPassword } from '../../src/services/auth/plugins/password/utils';
import { ItemMembership } from '../../src/services/itemMembership/entities/ItemMembership';
import { MemberProfile } from '../../src/services/member/plugins/profile/entities/profile';
import { MaybeUser } from '../../src/types';
import { ItemFactory } from '../factories/item.factory';
import { MemberFactory } from '../factories/member.factory';
import { seed } from './seed.drizzle';

export type TableType<C extends BaseEntity, E> = {
  constructor: new () => C;
} & (
  | {
      factory: (e: Partial<E>) => E;
      entities: Partial<E>[];
    }
  | {
      factory?: never;
      entities: E[];
    }
);

type SeedActor =
  | 'actor'
  | (Partial<CompleteMember> & {
      profile?: Partial<MemberProfile>;
      password?: string;
    });
type DataType = {
  actor?: SeedActor | null;
  members?: (Partial<MemberRaw> & { profile?: Partial<MemberProfile> })[];
  items?: ((Partial<ItemWithCreator> | { creator: SeedActor }) & {
    children?: (Partial<ItemWithCreator> | { creator: SeedActor })[];
    memberships?: (
      | Partial<ItemMembership>
      | {
          account?: SeedActor;
          creator?: SeedActor;
          permission?: PermissionLevel;
        }
    )[];
  })[];
};

const replaceActorInItems = (createdActor?: MaybeUser, items?: DataType['items']) => {
  if (!items?.length) {
    return [];
  }

  return items.map((i) => ({
    ...i,
    creator: i.creator === 'actor' ? createdActor : (i.creator ?? null),
    memberships: i.memberships?.map((m) => ({
      ...m,
      account: m.account === 'actor' ? createdActor : m.account,
      creator: m.creator === 'actor' ? createdActor : m.creator,
    })),
    children: replaceActorInItems(createdActor, i.children),
  }));
};

/**
 * Generate actor given properties or a random actor. Replace the created actor in the data for further reference.
 * @param seed that contains the actor properties
 * @returns seed with references to the created actor
 */
const processActor = async ({ actor, items, members }: DataType) => {
  // create actor if not null
  let createdActor;
  let actorProfile;
  if (actor !== null) {
    // replace actor data with default values if actor is undefined or 'actor'
    const actorData = typeof actor === 'string' || !actor ? {} : actor;
    createdActor = (
      await seed({
        accountsTable: {
          factory: MemberFactory,
          entities: [actorData],
        },
      })
    ).accountsTable[0];

    // a profile is defined
    if (actor && actor !== 'actor') {
      if (actor.profile) {
        actorProfile = (
          await seed({
            actorProfile: {
              constructor: MemberProfile,
              entities: [{ ...actor.profile, member: { id: createdActor.id } }],
            },
          })
        ).actorProfile[0];
      }
      if (actor.password) {
        await seed({
          actorPassword: {
            constructor: MemberPasswordRaw,
            entities: [
              {
                password: await encryptPassword(actor.password),
                member: { id: createdActor.id },
              },
            ],
          },
        });
      }
    }
  }

  // replace 'actor' in entities
  const processedItems = replaceActorInItems(createdActor, items);

  return { actor: createdActor, items: processedItems, members, actorProfile };
};

/**
 * Generate id and path for all items in the tree (item and its children) and return a flat array
 * This is necessary to defined these as soon as possible so they can be used later by nested properties
 * @param items items' data, that might contain membesrhips
 * @param parent id/path of the item in which items should be created in
 * @returns flat array of all items
 */
const generateIdAndPathForItems = (
  items: DataType['items'],
  parent?: { id: string; path: string },
) => {
  if (!items?.length) {
    return [];
  }

  return items.flatMap((i) => {
    const id = v4();
    const path = buildPathFromIds(...([parent?.id, id].filter(Boolean) as string[]));
    const { children, ...allprops } = i;

    const fullParent = {
      id,
      path,
      ...allprops,
    };
    return [fullParent, ...generateIdAndPathForItems(children, fullParent)];
  });
};

/**
 * Return complete item memberships to be saved
 * Default to permission Admin
 * @param items from which we get the memberships
 * @returns flat map of all memberships of the tree
 */
const processItemMemberships = (items: DataType['items'] = []) => {
  return items
    ?.flatMap((i) => i.memberships?.map((im) => ({ ...im, item: i })) ?? [])
    ?.map((im) => ({
      permission: PermissionLevel.Admin,
      ...im,
    }));
};

/**
 * Generate ids for members, necessary to further references (for example when creating profiles)
 * @param members
 * @returns members' data with generated id
 */
function generateIdForMembers(members?: DataType['members']) {
  return members?.map((m) => {
    const id = v4();
    return { id, ...m, profile: { ...m.profile, member: { id } } };
  });
}

/**
 * Given seed object, save them in the database for initialization of a test
 * @param data
 * - actor: if not null, will create an actor with defined values, or a random actor if null
 * - items: if memberships is not defined, set default permission to admin. Can specify 'actor' in member. Nested properties can be defined, such as children and memberships.
 * - members: member and their profiles
 * @returns all created instances given input
 */
export async function seedFromJson(data: DataType = {}) {
  const result: {
    actor: MaybeUser | undefined;
    items: Item[];
    itemMemberships: ItemMembership[];
    members: MemberRaw[];
    memberProfiles: MemberProfile[];
  } = {
    items: [],
    actor: undefined,
    itemMemberships: [],
    members: [],
    memberProfiles: [],
  };

  const { items, actor, members, actorProfile } = await processActor(data);
  result.actor = actor;
  result.memberProfiles = actorProfile ? [actorProfile] : [];

  // save members
  const membersEntities = generateIdForMembers(members);
  if (membersEntities) {
    const membersAndProfiles = await seed({
      members: {
        factory: MemberFactory,
        constructor: MemberRaw, // FIX: update to use own factory
        entities: membersEntities,
      },
      memberProfiles: {
        constructor: MemberProfile,
        entities: membersEntities.map((m) => m.profile).filter(Boolean),
      },
    });
    result.members = membersAndProfiles.members as MemberRaw[];
    result.memberProfiles = membersAndProfiles.memberProfiles as MemberProfile[];
  }

  // save items
  const processedItems = generateIdAndPathForItems(items);
  if (processedItems) {
    result.items = (
      await seed({
        items: {
          factory: ItemFactory,
          constructor: ItemFactory,
          entities: processedItems,
        },
      })
    ).items as Item[];
  }

  // save item memberships
  const itemMembershipsEntity = processItemMemberships(processedItems);
  if (itemMembershipsEntity) {
    result.itemMemberships = (
      await seed({
        itemMemberships: {
          constructor: ItemMembership,
          entities: itemMembershipsEntity,
        },
      })
    ).itemMemberships as ItemMembership[];
  }

  return result;
}

/**
 * Generate a file item data structure
 * @param member creator of the file
 * @returns file item structure
 */
export function buildFile(member: SeedActor) {
  return {
    type: ItemType.S3_FILE,
    extra: {
      [ItemType.S3_FILE]: {
        size: faker.number.int({ min: 1, max: 1000 }),
        content: 'content',
        mimetype: 'image/png',
        name: faker.system.fileName(),
        path: faker.system.filePath(),
      },
    },
    creator: member,
    memberships: [{ account: member }],
  };
}
