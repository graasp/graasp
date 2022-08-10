import { Action, ActionBuilder, ActionType, Context, HttpMethod, Member } from '@graasp/sdk';

import { paths } from '../../../util/paths';

// TODO: add mobile actions
// todo: refactor query ids, body
export const authActionBuilder: (args?: { member?: Member }) => ActionBuilder =
  ({ member } = {}) =>
  async ({ request, log }) => {
    // function called each time there is a request in the items in graasp (onResponse hook in graasp)
    // identify and check the correct endpoint of the request
    const { method, url, query } = request;
    // warning: this is really dependent on the url -> how to be more safe and dynamic?
    let queryItemIds = (query as { id })?.id;
    if (!Array.isArray(queryItemIds)) {
      queryItemIds = [queryItemIds];
    }

    const actions: (Partial<Action> & { actionType: string })[] = [];

    // identify the endpoint with method and url
    switch (method) {
      case HttpMethod.GET:
        switch (true) {
          case paths.authSignOut.test(url):
            const memberId = request.member.id;
            actions.push({
              actionType: ActionType.AUTH_SIGN_OUT,
              extra: { memberId },
              memberId,
            });
            // todo: add shouldSaveAForMember
            break;
        }
        break;
      case HttpMethod.POST:
        switch (true) {
          case paths.authRegister.test(url):
            const memberId = member.id;
            actions.push({
              actionType: ActionType.AUTH_REGISTER,
              view: Context.BUILDER,
              extra: { memberId },
              memberId,
              memberType: member.type,
            });
            // todo: add should save

            break;
          case paths.authSignIn.test(url):
            actions.push({
              actionType: ActionType.AUTH_SIGN_IN,
              extra: { memberId },
            });

            // todo: add shouldSaveAForMember
            break;
          case paths.authSignInPassword.test(url):
            actions.push({
              actionType: ActionType.AUTH_SIGN_IN_PASSWORD,
              extra: { memberId },
            });
            // todo: add shouldSaveAForMember
            break;
        }
        break;
      case HttpMethod.PATCH:
        switch (true) {
          case paths.authUpdatePassword.test(url):
            // warning: no check over membership !
            actions.push({
              actionType: ActionType.AUTH_UPDATE_PASSWORD,
              extra: { memberId: request.member.id },
            });
            break;
        }
        break;
      default:
        log.debug('action: request does not match any allowed routes.');
        break;
    }

    return actions;
  };
