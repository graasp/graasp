import build, { clearDatabase } from '../../../../../../test/app';
import { resolveDependency } from '../../../../../di/utils';
import { AppDataSource } from '../../../../../plugins/datasource';
import { asDefined } from '../../../../../utils/assertions';
import { buildRepositories } from '../../../../../utils/repositories';
import { Action } from '../../../../action/entities/action';
import { ActionService } from '../../../../action/services/action';
import { getMemberActions } from '../../../../action/test/fixtures/actions';
import { ItemService } from '../../../../item/service';
import { Member } from '../../../entities/member';
import { MemberService } from '../../../service';
import { ActionMemberService } from '../service';
import { saveActionsWithItems } from './utils';

const rawRepository = AppDataSource.getRepository(Action);

const getActionMemberService = () => {
  const itemService = resolveDependency(ItemService);
  const memberService = resolveDependency(MemberService);

  const actionService = new ActionService(itemService, memberService);
  const actionMemberService = new ActionMemberService(actionService);

  return actionMemberService;
};

describe('Action member service', () => {
  let app;
  let actor: Member | undefined;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('Test getFilteredActions', () => {
    it('get filtered actions by start and end date for auth member ', async () => {
      ({ app, actor } = await build());
      const member = asDefined(actor);
      await saveActionsWithItems(member);
      const result = await getActionMemberService().getFilteredActions(
        member,
        buildRepositories(),
        {},
      );
      expect(result).toHaveLength(2);
    });

    it("get filtered actions by start and end date for auth member shouldn't contain actions for items with no permisson", async () => {
      ({ app, actor } = await build());
      const member = asDefined(actor);
      await saveActionsWithItems(member, { saveActionForNotOwnedItem: true });
      const result = await getActionMemberService().getFilteredActions(
        member,
        buildRepositories(),
        {},
      );
      const allMemberActions = await getMemberActions(rawRepository, member.id);
      // as there's an action user don't have permission over the item so he will not get
      expect(allMemberActions.length).not.toEqual(result.length);
    });
  });
});
