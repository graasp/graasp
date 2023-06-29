import build, { clearDatabase } from '../../../../../test/app';
import { ChatMessageRepository } from '../../../chat/repository';
import { Member } from '../../../member/entities/member';
import { BOB, CEDRIC, MEMBERS, saveMember } from '../../../member/test/fixtures/members';
import { Item } from '../../entities/Item';
import { getDummyItem } from '../../test/fixtures/items';
import { BaseAnalytics } from './base-analytics';

const item = {} as unknown as Item;
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

  it('Members should be cleaned', async () => {
    // build app to be able to instantiate member data
    ({ app } = await build({ member: null }));

    const members: Member[] = [];
    const data: Partial<Member>[] = [BOB, CEDRIC];
    for (const m of data) {
      members.push(await saveMember(m));
    }
    const chatMessages = [
      await ChatMessageRepository.create({
        item: getDummyItem(),
        creator: MEMBERS[0] as Member,
        body: 'message',
      }),
    ];
    const analytics = new BaseAnalytics({
      item,
      descendants,
      actions,
      members,
      itemMemberships,
      metadata,
      chatMessages,
    });

    for (const m of data) {
      const member = analytics.members.find((me) => me.name === m.name);

      // lang exists
      if (m?.extra?.lang) {
        expect(member?.extra.lang).toBeTruthy();
      }
      // no favorites
      expect(member?.extra.favoriteItems).toBeUndefined();
      expect(member?.createdAt).toBeUndefined();
    }

    for (const cm of analytics.chatMessages) {
      expect(cm.creator?.createdAt).toBeUndefined();
    }
  });
});
