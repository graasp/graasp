import { faker } from '@faker-js/faker';
import { inArray } from 'drizzle-orm';
import { v4 } from 'uuid';

import {
  AppDataVisibility,
  type FileItemProperties,
  ItemLoginSchemaStatus,
  ItemLoginSchemaType,
  ItemValidationProcess,
  ItemValidationStatus,
  type ItemVisibilityOptionsType,
  ItemVisibilityType,
  ShortLinkPlatform,
  buildPathFromIds,
  getIdsFromPath,
} from '@graasp/sdk';

import { db } from '../../src/drizzle/db';
import {
  accountsTable,
  actionRequestExportsTable,
  actionsTable,
  appActionsTable,
  appDataTable,
  appSettingsTable,
  appsTable,
  chatMentionsTable,
  chatMessagesTable,
  guestPasswordsTable,
  invitationsTable,
  itemBookmarksTable,
  itemGeolocationsTable,
  itemLikesTable,
  itemLoginSchemasTable,
  itemMembershipsTable,
  itemTagsTable,
  itemValidationGroupsTable,
  itemValidationsTable,
  itemVisibilitiesTable,
  itemsRawTable,
  memberPasswordsTable,
  memberProfilesTable,
  membershipRequestsTable,
  publishedItemsTable,
  publishersTable,
  recycledItemDatasTable,
  shortLinksTable,
  tagsTable,
} from '../../src/drizzle/schema';
import type {
  AccountRaw,
  ActionRaw,
  ActionRequestExportRaw,
  AppActionRaw,
  AppDataRaw,
  AppRaw,
  AppSettingRaw,
  ChatMentionRaw,
  ChatMessageRaw,
  GuestRaw,
  InvitationRaw,
  ItemBookmarkRaw,
  ItemGeolocationInsertDTO,
  ItemGeolocationRaw,
  ItemLikeRaw,
  ItemLoginSchemaRaw,
  ItemMembershipRaw,
  ItemPublishedRaw,
  ItemTagRaw,
  ItemValidationGroupRaw,
  ItemValidationRaw,
  ItemVisibilityRaw,
  MemberProfileRaw,
  MemberRaw,
  MembershipRequestRaw,
  ShortLinkRaw,
  TagRaw,
} from '../../src/drizzle/types';
import { encryptPassword } from '../../src/services/auth/plugins/password/utils';
import type { ItemRaw } from '../../src/services/item/item';
import { PermissionLevel } from '../../src/types';
import { APPS_PUBLISHER_ID } from '../../src/utils/config';
import { ActionFactory } from '../factories/action.factory';
import { ItemFactory } from '../factories/item.factory';
import { GuestFactory, MemberFactory } from '../factories/member.factory';
import { MemberProfileFactory } from '../factories/memberProfile.factory';

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
  permission?: PermissionLevel;
};
type SeedItem<M = SeedMember> = (Partial<ItemRaw> & { creator?: M | null }) & {
  children?: SeedItem<M>[];
  memberships?: SeedMembership<M>[];
  isPublic?: boolean;
  isPublished?: boolean;
  isHidden?: boolean;
  isDeleted?: boolean;
  isBookmarked?: boolean;
  likes?: M[];
  itemValidations?: (Partial<Omit<ItemValidationRaw, 'id' | 'itemId' | 'itemValidationGroupId'>> & {
    groupName: string;
    status: ItemValidationRaw['status'];
  })[];
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
  chatMessages?: (Omit<Partial<ChatMessageRaw>, 'creatorId'> & {
    creator: M | null;
    mentions?: M[];
  })[];
  membershipRequests?: (Omit<Partial<MembershipRequestRaw>, 'memberId'> & {
    member: M;
  })[];
  actionRequestExports?: (Omit<Partial<ActionRequestExportRaw>, 'memberId'> & {
    member: M;
  })[];
  actions?: Omit<SeedAction<M>, 'itemId'>[];
  shortLinks?: Partial<ShortLinkRaw>[];
};
type SeedAction<M = SeedMember> = Partial<Pick<ActionRaw, 'type' | 'createdAt' | 'view'>> & {
  account: M;
};
type DataType = {
  actor?: SeedActor | null;
  members?: SeedMember[];
  items?: SeedItem<ReferencedSeedActor | SeedMember>[];
  tags?: (Pick<TagRaw, 'category'> & Partial<TagRaw>)[];
  apps?: Partial<AppRaw>[];
  actions?: SeedAction<ReferencedSeedActor | SeedMember>[];
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
    chatMessages: i.chatMessages?.map((ad) => ({
      ...ad,
      creator: ad.creator === ACTOR_STRING ? (createdActor as any) : ad.creator,
      mentions: ad.mentions?.map((m) => (m === ACTOR_STRING ? (createdActor as any) : m)),
    })),
    membershipRequests: i.membershipRequests?.map((mr) => ({
      ...mr,
      member: mr.member === ACTOR_STRING ? (createdActor as any) : mr.member,
    })),
    children: replaceActorInItems(createdActor, i.children),
    likes: i.likes?.map((m) => (m === ACTOR_STRING ? (createdActor as any) : m)),
    actionRequestExports: i.actionRequestExports?.map((ar) => ({
      ...ar,
      member: ar.member === ACTOR_STRING ? (createdActor as any) : ar.member,
    })),
    actions: i.actions?.map((a) => ({
      ...a,
      account: a.account === ACTOR_STRING ? (createdActor as any) : a.account,
    })),
  }));
};

