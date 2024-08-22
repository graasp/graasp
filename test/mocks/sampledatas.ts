import { faker } from '@faker-js/faker';
import { BaseEntity } from 'typeorm';

import {
  CompleteMember,
  ItemTagType,
  ItemType,
  ItemValidationProcess,
  ItemValidationStatus,
  MemberFactory,
  PermissionLevel,
  buildPathFromIds,
} from '@graasp/sdk';

import { TableType } from '.';
import { Item } from '../../src/services/item/entities/Item';
import { App } from '../../src/services/item/plugins/app/entities/app';
import { Publisher } from '../../src/services/item/plugins/app/entities/publisher';
import { ItemGeolocation } from '../../src/services/item/plugins/geolocation/ItemGeolocation';
import { ItemTag } from '../../src/services/item/plugins/itemTag/ItemTag';
import { ItemPublished } from '../../src/services/item/plugins/publication/published/entities/itemPublished';
import { ItemValidation } from '../../src/services/item/plugins/publication/validation/entities/ItemValidation';
import { ItemValidationGroup } from '../../src/services/item/plugins/publication/validation/entities/ItemValidationGroup';
import { ItemMembership } from '../../src/services/itemMembership/entities/ItemMembership';
import { Member } from '../../src/services/member/entities/member';

type defaultOmitedKeys = keyof BaseEntity | 'createdAt' | 'updatedAt';

// Shared IDs between entities.
const sharedIds = {
  bobMember: '6eeede3d-08cb-4b69-ac10-d30168a09625',
  aliceMember: '3ad89fb3-d677-481e-bf00-aad74e5cef78',

  publicRootFolder: '2feed89d-cc94-4c77-98e4-3cc02270d371',
  publicChildGeolocDocument: 'bb2904e5-abac-4b01-b3eb-ac5a0c940e37',

  publicRootValidationGroup: 'be9aa832-5ad0-4250-8eb2-9770a1892069',

  hiddenChildItem: 'bdfca277-9ec8-472b-b179-158275a0f0e4',
  publicChildChatboxItem: '08f4e398-fbe3-4fdc-a83e-14baaeca482c',

  samplePublisher: 'cbfca68f-4e94-4e2e-a1d0-6c03d2d5e87f',
  sampleAppId: '8614d856-8b51-4a45-a9b9-4e67e651d2d6',
  sampleAppUrl: 'http://apps.localhost:3012',
};

const datas: {
  members?: TableType<Member, CompleteMember>;
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
    ],
  },
  items: {
    constructor: Item,
    entities: [
      {
        id: sharedIds.publicRootFolder,
        name: 'public_root_folder',
        displayName: 'Public Root Folder',
        type: ItemType.FOLDER,
        description: faker.lorem.text(),
        path: buildPathFromIds(sharedIds.publicRootFolder),
        creator: sharedIds.bobMember,
        extra: { folder: {} },
        settings: { hasThumbnail: false, ccLicenseAdaption: 'CC BY' },
        lang: 'en',
        deletedAt: undefined,
        order: 20,
      },
      {
        id: sharedIds.publicChildGeolocDocument,
        name: 'public_child_geoloc_document',
        displayName: 'Public Child Geoloc Document',
        type: ItemType.DOCUMENT,
        description: undefined,
        path: buildPathFromIds(sharedIds.publicRootFolder, sharedIds.publicChildGeolocDocument),
        creator: sharedIds.bobMember,
        extra: { document: { content: faker.lorem.text() } },
        settings: { hasThumbnail: false },
        lang: 'en',
        deletedAt: undefined,
        order: 20,
      },
      {
        id: sharedIds.hiddenChildItem,
        name: 'hidden_child_document',
        displayName: 'Hidden Child Document',
        type: ItemType.DOCUMENT,
        description: undefined,
        path: buildPathFromIds(sharedIds.publicRootFolder, sharedIds.hiddenChildItem),
        creator: sharedIds.bobMember,
        extra: { document: { content: faker.lorem.text() } },
        settings: { hasThumbnail: false },
        lang: 'en',
        deletedAt: undefined,
        order: 20,
      },
      {
        id: sharedIds.publicChildChatboxItem,
        name: 'public_child_chatbox_document',
        displayName: 'Public Child Chatbox Document',
        type: ItemType.DOCUMENT,
        description: undefined,
        path: buildPathFromIds(sharedIds.publicRootFolder, sharedIds.publicChildChatboxItem),
        creator: sharedIds.bobMember,
        extra: { document: { content: faker.lorem.text() } },
        settings: { hasThumbnail: false, showChatbox: true },
        lang: 'en',
        deletedAt: undefined,
        order: 20,
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
        account: sharedIds.bobMember,
        item: buildPathFromIds(sharedIds.publicRootFolder),
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
        item: buildPathFromIds(sharedIds.publicRootFolder),
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
        item: buildPathFromIds(sharedIds.publicRootFolder),
        creator: sharedIds.bobMember,
      },
    ],
  },

  itemValidationGroups: {
    constructor: ItemValidationGroup,
    entities: [
      {
        id: sharedIds.publicRootValidationGroup,
        item: sharedIds.publicRootFolder,
      },
    ],
  },

  itemValidations: {
    constructor: ItemValidation,
    entities: [
      {
        id: '1740a38c-530e-40d2-8e1f-6e151b20d769',
        item: sharedIds.publicRootFolder,
        process: ItemValidationProcess.BadWordsDetection,
        status: ItemValidationStatus.Success,
        result: '',
        itemValidationGroup: sharedIds.publicRootValidationGroup,
      },
      {
        id: '371bc445-40ec-4245-8091-18f23c0d6ec5',
        item: sharedIds.publicChildGeolocDocument,
        process: ItemValidationProcess.BadWordsDetection,
        status: ItemValidationStatus.Success,
        result: '',
        itemValidationGroup: sharedIds.publicRootValidationGroup,
      },
    ],
  },

  itemsPublished: {
    constructor: ItemPublished,
    entities: [
      {
        id: '35319ce0-4bbb-4e77-9811-ce07ad735057',
        creator: sharedIds.bobMember,
        item: buildPathFromIds(sharedIds.publicRootFolder),
      },
    ],
  },

  publishers: {
    constructor: Publisher,
    entities: [
      {
        id: 'cbfca68f-4e94-4e2e-a1d0-6c03d2d5e87f',
        name: 'SamplePublisher',
        origins: [sharedIds.sampleAppUrl],
      },
    ],
  },

  apps: {
    constructor: App,
    entities: [
      {
        id: sharedIds.sampleAppId,
        key: sharedIds.sampleAppId,
        name: 'SampleApp',
        description: faker.lorem.text(),
        url: sharedIds.sampleAppUrl,
        publisher: sharedIds.samplePublisher,
        extra: {},
      },
    ],
  },
};
export default datas;
