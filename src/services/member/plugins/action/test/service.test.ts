import { FastifyBaseLogger } from 'fastify';

import build, { clearDatabase } from '../../../../../../test/app';
import { AppDataSource } from '../../../../../plugins/datasource';
import { MailerDecoration } from '../../../../../plugins/mailer';
import { UnauthorizedMember } from '../../../../../utils/errors';
import { buildRepositories } from '../../../../../utils/repositories';
import { Action } from '../../../../action/entities/action';
import { ActionService } from '../../../../action/services/action';
import { getMemberActions } from '../../../../action/test/fixtures/actions';
import { ItemService } from '../../../../item/service';
import { ThumbnailService } from '../../../../thumbnail/service';
import { MemberService } from '../../../service';
import { ActionMemberService } from '../service';
import { saveActionsWithItems } from './utils';

// mock datasource
jest.mock('../../../../../plugins/datasource');
const itemService = new ItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as FastifyBaseLogger,
);
const memberService = new MemberService(
  {} as unknown as MailerDecoration,
  {} as unknown as FastifyBaseLogger,
);

const actionService = new ActionService(itemService, memberService);
const service = new ActionMemberService(actionService);
const rawRepository = AppDataSource.getRepository(Action);

describe('Action member service', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('Test getFilteredActions', () => {
    it('throw for signed out user', async () => {
      ({ app } = await build({ member: null }));

      await service.getFilteredActions(actor, buildRepositories(), {}).catch((e) => {
        expect(e).toBeInstanceOf(UnauthorizedMember);
      });
    });

    it('get filtered actions by start and end date for auth member ', async () => {
      ({ app, actor } = await build());
      await saveActionsWithItems(actor);
      const result = await service.getFilteredActions(actor, buildRepositories(), {});
      expect(result).toHaveLength(2);
    });

    it("get filtered actions by start and end date for auth member shouldn't contain actions for items with no permisson", async () => {
      ({ app, actor } = await build());
      await saveActionsWithItems(actor, { saveActionForNotOwnedItem: true });
      const result = await service.getFilteredActions(actor, buildRepositories(), {});
      const allMemberActions = await getMemberActions(rawRepository, actor.id);
      // as there's an action user don't have permission over the item so he will not get
      expect(allMemberActions.length).not.toEqual(result.length);
    });
  });
});