const replaceActorInActions = (
  createdActor?: AccountRaw,
  actions?: DataType['actions'],
): SeedAction[] => {
  if (!actions?.length) {
    return [];
  }

  return actions.map((i) => ({
    ...i,
    account: i.account === ACTOR_STRING ? (createdActor as any) : (i.account ?? null),
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
    const membershipRequests = i.membershipRequests?.map((mr) => ({
      ...mr,
      member: getNameIfExists(mr.member) === createdAccount.name ? createdAccount : mr.member,
    }));
    const likes = i.likes?.map((m) =>
      getNameIfExists(m) === createdAccount.name ? createdAccount : m,
    );
    const actionRequestExports = i.actionRequestExports?.map((ar) => {
      return {
        ...ar,
        member: getNameIfExists(ar.member) === createdAccount.name ? createdAccount : ar.member,
      };
    });
    const actions = i.actions?.map((a) => {
      return {
        ...a,
        account: getNameIfExists(a.account) === createdAccount.name ? createdAccount : a.account,
      };
    });
    const chatMessages = i.chatMessages?.map((cm) => {
      return {
        ...cm,
        creator: getNameIfExists(cm.creator) === createdAccount.name ? createdAccount : cm.creator,
        mentions: cm.mentions?.map((m) =>
          getNameIfExists(m) === createdAccount.name ? createdAccount : m,
        ),
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
      membershipRequests,
      likes,
      actionRequestExports,
      actions,
      chatMessages,
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
  actions,
}: DataType): Promise<{
  actor: AccountRaw | null;
  members?: SeedMember[];
  actorProfile?: MemberProfileRaw;
  items: SeedItem<SeedMember>[];
  actions: SeedAction[];
}> => {
  // create actor if not null
  let createdActor: AccountRaw | null = null;
  let actorProfile;
  let processedItems;
  let processedActions;
  if (actor !== null) {
    // replace actor data with default values if actor is undefined or 'actor'
    const actorData: Partial<AccountRaw> = typeof actor === 'string' || !actor ? {} : actor;
    const res = await db.insert(accountsTable).values(MemberFactory(actorData)).returning();
    createdActor = res[0];

    // a profile is defined
    if (actorData) {
      if (actor?.profile) {
        actorProfile = (
          await db
            .insert(memberProfilesTable)
            .values([MemberProfileFactory({ ...actor.profile, memberId: createdActor.id })])
            .returning()
        )[0];
      }
      if (actor?.password) {
        await db.insert(memberPasswordsTable).values({
          password: await encryptPassword(actor.password),
          memberId: createdActor.id,
        });
      }
    }
    // replace 'actor' in entities
    processedItems = replaceActorInItems(createdActor, items);
    processedActions = replaceActorInActions(createdActor, actions);
  } else {
    // pass through
    processedItems = items;
    processedActions = actions;
  }
  return {
    actor: createdActor,
    items: processedItems,
    members,
    actorProfile,
    actions: processedActions,
  };
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
    ?.flatMap((i) => i.memberships?.map((im) => ({ ...im, itemPath: i.path })) ?? [])
    ?.map((im) => ({
      permission: 'admin',
      accountId: (im.account as any).id,
      creatorId: im.creator ? (im.creator as any).id : null,
      ...im,
    })) as ItemMembershipRaw[];
};

const getAllAccountsFromItems = (items: SeedItem[] = []) => {
  if (items.length === 0) {
    return [];
  }

  return items.flatMap((i) => {
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

    // get all accounts from all chat message and mentions
    const creatorsFromChatMessages = (i.chatMessages ?? [])?.reduce<SeedMember[]>((acc, m) => {
      const accounts = [...(m.mentions ?? [])];
      if (m.creator) {
        accounts.push(m.creator);
      }
      return [...acc, ...accounts];
    }, []);

    // get all accounts and creators from all app data
    const accountsFromAppData = (i.appData ?? [])?.reduce<SeedMember[]>((acc, m) => {
      return [...acc, m.account, m.creator].filter(Boolean);
    }, []);

    const membersForMembershipRequests = (i.membershipRequests ?? [])?.reduce<SeedMember[]>(
      (acc, m) => {
        return [...acc, m.member].filter(Boolean);
      },
      [],
    );
    const membersFromActionRequestExports = (i.actionRequestExports ?? [])?.reduce<SeedMember[]>(
      (acc, m) => {
        return [...acc, m.member].filter(Boolean);
      },
      [],
    );
    const accountsFromActions = (i.actions ?? [])?.reduce<SeedMember[]>((acc, m) => {
      return [...acc, m.account].filter(Boolean);
    }, []);

    const allAccounts = [
      ...accountsFromMemberships,
      ...accountsFromAppActions,
      ...accountsFromAppData,
      ...creatorsFromAppSettings,
      ...creatorsFromChatMessages,
      ...membersForMembershipRequests,
      ...getAllAccountsFromItems(i.children),
      ...(i.likes ?? []),
      ...membersFromActionRequestExports,
      ...accountsFromActions,
    ];

    // get creator of item
    if (i.creator) {
      allAccounts.push(i.creator);
    }

    return allAccounts;
  });
};

const getAllAccountsFromActions = (actions: SeedAction[]) => {
  return actions.flatMap((a) => (a.account ? [a.account] : []));
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
  actions = [],
}: {
  items?: SeedItem[];
  members?: SeedMember[];
  actions?: SeedAction[];
}) {
  // get all unique members
  const allMembers = [
    ...members,
    ...getAllAccountsFromItems(items),
    ...getAllAccountsFromActions(actions),
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
  actions = [],
}: {
  actor?: AccountRaw | null;
  items?: SeedItem[];
  members?: SeedMember[];
  actions?: SeedAction[];
}) {
  const membersWithIds = generateIdForMembers({ items, members, actions })
    // ignore actor if it is defined
    .filter((m) => (actor ? m.id !== actor.id : true));
  if (membersWithIds.length) {
    const savedMembers = await db
      .insert(accountsTable)
      .values(membersWithIds.map((m) => MemberFactory(m)))
      .returning();
    const profiles = membersWithIds.map((m) => m.profile).filter(Boolean) as MemberProfileRaw[];
    const savedMemberProfiles = profiles.length
      ? await db.insert(memberProfilesTable).values(profiles).returning()
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
    return await db.insert(itemVisibilitiesTable).values(visibilities).returning();
  }

  return [];
}

async function createItemPublisheds(items: (SeedItem & { id: string; path: string })[]) {
  const published = items.reduce<{ itemPath: string }[]>((acc, { path, isPublished }) => {
    if (isPublished) {
      acc.push({ itemPath: path });
    }
    return acc;
  }, []);

  let publishedItemsData: ItemPublishedRaw[] = [];
  if (published.length) {
    publishedItemsData = await db.insert(publishedItemsTable).values(published).returning();
  }

  // get all item validation group names
  const groupNameToId = new Map(
    items.reduce<[string, { id: string; itemId: string }][]>((acc, { id, itemValidations }) => {
      if (itemValidations) {
        return acc.concat(itemValidations.map((iv) => [iv.groupName, { id: v4(), itemId: id }]));
      }
      return acc;
    }, []),
  );
  if (groupNameToId.size) {
    // generate item validation and set correct validation group id
    const itemValidationEntities = items.reduce<
      {
        itemId;
        itemValidationGroupId: string;
        process: ItemValidationProcess;
        status: ItemValidationStatus;
      }[]
    >((acc, { id, itemValidations }) => {
      if (itemValidations) {
        return acc.concat(
          itemValidations.map((iv) => ({
            itemId: id,
            process: ItemValidationProcess.BadWordsDetection,
            status: ItemValidationStatus.Success,
            itemValidationGroupId: groupNameToId.get(iv.groupName)!.id,
          })),
        );
      }
      return acc;
    }, []);

    // save all groups
    // const itemValidationGroupEntities = [...groupNameToId.values()].map(({ itemId, id }) => ({
    //   id: v4(),
    //   itemId,
    // }));
    const itemValidationGroupResult = await db
      .insert(itemValidationGroupsTable)
      .values([...groupNameToId.values()])
      .returning();

    // save all item validations
    const itemValidationResults = await db
      .insert(itemValidationsTable)
      .values(itemValidationEntities)
      .returning();

    return {
      itemValidations: itemValidationResults,
      itemValidationGroups: itemValidationGroupResult,
    };
  }
  return {
    itemValidations: [],
    itemValidationGroups: [],
    publishedItemsData,
  };
}

async function createItemBookmarks(items: (SeedItem & { id: string })[], actor: { id: string }) {
  const bookmarks = items.reduce<{ itemId: string; memberId: string }[]>(
    (acc, { id, isBookmarked }) => {
      if (isBookmarked) {
        acc.push({ itemId: id, memberId: actor.id });
      }
      return acc;
    },
    [],
  );

  if (bookmarks.length) {
    return await db.insert(itemBookmarksTable).values(bookmarks).returning();
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
      .insert(itemLoginSchemasTable)
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
      await db.insert(guestPasswordsTable).values(guestPasswordsValues);
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
          permission: 'read',
          itemPath: path,
        },
      ]);
    }, []);
    memberships = await db.insert(itemMembershipsTable).values(guestMemberships).returning();
  }

  return {
    itemLoginSchemasTable: itemLoginSchemasValues,
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
    actions: ActionRaw[];
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
    chatMessages: ChatMessageRaw[];
    chatMentions: ChatMentionRaw[];
    membershipRequests: MembershipRequestRaw[];
    bookmarks: ItemBookmarkRaw[];
    likes: ItemLikeRaw[];
    itemValidationGroups: ItemValidationGroupRaw[];
    itemValidations: ItemValidationRaw[];
    shortLinks: ShortLinkRaw[];
    publishedItems?: ItemPublishedRaw[];
  } = {
    actions: [],
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
    chatMessages: [],
    chatMentions: [],
    membershipRequests: [],
    bookmarks: [],
    itemValidationGroups: [],
    itemValidations: [],
    likes: [],
    shortLinks: [],
  };

  const {
    items: itemsWithActor,
    actor,
    members,
    actorProfile,
    actions: actionsWithActor,
  } = await processActor(data);
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
    actions: actionsWithActor,
  });
  result.members = membersWithIds;
  result.memberProfiles = result.memberProfiles.concat(memberProfiles);

  // save items
  const processedItems = generateIdAndPathForItems(itemsWithAccounts);
  if (processedItems.length) {
    result.items = await db
      .insert(itemsRawTable)
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
      .insert(itemMembershipsTable)
      .values(itemMembershipsEntities)
      .returning();
  }

  // save item visibilities
  result.itemVisibilities = await createItemVisibilities(processedItems);
  const {
    itemLoginSchemasTable,
    guests,
    itemMemberships: guestItemMemberships,
  } = await createItemLoginSchemasAndGuests(processedItems);
  result.itemLoginSchemas = itemLoginSchemasTable;
  result.guests = guests;
  result.itemMemberships = result.itemMemberships.concat(guestItemMemberships);

  // save published
  const {
    itemValidationGroups: ivg,
    itemValidations: iv,
    publishedItemsData,
  } = await createItemPublisheds(processedItems);
  result.itemValidations = iv;
  result.itemValidationGroups = ivg;
  result.publishedItems = publishedItemsData;

  // save tags without throwing on conflict, return everything
  if (data.tags?.length) {
    const tagsWithName = data.tags.map((t) => ({ name: faker.word.words(), ...t }));
    await db.insert(tagsTable).values(tagsWithName).onConflictDoNothing();
    result.tags = await db.query.tagsTable.findMany({
      where: inArray(
        tagsTable.name,
        tagsWithName.map(({ name }) => name),
      ),
    });
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

  // save bookmarks
  if (actor) {
    result.bookmarks = await createItemBookmarks(processedItems, actor);
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
  const appValues = data.apps;
  if (appValues?.length) {
    const publishersEntities = await db
      .insert(publishersTable)
      .values({
        id: APPS_PUBLISHER_ID,
        name: faker.word.sample(),
        origins: [faker.internet.url()],
      })
      .onConflictDoUpdate({
        target: publishersTable.id,
        set: {
          origins: [faker.internet.url()],
        },
      })
      .returning();
    result.apps = await db
      .insert(appsTable)
      .values(
        appValues.map((app) => ({
          name: faker.word.words(5),
          description: faker.word.sample(),
          url: `${publishersEntities[0].origins[0]}/${faker.word.sample()}`,
          thumbnail: faker.internet.url(),
          ...app,
          publisherId: publishersEntities[0].id,
        })),
      )
      .onConflictDoUpdate({
        target: publishersTable.id,
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
    result.appActions = await db.insert(appActionsTable).values(appActionValues).returning();
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
    result.appData = await db.insert(appDataTable).values(appDataValues).returning();
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
    result.appSettings = await db.insert(appSettingsTable).values(appSettingValues).returning();
  }

  // save invitations
  const invitationValues = processedItems.reduce((acc, i) => {
    if (i.invitations) {
      return acc.concat(
        i.invitations.map(() => ({
          itemPath: i.path,
          permission: 'read',
          email: faker.internet.email().toLowerCase(),
        })),
      );
    }
    return acc;
  }, []);
  if (invitationValues.length) {
    result.invitations = await db.insert(invitationsTable).values(invitationValues).returning();
  }

  // save chat messages
  const chatMessageValues = processedItems.reduce((acc, i) => {
    if (i.chatMessages) {
      return acc.concat(
        i.chatMessages.map((aa) => ({
          id: v4(),
          ...aa,
          creatorId: aa.creator.id,
          itemId: i.id,
          body: aa.body ?? faker.word.sample(),
        })),
      );
    }
    return acc;
  }, []);
  if (chatMessageValues.length) {
    result.chatMessages = await db.insert(chatMessagesTable).values(chatMessageValues).returning();

    // save chat mentions
    const chatMentionValues = chatMessageValues.reduce((acc, cm) => {
      const mentions = cm.mentions?.map((m) => ({ accountId: m.id, messageId: cm.id })) ?? [];

      return acc.concat(mentions);
    }, []);

    if (chatMentionValues.length) {
      result.chatMentions = await db
        .insert(chatMentionsTable)
        .values(chatMentionValues)
        .returning();
    }
  }

  // save recycled data
  const recycledDataValues = processedItems.reduce((acc, i) => {
    if (i.isDeleted) {
      return acc.concat([{ itemPath: i.path }]);
    }
    return acc;
  }, []);
  if (recycledDataValues.length) {
    await db.insert(recycledItemDatasTable).values(recycledDataValues);
  }

  // save likes
  const likeValues = processedItems.reduce((acc, i) => {
    if (i.likes) {
      return acc.concat(i.likes.map((m) => ({ itemId: i.id, creatorId: m.id })));
    }
    return acc;
  }, []);
  if (likeValues.length) {
    result.likes = await db.insert(itemLikesTable).values(likeValues).returning();
  }

  // save membership requests
  const membershipRequestValues = processedItems.reduce((acc, i) => {
    if (i.membershipRequests) {
      return acc.concat(
        i.membershipRequests.map((mr) => ({ itemId: i.id, memberId: mr.member.id })),
      );
    }
    return acc;
  }, []);
  if (membershipRequestValues.length) {
    await db.insert(membershipRequestsTable).values(membershipRequestValues);
  }

  // save action export requests
  const actionRequestExportsEntities = processedItems.reduce((acc, i) => {
    if (i.actionRequestExports) {
      return acc.concat(
        i.actionRequestExports.map((ar) => ({
          format: 'json',
          ...ar,
          itemPath: i.path,
          memberId: ar.member.id,
        })),
      );
    }
    return acc;
  }, []);
  if (actionRequestExportsEntities.length) {
    await db.insert(actionRequestExportsTable).values(actionRequestExportsEntities);
  }

  // replace actor and members in actions
  const actionEntities = data.actions?.map((a) => {
    let accountId: null | string = null;
    if (a.account) {
      if (actor && a.account === ACTOR_STRING) {
        accountId = actor.id;
      } else {
        accountId =
          membersWithIds.find((m) => m.name === (a.account as SeedMember).name)?.id ?? null;
      }
    }
    return { ...a, accountId };
  });
  // save actions
  if (actionEntities) {
    result.actions = await db
      .insert(actionsTable)
      .values(actionEntities.map((a) => ActionFactory(a)))
      .returning();
  }
  // save actions from items
  const itemActions = processedItems.reduce((acc, { id, actions }) => {
    if (actions?.length) {
      return acc.concat(actions?.map((a) => ({ ...a, itemId: id, accountId: a.account?.id })));
    }
    return acc;
  }, []);
  if (itemActions.length) {
    result.actions = result.actions.concat(
      await db
        .insert(actionsTable)
        .values(itemActions.map((a) => ActionFactory(a)))
        .returning(),
    );
  }

  // short links
  const shortlinkEntities = processedItems.flatMap(({ id, shortLinks }) => {
    return (
      shortLinks?.map((s) => ({
        platform: ShortLinkPlatform.Builder,
        alias: faker.word.words(4).split(' ').join('-'),
        ...s,
        itemId: id,
      })) ?? []
    );
  });
  if (shortlinkEntities.length) {
    result.shortLinks = await db.insert(shortLinksTable).values(shortlinkEntities).returning();
  }

  return result;
}

/**
 * Generate a file item data structure
 * @param member creator of the file
 * @returns file item structure
 */
export function buildFile(member: ReferencedSeedActor, extra: Partial<FileItemProperties> = {}) {
  return {
    type: 'file' as const,
    extra: {
      ['file']: {
        size: extra['file']?.size ?? faker.number.int({ min: 1, max: 1000 }),
        content: 'content',
        mimetype: 'image/png',
        name: faker.system.fileName(),
        path: faker.system.filePath(),
        ...extra,
      },
    },
    creator: member,
    memberships: [{ account: member }],
  };
}
