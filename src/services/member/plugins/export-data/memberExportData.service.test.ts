import { MemberFactory } from '../../../../../test/factories/member.factory';
import { db } from '../../../../drizzle/db';
import type { MinimalMember } from '../../../../types';
import { ChatMessageWithMentionFactory } from '../../../chat/test/fixtures';
import { ExportDataRepository } from './memberExportData.repository';
import { ExportMemberDataService } from './memberExportData.service';
import { expectNoLeakMemberId } from './test/fixtures';
import { RequestDataExportService } from './utils/export.utils';

const exportDataRepository = new ExportDataRepository();

const service = new ExportMemberDataService({} as RequestDataExportService, exportDataRepository);

const checkNoMemberIdLeaks = <T>({
  results,
  exportingActor,
  randomUser,
}: {
  results: T[];
  exportingActor: MinimalMember;
  randomUser: MinimalMember;
}) => {
  expect(results.length).toBeGreaterThan(0);

  results.forEach((resource) => {
    expectNoLeakMemberId({
      resource,
      exportActorId: exportingActor.id,
      memberId: randomUser.id,
    });
  });
};

describe('DataMember Export', () => {
  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('Chat', () => {
    describe('ChatMentions', () => {
      it('another member id is not leak', async () => {
        const actor = MemberFactory();
        const member1 = MemberFactory();

        // returns mention to self without creator
        const { chatMention, chatMessage } = ChatMessageWithMentionFactory({
          creator: member1,
          mentionMember: actor,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { creatorId, ...cm } = chatMessage;

        jest
          .spyOn(exportDataRepository, 'getChatMentions')
          .mockResolvedValue([{ ...chatMention, message: cm }]);

        const results = await service.getChatMentions(db, actor);

        checkNoMemberIdLeaks({ results, exportingActor: actor, randomUser: member1 });
      });
    });
    describe('ChatMessages', () => {
      it('member id is not leak', async () => {
        const actor = MemberFactory();
        const member1 = MemberFactory();
        const member2 = MemberFactory();
        const member3 = MemberFactory();

        jest.spyOn(exportDataRepository, 'getChatMessages').mockResolvedValue([
          ChatMessageWithMentionFactory({
            creator: actor,
            mentionMember: member1,
          }).chatMessage,
          ChatMessageWithMentionFactory({
            creator: actor,
            mentionMember: member2,
          }).chatMessage,
          ChatMessageWithMentionFactory({
            creator: actor,
            mentionMember: member3,
          }).chatMessage,
        ]);

        const results = await service.getChatMessages(db, actor);

        checkNoMemberIdLeaks({ results, exportingActor: actor, randomUser: member1 });
        checkNoMemberIdLeaks({ results, exportingActor: actor, randomUser: member2 });
        checkNoMemberIdLeaks({ results, exportingActor: actor, randomUser: member3 });
      });
    });
  });
});
