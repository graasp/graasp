import { faker } from '@faker-js/faker';
import { BaseEntity, DataSource } from 'typeorm';
import { v4 } from 'uuid';

import { ItemType, PermissionLevel, buildPathFromIds, getIdsFromPath } from '@graasp/sdk';

import { AppDataSource } from '../../src/plugins/datasource';
import { Account } from '../../src/services/account/entities/account';
import { MemberPassword } from '../../src/services/auth/plugins/password/entities/password';
import { encryptPassword } from '../../src/services/auth/plugins/password/utils';
import { Item } from '../../src/services/item/entities/Item';
import { ItemMembership } from '../../src/services/itemMembership/entities/ItemMembership';
import { Actor, Member } from '../../src/services/member/entities/member';
import { MemberProfile } from '../../src/services/member/plugins/profile/entities/profile';
import { ItemFactory } from '../factories/item.factory';
import { MemberFactory } from '../factories/member.factory';
import defaultDatas from './sampledatas';

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

/**
 * Push datas in Database with TypeOrm.
 * Use the constructors and the datas given in parameter to build BaseEntity object and save them on the Postgresql Database.
 * Integrity constraints are checked on the database, and will throw an exception if needed.
 * @param datas Datas to be pushed. Should contains constructor to build BaseEntity objects and sometimes Factory function to have default data.
 * @returns saved instances
 */
export default async function seed(
  datas: { [K in string]: TableType<BaseEntity, object> } = defaultDatas,
) {
  // Initialise Database
  const db: DataSource = AppDataSource;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  const result: { [K in keyof typeof datas]: BaseEntity[] } = {};
  // Begin transation.
  await db.transaction(async (manager) => {
    for (const key in datas) {
      const table = datas[key];
      const entities: BaseEntity[] = [];
      for (const mockEntity of table.entities) {
        const entity: BaseEntity = new table.constructor();
        Object.assign(entity, table.factory ? table.factory(mockEntity) : mockEntity);
        const e = await manager.save(entity);
        entities.push(e);
      }
      result[key] = entities;
    }
  });
  return result;
}

const ACTOR_STRING = 'actor';
type SeedActor = Partial<Member> & { profile?: Partial<MemberProfile>; password?: string };
type ReferencedSeedActor = 'actor' | SeedActor;
type SeedMember = Partial<Member> & { profile?: Partial<MemberProfile> };
type SeedMembership<M = SeedMember> = Partial<Omit<ItemMembership, 'creator' | 'account'>> & {
  account?: M;
  creator?: M;
  permission?: PermissionLevel;
};
type SeedItem<M = SeedMember> = (Partial<Omit<Item, 'creator'>> & { creator?: M | null }) & {
  children?: SeedItem<M>[];
  memberships?: SeedMembership<M>[];
};
type DataType = {
  actor?: SeedActor | null;
  members?: SeedMember[];
  items?: SeedItem<ReferencedSeedActor | SeedMember>[];
};

const replaceActorInItems = (createdActor?: Member, items?: DataType['items']): SeedItem[] => {
  if (!items?.length) {
    return [];
  }

  return items.map((i) => ({
    ...i,
    creator: i.creator === ACTOR_STRING ? createdActor : (i.creator ?? null),
    memberships: i.memberships?.map((m) => ({
      ...m,
      account: m.account === ACTOR_STRING ? createdActor : m.account,
      creator: m.creator === ACTOR_STRING ? createdActor : m.creator,
    })),
    children: replaceActorInItems(createdActor, i.children),
  }));
};

function getNameIfExists(i?: object | null | string) {
  if (i && typeof i == 'object' && 'name' in i) {
    return i.name;
  }
  return null;
}

