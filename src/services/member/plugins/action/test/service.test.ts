import build, { MOCK_LOGGER, clearDatabase } from '../../../../../../test/app.js';
import { resolveDependency } from '../../../../../di/utils.js';
import { asDefined } from '../../../../../utils/assertions.js';
import { getMemberActions } from '../../../../action/test/fixtures/actions.js';
import { saveActions } from '../../../../item/plugins/action/test/fixtures/actions.js';
import { ItemService } from '../../../../item/service.js';
import { MemberService } from '../../../member.service.js';
import { ActionMemberService } from '../service.js';
import { generateActionsWithItems } from './utils.js';

const rawRepository = AppDataSource.getRepository(Action);

const getActionMemberService = () => {
  const itemService = resolveDependency(ItemService);
  const memberService = resolveDependency(MemberService);

  const actionService = new ActionService(itemService, memberService, MOCK_LOGGER);
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
      await generateActionsWithItems(member);
      await saveActions(rawRepository, actions);
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
      await generateActionsWithItems(member, { saveActionForNotOwnedItem: true });
      await saveActions(rawRepository, actions);
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
