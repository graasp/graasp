import build, { clearDatabase } from '../../../../../test/app';
import { ChatMessageRepository } from '../../../chat/repository';
import { Member } from '../../../member/entities/member';
import { BOB, CEDRIC, saveMember } from '../../../member/test/fixtures/members';
import { ItemRepository } from '../../repository';
import { getDummyItem } from '../../test/fixtures/items';
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

// mock database and decorator plugins
jest.mock('../../../../plugins/datasource');

describe('Base Analytics', () => {
  let app;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  it.only('Members should be cleaned', async () => {
    // build app to be able to instantiate member data
    ({ app } = await build({ member: null }));

    const members: Member[] = [];
    const data: Partial<Member>[] = [BOB, CEDRIC];
    for (const m of data) {
      members.push(await saveMember(m));
    }

    const item = await ItemRepository.save(getDummyItem({ creator: members[0] }));

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

    for (const m of data) {
      const member = analytics.members.find((me) => me.name === m.name);

      // lang exists
      if (m?.extra?.lang) {
        expect(member?.extra.lang).toBeTruthy();
      }
      expect(member?.createdAt).toBeUndefined();
    }

    for (const cm of analytics.chatMessages) {
      expect(cm.creator?.createdAt).toBeUndefined();
    }

    const {
      actions: appActions,
      data: appData,
      settings: appSettings,
    } = Object.values(analytics.apps)[0];
    for (const aa of appActions) {
      expect(aa.member?.createdAt).toBeUndefined();
    }
    for (const ad of appData) {
      expect(ad.member?.createdAt).toBeUndefined();
      expect(ad.creator?.createdAt).toBeUndefined();
    }
    for (const as of appSettings) {
      expect(as.creator?.createdAt).toBeUndefined();
    }
  });
});
