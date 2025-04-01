import { FastifyInstance } from 'fastify';

import { FolderItemFactory } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { AccountRaw, ActionRaw, Item, ItemMembershipRaw } from '../../../../drizzle/types';
import { saveMembers } from '../../../member/test/fixtures/members';
import { saveAppActions } from '../app/appAction/test/fixtures';
import { saveAppData } from '../app/appData/test/fixtures';
import { saveAppSettings } from '../app/appSetting/test/fixtures';
import { BaseAnalytics } from './base-analytics';

const rawItemRepository = AppDataSource.getRepository(Item);
const rawChatMessageRepository = AppDataSource.getRepository(ChatMessage);

const descendants: Item[] = [];
const actions: ActionRaw[] = [];
const itemMemberships: ItemMembershipRaw[] = [];
const metadata = {
  numActionsRetrieved: 0,
  requestedSampleSize: 0,
};

const expectMinimalAccountOrUndefined = (account?: Partial<AccountRaw> | null) => {
  if (!account) {
    return;
  }

  expect(account.createdAt).toBeUndefined();
  expect(account.updatedAt).toBeUndefined();
  expect(account.name).toBeTruthy();
  expect(account.id).toBeTruthy();
};

describe('Base Analytics', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  it('Members should be cleaned', async () => {
    // build app to be able to instantiate member data
    ({ app } = await build({ member: null }));

    const members = await saveMembers();

    const item = await rawItemRepository.save(FolderItemFactory({ creator: members[0] }));

    const chatMessages = [
      rawChatMessageRepository.create({
        item,
        creator: members[0],
        body: 'message',
      }),
    ];
    const apps = {
      [item.id]: {
        data: await saveAppData({ item, creator: members[0] }),
        actions: await saveAppActions({ item, member: members[0] }),
        settings: await saveAppSettings({ item, creator: members[0] }),
      },
    };
    const analytics = new BaseAnalytics({
      item,
      descendants,
      actions,
      members,
      itemMemberships,
      metadata,
      chatMessages,
      apps,
    });

    for (const m of members) {
      const member = analytics.members.find((me) => me.name === m.name) as AccountRaw | undefined;
      // lang exists
      if (m?.extra?.lang) {
        expect(member?.extra.lang).toBeTruthy();
      }
      expectMinimalAccountOrUndefined(member);
    }

    for (const cm of analytics.chatMessages) {
      expectMinimalAccountOrUndefined(cm.creator);
    }

    const {
      actions: appActions,
      data: appData,
      settings: appSettings,
    } = Object.values(analytics.apps)[0];
    for (const aa of appActions) {
      expectMinimalAccountOrUndefined(aa.account);
    }
    for (const ad of appData) {
      expectMinimalAccountOrUndefined(ad.account);
      expectMinimalAccountOrUndefined(ad.creator);
    }
    for (const as of appSettings) {
      expectMinimalAccountOrUndefined(as.creator);
    }
  });
});
