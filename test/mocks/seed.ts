import { faker } from '@faker-js/faker';
import { v4 } from 'uuid';

import {
  AppDataVisibility,
  ItemLoginSchemaStatus,
  ItemLoginSchemaType,
  ItemType,
  ItemVisibilityOptionsType,
  ItemVisibilityType,
  PermissionLevel,
  buildPathFromIds,
  getIdsFromPath,
} from '@graasp/sdk';

import { db } from '../../src/drizzle/db';
import {
  accountsTable,
  appActions,
  appDatas,
  appSettings,
  apps,
  guestPasswords,
  invitationsTable,
  itemGeolocationsTable,
  itemLoginSchemas,
  itemMemberships,
  itemTags as itemTagsTable,
  itemVisibilities,
  itemsRaw,
  memberPasswords,
  memberProfiles,
  publishers,
  recycledItemDatas,
  tags as tagsTable,
} from '../../src/drizzle/schema';
import {
  AccountRaw,
  AppActionRaw,
  AppDataRaw,
  AppRaw,
  AppSettingRaw,
  GuestRaw,
  InvitationRaw,
  ItemGeolocationInsertDTO,
  ItemGeolocationRaw,
  ItemLoginSchemaRaw,
  ItemMembershipRaw,
  ItemRaw,
  ItemTagRaw,
  ItemVisibilityRaw,
  MemberProfileRaw,
  MemberRaw,
  TagRaw,
} from '../../src/drizzle/types';
import { encryptPassword } from '../../src/services/auth/plugins/password/utils';
import { APPS_PUBLISHER_ID } from '../../src/utils/config';
import { ItemFactory } from '../factories/item.factory';
import { GuestFactory, MemberFactory } from '../factories/member.factory';

const ACTOR_STRING = 'actor';
export type SeedActor = Partial<AccountRaw> & {
  profile?: Partial<MemberProfileRaw>;
  password?: string;
};
type ReferencedSeedActor = 'actor' | SeedActor;
type SeedMember = Partial<MemberRaw> & { profile?: Partial<MemberProfileRaw> };
type SeedMembership<M = SeedMember> = Partial<Omit<ItemMembershipRaw, 'creator' | 'account'>> & {
  account: M;
  creator?: M | null;
  permission?: `${PermissionLevel}`;
};
type SeedItem<M = SeedMember> = (Partial<Omit<ItemRaw, 'creator'>> & { creator?: M | null }) & {
  children?: SeedItem<M>[];
  memberships?: SeedMembership<M>[];
  isPublic?: boolean;
  isHidden?: boolean;
  isDeleted?: boolean;
  geolocation?: Omit<ItemGeolocationInsertDTO, 'itemPath'>;
  tags?: Pick<TagRaw, 'name' | 'category'>[];
  itemLoginSchema?: Partial<ItemLoginSchemaRaw> & {
    guests?: (Partial<GuestRaw> & { password?: string })[];
  };
  appActions?: (Omit<Partial<AppActionRaw>, 'accountId'> & {
    account: M;
  })[];
  appSettings?: (Omit<Partial<AppSettingRaw>, 'creatorId'> & {
    creator: M;
  })[];
  appData?: (Omit<Partial<AppDataRaw>, 'accountId'> & {
    account: M;
    creator: M;
  })[];
  invitations?: Partial<InvitationRaw>[];
};
type DataType = {
  actor?: SeedActor | null;
  members?: SeedMember[];
  items?: SeedItem<ReferencedSeedActor | SeedMember>[];
  tags?: Pick<TagRaw, 'name' | 'category'>[];
  apps?: Partial<AppRaw>[];
};

