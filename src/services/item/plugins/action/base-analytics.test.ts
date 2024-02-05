import { FolderItemFactory } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { ChatMessageRepository } from '../../../chat/repository';
import { Member } from '../../../member/entities/member';
import { saveMembers } from '../../../member/test/fixtures/members';
import { ItemRepository } from '../../repository';
import { saveAppActions } from '../app/appAction/test/index.test';
import { saveAppData } from '../app/appData/test/index.test';
import { saveAppSettings } from '../app/appSetting/test/index.test';
import { BaseAnalytics } from './base-analytics';

const descendants = [];
const actions = [];
const itemMemberships = [];
const metadata = {
  numActionsRetrieved: 0,
  requestedSampleSize: 0,
};

const expectMinimalMemberOrUndefined = (member?: Partial<Member> | null) => {
  if (!member) {
    return;
  }

  expect(member.createdAt).toBeUndefined();
  expect(member.updatedAt).toBeUndefined();
  expect(member.name).toBeTruthy();
  expect(member.id).toBeTruthy();
  expect(member.email).toBeTruthy();
};

// mock database and decorator plugins
jest.mock('../../../../plugins/datasource');

describe('Base Analytics', () => {
  let app;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  it('Members should be cleaned', async () => {
    // build app to be able to instantiate member data
    ({ app } = await build({ member: null }));

    const members = await saveMembers();

    const item = await ItemRepository.save(FolderItemFactory({ creator: members[0] }));

    const chatMessages = [
      await ChatMessageRepository.create({
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
      const member = analytics.members.find((me) => me.name === m.name);

      // lang exists
      if (m?.extra?.lang) {
        expect(member?.extra.lang).toBeTruthy();
      }
      expectMinimalMemberOrUndefined(member);
    }

    for (const cm of analytics.chatMessages) {
      expectMinimalMemberOrUndefined(cm.creator);
    }

    const {
      actions: appActions,
      data: appData,
      settings: appSettings,
    } = Object.values(analytics.apps)[0];
    for (const aa of appActions) {
      expectMinimalMemberOrUndefined(aa.member);
    }
    for (const ad of appData) {
      expectMinimalMemberOrUndefined(ad.member);
      expectMinimalMemberOrUndefined(ad.creator);
    }
    for (const as of appSettings) {
      expectMinimalMemberOrUndefined(as.creator);
    }
  });
});