function replaceAccountInItems(createdAccount: Account, items?: DataType['items']) {
  if (!items?.length) {
    return [];
  }

  return items.map((i) => {
    const memberships = i.memberships?.map((m) => {
      return {
        ...m,
        account: getNameIfExists(m.account) === createdAccount.name ? createdAccount : m.account,
        creator: getNameIfExists(m.creator) === createdAccount.name ? createdAccount : m.creator,
      };
    });

    return {
      ...i,
      creator:
        getNameIfExists(i.creator) === createdAccount.name ? createdAccount : (i.creator ?? null),
      memberships,
      children: replaceAccountInItems(createdAccount, i.children),
    };
  });
}

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
    const actorData = !actor ? {} : actor;
    createdActor = (
      await seed({
        actor: {
          factory: MemberFactory,
          constructor: Member,
          entities: [actorData],
        },
      })
    ).actor[0];

    // a profile is defined
    if (actor) {
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
            constructor: MemberPassword,
            entities: [
              { password: await encryptPassword(actor.password), member: { id: createdActor.id } },
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
    const ids = parent ? [...getIdsFromPath(parent.path), id] : [id];
    const path = buildPathFromIds(...ids);
    const { children, ...allprops } = i;

    const currentFullItem = {
      id,
      path,
      ...allprops,
    };
    return [currentFullItem, ...generateIdAndPathForItems(children, currentFullItem)];
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
 * Only unique accounts will be created based on their name
 * @param members standalone members to be created
 * @param items items whose creator and memberships' accounts should be created.
 * @returns members' data with generated id
 */
function generateIdForMembers({
  members = [],
  items = [],
}: {
  items?: SeedItem[];
  members?: SeedMember[];
}) {
  // get all unique members
  const allMembers = [
    ...members,
    ...items.flatMap((i) => {
      // get all account from all memberships
      const accountsFromMemberships = (i.memberships ?? [])?.reduce((acc, m) => {
        if (!m.account) {
          return acc;
        }
        return [...acc, m.account];
      }, []);
      // get creator of membership
      return i.creator ? accountsFromMemberships.concat([i.creator]) : accountsFromMemberships;
    }),
  ].filter((m, index, array) => {
    // return unique member by name
    if (m && 'name' in m) {
      return array.findIndex((a) => a && 'name' in a && a?.name === m.name) === index;
    }
    // member should be created
    if (m) {
      return true;
    }
    return false;
  });

  const d = allMembers.map((m) => {
    const id = v4();
    return {
      id,
      ...m,
      profile: 'profile' in m ? { ...m.profile, member: { id } } : undefined,
    };
  });
  return d;
}

/**
 * Given data, save needed and unique members and their related entities (eg. profile)
 * @param members standalone members to be created
 * @param items items whose creator and memberships' accounts should be created
 * @returns members, memberProfiles and items filled with related account's data
 */
async function processMembers({
  actor,
  items = [],
  members = [],
}: {
  actor?: Actor;
  items?: SeedItem[];
  members?: SeedMember[];
}) {
  const membersWithIds = generateIdForMembers({ items, members })
    // ignore actor if it is defined
    .filter((m) => (actor ? m.id !== actor.id : true));

  if (membersWithIds) {
    const { memberProfiles, savedMembers } = await seed({
      savedMembers: {
        factory: MemberFactory,
        constructor: Member,
        entities: membersWithIds,
      },
      memberProfiles: {
        constructor: MemberProfile,
        entities: membersWithIds.map((m) => m.profile).filter(Boolean) as Partial<MemberProfile>[],
      },
    });
    const processedItems = (savedMembers as Member[]).reduce(
      (acc, m) => replaceAccountInItems(m, acc),
      items,
    );
    return {
      members: savedMembers as Member[],
      memberProfiles: memberProfiles as MemberProfile[],
      items: processedItems,
    };
  }
  return { members: [], memberProfiles: [], items: [] };
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
    actor: Actor | undefined;
    items: Item[];
    itemMemberships: ItemMembership[];
    members: Member[];
    memberProfiles: MemberProfile[];
  } = {
    items: [],
    actor: undefined,
    itemMemberships: [],
    members: [],
    memberProfiles: [],
  };

  const { items: itemsWithActor, actor, members, actorProfile } = await processActor(data);
  result.actor = actor;
  result.memberProfiles = actorProfile ? [actorProfile] : [];

  // save members and their relations
  const {
    members: membersWithIds,
    memberProfiles,
    items: itemsWithAccounts,
  } = await processMembers({
    items: itemsWithActor,
    members,
    actor,
  });
  result.members = membersWithIds;
  result.memberProfiles = result.memberProfiles.concat(memberProfiles);

  // save items
  const processedItems = generateIdAndPathForItems(itemsWithAccounts);
  if (processedItems) {
    result.items = (
      await seed({
        items: {
          factory: ItemFactory,
          constructor: Item,
          entities: processedItems,
        },
      })
    ).items as Item[];
  }

  // save item memberships
  const itemMembershipsEntities = processItemMemberships(processedItems);
  if (itemMembershipsEntities) {
    result.itemMemberships = (
      await seed({
        itemMemberships: {
          constructor: ItemMembership,
          entities: itemMembershipsEntities,
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