const replaceActorInItems = (createdActor?: AccountRaw, items?: DataType['items']): SeedItem[] => {
  if (!items?.length) {
    return [];
  }

  return items.map((i) => ({
    ...i,
    creator: i.creator === ACTOR_STRING ? (createdActor as any) : (i.creator ?? null),
    memberships: i.memberships?.map((m) => ({
      ...m,
      account: m.account === ACTOR_STRING ? (createdActor as any) : m.account,
      creator: m.creator === ACTOR_STRING ? (createdActor as any) : (m.creator ?? null),
    })),
    appActions: i.appActions?.map((aa) => ({
      ...aa,
      account: aa.account === ACTOR_STRING ? (createdActor as any) : aa.account,
    })),
    appSettings: i.appSettings?.map((as) => ({
      ...as,
      creator: as.creator === ACTOR_STRING ? (createdActor as any) : as.creator,
    })),
    appData: i.appData?.map((ad) => ({
      ...ad,
      account: ad.account === ACTOR_STRING ? (createdActor as any) : ad.account,
      creator: ad.creator === ACTOR_STRING ? (createdActor as any) : ad.creator,
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

function replaceAccountInItems(createdAccount: AccountRaw, items?: DataType['items']) {
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
    const appActions = i.appActions?.map((a) => {
      return {
        ...a,
        account: getNameIfExists(a.account) === createdAccount.name ? createdAccount : a.account,
      };
    });
    const appData = i.appData?.map((a) => {
      return {
        ...a,
        account: getNameIfExists(a.account) === createdAccount.name ? createdAccount : a.account,
        creator: getNameIfExists(a.creator) === createdAccount.name ? createdAccount : a.creator,
      };
    });
    const appSettings = i.appSettings?.map((as) => {
      return {
        ...as,
        creator: getNameIfExists(as.creator) === createdAccount.name ? createdAccount : as.creator,
      };
    });

    return {
      ...i,
      creator:
        getNameIfExists(i.creator) === createdAccount.name ? createdAccount : (i.creator ?? null),
      memberships,
      children: replaceAccountInItems(createdAccount, i.children),
      appActions,
      appData,
      appSettings,
    };
  });
}

/**
 * Generate actor given properties or a random actor. Replace the created actor in the data for further reference.
 * @param seed that contains the actor properties
 * @returns seed with references to the created actor
 */
const processActor = async ({
  actor,
  items,
  members,
}: DataType): Promise<{
  actor: AccountRaw | null;
  members?: SeedMember[];
  actorProfile?: MemberProfileRaw;
  items: SeedItem<SeedMember>[];
}> => {
  // create actor if not null
  let createdActor: AccountRaw | null = null;
  let actorProfile;
  let processedItems;
  if (actor !== null) {
    // replace actor data with default values if actor is undefined or 'actor'
    const actorData: Partial<AccountRaw> = typeof actor === 'string' || !actor ? {} : actor;
    createdActor = (await db.insert(accountsTable).values(MemberFactory(actorData)).returning())[0];

    // a profile is defined
    if (actorData) {
      if (actor?.profile) {
        actorProfile = (
          await db
            .insert(memberProfiles)
            .values({ ...actor.profile, memberId: createdActor.id })
            .returning()
        )[0];
      }
      if (actor?.password) {
        await db.insert(memberPasswords).values({
          password: await encryptPassword(actor.password),
          memberId: createdActor.id,
        });
      }
    }
    // replace 'actor' in entities
    processedItems = replaceActorInItems(createdActor, items);
  } else {
    // pass through
    processedItems = items;
  }

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
  return (
    items
      // TODO: fix
      ?.flatMap((i) => i.memberships?.map((im) => ({ ...im, itemPath: i.path })) ?? [])
      ?.map((im) => ({
        permission: PermissionLevel.Admin,
        accountId: (im.account as any).id,
        ...im,
      })) as ItemMembershipRaw[]
  );
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
      // get all accounts from all memberships
      const accountsFromMemberships = (i.memberships ?? [])?.reduce<SeedMember[]>((acc, m) => {
        if (!m.account) {
          return acc;
        }
        return [...acc, m.account];
      }, []);

      // get all accounts from all app actions
      const accountsFromAppActions = (i.appActions ?? [])?.reduce<SeedMember[]>((acc, m) => {
        if (!m.account) {
          return acc;
        }
        return [...acc, m.account];
      }, []);

      // get all accounts from all app settings
      const creatorsFromAppSettings = (i.appSettings ?? [])?.reduce<SeedMember[]>((acc, m) => {
        if (!m.creator) {
          return acc;
        }
        return [...acc, m.creator];
      }, []);

      // get all accounts and creators from all app data
      const accountsFromAppData = (i.appData ?? [])?.reduce<SeedMember[]>((acc, m) => {
        return [...acc, m.account, m.creator].filter(Boolean);
      }, []);

      const allAccounts = [
        ...accountsFromMemberships,
        ...accountsFromAppActions,
        ...accountsFromAppData,
        ...creatorsFromAppSettings,
      ];

      // get creator of item
      if (i.creator) {
        allAccounts.push(i.creator);
      }

      return allAccounts;
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
      profile: 'profile' in m ? { ...m.profile, memberId: id } : undefined,
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
  actor?: AccountRaw | null;
  items?: SeedItem[];
  members?: SeedMember[];
}) {
  const membersWithIds = generateIdForMembers({ items, members })
    // ignore actor if it is defined
    .filter((m) => (actor ? m.id !== actor.id : true));
  if (membersWithIds.length) {
    const savedMembers = await db
      .insert(accountsTable)
      .values(membersWithIds.map((m) => MemberFactory(m)))
      .returning();
    const profiles = membersWithIds.map((m) => m.profile).filter(Boolean) as MemberProfileRaw[];
    const savedMemberProfiles = profiles.length
      ? await db.insert(memberProfiles).values(profiles).returning()
      : [];
    const processedItems = savedMembers.reduce((acc, m) => replaceAccountInItems(m, acc), items);
    return {
      members: savedMembers as MemberRaw[],
      memberProfiles: savedMemberProfiles,
      items: processedItems,
    };
  }
  return { members: [], memberProfiles: [], items };
}

async function createItemVisibilities(items: (SeedItem & { path: string })[]) {
  const visibilities = items.reduce<{ itemPath: string; type: ItemVisibilityOptionsType }[]>(
    (acc, { path, isHidden, isPublic }) => {
      if (isHidden) {
        acc.push({ itemPath: path, type: ItemVisibilityType.Hidden });
      }
      if (isPublic) {
        acc.push({ itemPath: path, type: ItemVisibilityType.Public });
      }
      return acc;
    },
    [],
  );

  if (visibilities.length) {
    return await db.insert(itemVisibilities).values(visibilities).returning();
  }

  return [];
}

/**
 * Create item login schema, related guests, their passwords and memberships given items definition
 * @param items.itemLoginSchema defined by status, type, as well as guests and their passwords
 * @returns item login schema, guests, and related item memberships
 */
async function createItemLoginSchemasAndGuests(items: (SeedItem & { path: string })[]) {
  // generate item login schema objects, with id so it can be references for guests later
  const itemLoginSchemasData = items.reduce<
    {
      id: string;
      itemPath: string;
      status: ItemLoginSchemaRaw['status'];
      type: ItemLoginSchemaRaw['type'];
      guests?: (Partial<GuestRaw> & { password?: string })[];
    }[]
  >((acc, { path, itemLoginSchema }) => {
    if (itemLoginSchema) {
      acc.push({
        itemPath: path,
        id: v4(),
        type: ItemLoginSchemaType.Username,
        status: ItemLoginSchemaStatus.Active,
        ...itemLoginSchema,
      });
    }
    return acc;
  }, []);
  let itemLoginSchemasValues: ItemLoginSchemaRaw[] = [];
  if (itemLoginSchemasData.length) {
    itemLoginSchemasValues = await db
      .insert(itemLoginSchemas)
      .values(itemLoginSchemasData)
      .returning();
  }

  // save pre-registered guests
  // feed item login schema in guests' data
  // keep track of password and item for later use
  const guestsData = itemLoginSchemasData.reduce<
    (ReturnType<typeof GuestFactory> & { password?: string; itemPath: string })[]
  >((acc, { id, guests, itemPath }) => {
    if (guests) {
      return acc.concat(
        guests.map(({ password, ...g }) => ({
          ...GuestFactory({ ...g, itemLoginSchemaId: id }),
          password,
          itemPath,
        })),
      );
    }
    return acc;
  }, []);
  let guests: GuestRaw[] = [];
  let memberships: ItemMembershipRaw[] = [];
  if (guestsData.length) {
    guests = (await db.insert(accountsTable).values(guestsData).returning()) as GuestRaw[];

    // save guest passwords
    const guestPasswordsValues: { guestId: string; password: string }[] = [];
    for (const { id, password } of guestsData) {
      if (password) {
        guestPasswordsValues.push({ guestId: id, password: await encryptPassword(password) });
      }
    }
    if (guestPasswordsValues.length) {
      await db.insert(guestPasswords).values(guestPasswordsValues);
    }

    // save guest memberships
    const guestMemberships = guestsData.reduce<
      {
        accountId: string;
        permission: PermissionLevel;
        itemPath: string;
      }[]
    >((acc, { id, itemPath: path }) => {
      return acc.concat([
        {
          accountId: id,
          permission: PermissionLevel.Read,
          itemPath: path,
        },
      ]);
    }, []);
    memberships = await db.insert(itemMemberships).values(guestMemberships).returning();
  }

  return {
    itemLoginSchemas: itemLoginSchemasValues,
    guests,
    itemMemberships: memberships,
  };
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
    actor: AccountRaw | undefined | null;
    items: ItemRaw[];
    itemMemberships: ItemMembershipRaw[];
    members: MemberRaw[];
    memberProfiles: MemberProfileRaw[];
    itemVisibilities: ItemVisibilityRaw[];
    itemLoginSchemas: ItemLoginSchemaRaw[];
    guests: GuestRaw[];
    tags: TagRaw[];
    itemTags: ItemTagRaw[];
    geolocations: ItemGeolocationRaw[];
    apps: AppRaw[];
    appActions: AppActionRaw[];
    appSettings: AppSettingRaw[];
    appData: AppDataRaw[];
    invitations: InvitationRaw[];
  } = {
    items: [],
    actor: undefined,
    itemMemberships: [],
    members: [],
    memberProfiles: [],
    itemVisibilities: [],
    itemLoginSchemas: [],
    guests: [],
    tags: [],
    itemTags: [],
    geolocations: [],
    apps: [],
    appActions: [],
    appData: [],
    appSettings: [],
    invitations: [],
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
  if (processedItems.length) {
    result.items = await db
      .insert(itemsRaw)
      .values(
        processedItems.map((i) => ({
          ...ItemFactory({ ...i, creatorId: i.creator?.id }),
          deletedAt: i.isDeleted ? new Date().toISOString() : null,
        })),
      )
      .returning();
  }

  // save item memberships
  const itemMembershipsEntities = processItemMemberships(processedItems);
  if (itemMembershipsEntities.length) {
    result.itemMemberships = await db
      .insert(itemMemberships)
      // TODO
      .values(itemMembershipsEntities)
      .returning();
  }

  // save item visibilities
  result.itemVisibilities = await createItemVisibilities(processedItems);
  const {
    itemLoginSchemas,
    guests,
    itemMemberships: guestItemMemberships,
  } = await createItemLoginSchemasAndGuests(processedItems);
  result.itemLoginSchemas = itemLoginSchemas;
  result.guests = guests;
  result.itemMemberships = result.itemMemberships.concat(guestItemMemberships);

  // save tags
  if (data.tags?.length) {
    result.tags = await db.insert(tagsTable).values(data.tags).returning();
  }

  const itemTags = processedItems.flatMap((item) =>
    item.tags ? item.tags.map((t) => ({ ...t, itemId: item.id })) : [],
  );
  if (itemTags.length) {
    for (const it of itemTags) {
      const tag = (await db.insert(tagsTable).values(it).returning())[0];
      result.tags.push(tag);
      const itemTag = (
        await db.insert(itemTagsTable).values({ tagId: tag.id, itemId: it.itemId }).returning()
      )[0];
      result.itemTags.push(itemTag);
    }
  }

  // save item geolocation
  const geolocations = processedItems.reduce((acc, i) => {
    if (i.geolocation) {
      acc.push({ itemPath: i.path, ...i.geolocation });
    }
    return acc;
  }, []);
  if (geolocations.length) {
    result.geolocations = await db.insert(itemGeolocationsTable).values(geolocations).returning();
  }

  // save apps
  // const publisherValues = data.apps.map(({publisher}))
  const appValues = data.apps;
  if (appValues?.length) {
    const publishersEntities = await db
      .insert(publishers)
      .values({
        id: APPS_PUBLISHER_ID,
        name: faker.word.sample(),
        origins: [faker.internet.url()],
      })
      .onConflictDoUpdate({
        target: publishers.id,
        set: {
          origins: [faker.internet.url()],
        },
      })
      .returning();
    result.apps = await db
      .insert(apps)
      .values(
        appValues.map((app) => ({
          name: faker.word.words(5),
          description: faker.word.sample(),
          url: `${publishersEntities[0].origins[0]}/${faker.word.sample()}`,
          ...app,
          publisherId: publishersEntities[0].id,
        })),
      )
      .onConflictDoUpdate({
        target: publishers.id,
        set: {
          description: faker.word.sample(),
          url: `${publishersEntities[0].origins[0]}/${faker.word.sample()}`,
          publisherId: publishersEntities[0].id,
        },
      })
      .returning();
  }

  // save app actions
  const appActionValues = processedItems.reduce((acc, i) => {
    if (i.appActions) {
      return acc.concat(
        i.appActions.map((aa) => ({
          itemId: i.id,
          data: {},
          type: faker.word.sample(),
          accountId: aa.account.id,
          ...aa,
        })),
      );
    }
    return acc;
  }, []);
  if (appActionValues.length) {
    result.appActions = await db.insert(appActions).values(appActionValues).returning();
  }

  // save app data
  const appDataValues = processedItems.reduce((acc, i) => {
    if (i.appData) {
      return acc.concat(
        i.appData.map((aa) => ({
          itemId: i.id,
          visibility: AppDataVisibility.Member,
          data: {},
          type: faker.word.sample(),
          accountId: aa.account.id,
          creatorId: aa.creator.id,
          ...aa,
        })),
      );
    }
    return acc;
  }, []);
  if (appDataValues.length) {
    result.appData = await db.insert(appDatas).values(appDataValues).returning();
  }

  // save app settings
  const appSettingValues = processedItems.reduce((acc, i) => {
    if (i.appSettings) {
      return acc.concat(
        i.appSettings.map((as) => ({
          itemId: i.id,
          data: {},
          name: faker.word.sample(),
          creatorId: as.creator.id,
          ...as,
        })),
      );
    }
    return acc;
  }, []);
  if (appSettingValues.length) {
    result.appSettings = await db.insert(appSettings).values(appSettingValues).returning();
  }

  // save invitations
  const invitationValues = processedItems.reduce((acc, i) => {
    if (i.invitations) {
      return acc.concat(
        i.invitations.map(() => ({
          itemPath: i.path,
          permission: PermissionLevel.Read,
          email: faker.internet.email().toLowerCase(),
        })),
      );
    }
    return acc;
  }, []);
  if (invitationValues.length) {
    result.invitations = await db.insert(invitationsTable).values(invitationValues).returning();
  }

  // save recycled data
  const recycledDataValues = processedItems.reduce((acc, i) => {
    if (i.isDeleted) {
      return acc.concat([{ itemPath: i.path }]);
    }
    return acc;
  }, []);
  if (recycledDataValues.length) {
    await db.insert(recycledItemDatas).values(recycledDataValues);
  }

  return result;
}

/**
 * Generate a file item data structure
 * @param member creator of the file
 * @returns file item structure
 */
export function buildFile(member: ReferencedSeedActor) {
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
