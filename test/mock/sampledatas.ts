import { BaseEntity } from 'typeorm';

import {
  CompleteMember,
  ItemTagType,
  ItemType,
  ItemValidationProcess,
  ItemValidationStatus,
  MemberFactory,
  MemberType,
  PermissionLevel,
} from '@graasp/sdk';

import { TableType } from '.';
import { MemberPassword } from '../../src/services/auth/plugins/password/entities/password';
import { Item } from '../../src/services/item/entities/Item';
import { App } from '../../src/services/item/plugins/app/entities/app';
import { Publisher } from '../../src/services/item/plugins/app/entities/publisher';
import { ItemGeolocation } from '../../src/services/item/plugins/geolocation/ItemGeolocation';
import { ItemTag } from '../../src/services/item/plugins/itemTag/ItemTag';
import { ItemPublished } from '../../src/services/item/plugins/published/entities/itemPublished';
import { ItemValidation } from '../../src/services/item/plugins/validation/entities/ItemValidation';
import { ItemValidationGroup } from '../../src/services/item/plugins/validation/entities/ItemValidationGroup';
import { ItemMembership } from '../../src/services/itemMembership/entities/ItemMembership';
import { Member } from '../../src/services/member/entities/member';

type defaultOmitedKeys = keyof BaseEntity | 'createdAt' | 'updatedAt';

// Shared IDs between entities.
const sharedIds: { [key: string]: string } = {
  bobMember: '6eeede3d-08cb-4b69-ac10-d30168a09625',
  aliceMember: '3ad89fb3-d677-481e-bf00-aad74e5cef78',
  epflMember: 'a0fd58a7-b702-4088-af46-08ea03797dcf',

  dragonRootItem: '2feed89d-cc94-4c77-98e4-3cc02270d371',
  dragonHowToEatItem: 'bb2904e5-abac-4b01-b3eb-ac5a0c940e37',

  dragonRootValidationGroup: 'be9aa832-5ad0-4250-8eb2-9770a1892069',

  graaspPublisher: 'cbfca68f-4e94-4e2e-a1d0-6c03d2d5e87f',
  greatAppId: '8614d856-8b51-4a45-a9b9-4e67e651d2d6',
  greatAppUrl: 'http://apps.localhost:3012',
};

