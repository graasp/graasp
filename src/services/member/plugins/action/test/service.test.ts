import build, { clearDatabase } from '../../../../../../test/app';
import { resolveDependency } from '../../../../../dependencies';
import { AppDataSource } from '../../../../../plugins/datasource';
import { UnauthorizedMember } from '../../../../../utils/errors';
import { buildRepositories } from '../../../../../utils/repositories';
import { Action } from '../../../../action/entities/action';
import { ActionService } from '../../../../action/services/action';
import { getMemberActions } from '../../../../action/test/fixtures/actions';
import { ItemService } from '../../../../item/service';
import { MemberService } from '../../../service';
import { ActionMemberService } from '../service';
import { saveActionsWithItems } from './utils';

// mock datasource
jest.mock('../../../../../plugins/datasource');

const rawRepository = AppDataSource.getRepository(Action);
// TODO: use resolve when the ActionMemberService is migrated to DI
const getActionMemberService = () => {
  const itemService = resolveDependency(ItemService);
  const memberService = resolveDependency(MemberService);

  const actionService = new ActionService(itemService, memberService);
  const actionMemberService = new ActionMemberService(actionService);

  return actionMemberService;
};

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

      await getActionMemberService()
        .getFilteredActions(actor, buildRepositories(), {})
        .catch((e) => {
          expect(e).toBeInstanceOf(UnauthorizedMember);
        });
    });

    it('get filtered actions by start and end date for auth member ', async () => {
      ({ app, actor } = await build());
      await saveActionsWithItems(actor);
      const result = await getActionMemberService().getFilteredActions(
        actor,
        buildRepositories(),
        {},
      );
      expect(result).toHaveLength(2);
    });

    it("get filtered actions by start and end date for auth member shouldn't contain actions for items with no permisson", async () => {
      ({ app, actor } = await build());
      await saveActionsWithItems(actor, { saveActionForNotOwnedItem: true });
      const result = await getActionMemberService().getFilteredActions(
        actor,
        buildRepositories(),
        {},
      );
      const allMemberActions = await getMemberActions(rawRepository, actor.id);
      // as there's an action user don't have permission over the item so he will not get
      expect(allMemberActions.length).not.toEqual(result.length);
    });
  });
});
