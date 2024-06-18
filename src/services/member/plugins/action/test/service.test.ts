import { FastifyBaseLogger } from 'fastify';

import build, { clearDatabase } from '../../../../../../test/app.js';
import { AppDataSource } from '../../../../../plugins/datasource.js';
import { UnauthorizedMember } from '../../../../../utils/errors.js';
import { buildRepositories } from '../../../../../utils/repositories.js';
import { Action } from '../../../../action/entities/action.js';
import { ActionService } from '../../../../action/services/action.js';
import { getMemberActions } from '../../../../action/test/fixtures/actions.js';
import { ItemService } from '../../../../item/service.js';
import { ThumbnailService } from '../../../../thumbnail/service.js';
import { MemberService } from '../../../service.js';
import { ActionMemberService } from '../service.js';
import { saveActionsWithItems } from './utils.js';

// mock datasource
jest.mock('../../../../../plugins/datasource');
const itemService = new ItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as FastifyBaseLogger,
);
const memberService = new MemberService();

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