const datas: {
  members?: TableType<Member, CompleteMember>;
  memberPasswords?: TableType<
    MemberPassword,
    { [K in keyof Omit<MemberPassword, defaultOmitedKeys>] }
  >;
  items?: TableType<
    Item,
    { [K in keyof Omit<Item, defaultOmitedKeys | 'search_document' | 'geolocation'>] }
  >;
  itemMemberships?: TableType<
    ItemMembership,
    { [K in keyof Omit<ItemMembership, defaultOmitedKeys>] }
  >;
  itemGeolocation?: TableType<
    ItemGeolocation,
    { [K in keyof Omit<ItemGeolocation, defaultOmitedKeys>] }
  >;
  itemTags?: TableType<ItemTag, { [K in keyof Omit<ItemTag, defaultOmitedKeys>] }>;
  itemValidationGroups?: TableType<
    ItemValidationGroup,
    { [K in keyof Omit<ItemValidationGroup, defaultOmitedKeys | 'itemValidations'>] }
  >;
  itemValidations?: TableType<
    ItemValidation,
    { [K in keyof Omit<ItemValidation, defaultOmitedKeys>] }
  >;
  itemsPublished?: TableType<
    ItemPublished,
    { [K in keyof Omit<ItemPublished, defaultOmitedKeys>] }
  >;
  publishers?: TableType<Publisher, { [K in keyof Omit<Publisher, defaultOmitedKeys>] }>;
  apps?: TableType<App, { [K in keyof Omit<App, defaultOmitedKeys>] }>;
} = {
  members: {
    constructor: Member,
    factory: MemberFactory,
    entities: [
      {
        name: 'bob',
        email: 'bob@gmail.com',
        id: sharedIds.bobMember,
        extra: { lang: 'en' },
      },
      {
        name: 'alice',
        email: 'alice@gmail.com',
        id: sharedIds.aliceMember,
        extra: { lang: 'fr' },
      },
      {
        name: 'epfl',
        email: 'epfl@gmail.com',
        id: sharedIds.epflMember,
        type: MemberType.Group,
        extra: { lang: 'en' },
      },
    ],
  },
  memberPasswords: {
    constructor: MemberPassword,
    entities: [
      {
        id: '3763892b-a033-4a79-8698-14d3361d8bb0',
        member: sharedIds.bobMember,
        password: '$2b$10$gjcXAwB0nrRThVcns82GNervaiVyJrz1.pAPXFktydNQ1BEDHKFuy', // Password is "Abcd1234"
      },
    ],
  },
  items: {
    constructor: Item,
    entities: [
      {
        id: sharedIds.dragonRootItem,
        name: 'train_dragon_101',
        displayName: 'How to train your dragon ?',
        type: ItemType.FOLDER,
        description:
          "During this course, you'll learn everything you need to being able to train a dragon.",
        path: sharedIds.dragonRootItem.replace(/-/g, '_'), // Replace all '-' by '_'
        creator: sharedIds.bobMember,
        extra: { folder: { childrenOrder: [sharedIds.dragonHowToEatItem] } },
        settings: { hasThumbnail: false, ccLicenseAdaption: 'CC BY' },
        lang: 'en',
        deletedAt: undefined,
      },
      {
        id: sharedIds.dragonHowToEatItem,
        name: 'eating',
        displayName: 'What doest dragon eat ?',
        type: ItemType.DOCUMENT,
        description: undefined,
        path: (sharedIds.dragonRootItem + '.' + sharedIds.dragonHowToEatItem).replace(/-/g, '_'),
        creator: sharedIds.bobMember,
        extra: { document: { content: '<p>They eat fruits :) !</p>' } },
        settings: { hasThumbnail: false, showChatbox: true },
        lang: 'en',
        deletedAt: undefined,
      },
    ],
  },
  itemMemberships: {
    constructor: ItemMembership,
    entities: [
      {
        id: '53397352-f4b1-4bfa-9248-37021e446ee6',
        permission: PermissionLevel.Admin,
        creator: sharedIds.bobMember,
        member: sharedIds.bobMember,
        item: sharedIds.dragonRootItem.replace(/-/g, '_'), // Replace all - by '_'
      },
    ],
  },

  itemGeolocation: {
    constructor: ItemGeolocation,
    entities: [
      {
        id: '9fa5f5f3-a485-4e57-9969-385d2e41f0f8',
        lat: 46.9447941,
        lng: 7.4346776,
        country: 'CH',
        item: sharedIds.dragonRootItem.replace(/-/g, '_'), // Replace all - by '_'
        addressLabel: undefined,
        helperLabel: undefined,
      },
    ],
  },

  itemTags: {
    constructor: ItemTag,
    entities: [
      {
        id: '22d21f0f-f8fb-43e1-9ff7-ec76c8eb416c',
        type: ItemTagType.Public,
        item: sharedIds.dragonRootItem.replace(/-/g, '_'), // Replace all - by '_'
        creator: sharedIds.bobMember,
      },
    ],
  },

  itemValidationGroups: {
    constructor: ItemValidationGroup,
    entities: [
      {
        id: sharedIds.dragonRootValidationGroup,
        item: sharedIds.dragonRootItem,
      },
    ],
  },

  itemValidations: {
    constructor: ItemValidation,
    entities: [
      {
        id: '1740a38c-530e-40d2-8e1f-6e151b20d769',
        item: sharedIds.dragonRootItem,
        process: ItemValidationProcess.BadWordsDetection,
        status: ItemValidationStatus.Success,
        result: '',
        itemValidationGroup: sharedIds.dragonRootValidationGroup,
      },
      {
        id: '371bc445-40ec-4245-8091-18f23c0d6ec5',
        item: sharedIds.dragonHowToEatItem,
        process: ItemValidationProcess.BadWordsDetection,
        status: ItemValidationStatus.Success,
        result: '',
        itemValidationGroup: sharedIds.dragonRootValidationGroup,
      },
    ],
  },

  itemsPublished: {
    constructor: ItemPublished,
    entities: [
      {
        id: '35319ce0-4bbb-4e77-9811-ce07ad735057',
        creator: sharedIds.bobMember,
        item: sharedIds.dragonRootItem.replace(/-/g, '_'),
      },
    ],
  },

  publishers: {
    constructor: Publisher,
    entities: [
      {
        id: 'cbfca68f-4e94-4e2e-a1d0-6c03d2d5e87f',
        name: 'GraaspPublisher',
        origins: ['http://apps.localhost:3012'],
      },
    ],
  },

  apps: {
    constructor: App,
    entities: [
      {
        id: sharedIds.greatAppId,
        key: sharedIds.greatAppId,
        name: 'GreatApp',
        description: "A great application that shouldn't be in production !",
        url: sharedIds.greatAppUrl,
        publisher: sharedIds.graaspPublisher,
        extra: {},
      },
    ],
  },
};
export default datas;
