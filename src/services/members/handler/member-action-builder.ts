import { Action, ActionBuilder, ActionType, HttpMethod } from '@graasp/sdk';

import { paths } from '../../../util/paths';

// todo: refactor query ids, body
export const memberActionBuilder: () => ActionBuilder =
  () =>
  async ({ request, log }) => {
    // function called each time there is a request in the items in graasp (onResponse hook in graasp)
    // identify and check the correct endpoint of the request
    const { method, url, query, params, body: rawBody } = request;
    const body = rawBody as object;
    // warning: this is really dependent on the url -> how to be more safe and dynamic?
    const paramItemId: string = (params as { id: string })?.id;
    let queryItemIds = (query as { id })?.id;
    if (!Array.isArray(queryItemIds)) {
      queryItemIds = [queryItemIds];
    }

    const actions: (Partial<Action> & { actionType: string })[] = [];

    // identify the endpoint with method and url
    switch (method) {
      case HttpMethod.PATCH:
        switch (true) {
          case paths.baseMember.test(url):
            // warning: no check over membership !
            actions.push({
              actionType: ActionType.UPDATE_MEMBER,
              extra: { memberId: paramItemId, ...body },
            });
            // todo: should save
            break;
        }
        break;
      case HttpMethod.DELETE:
        switch (true) {
          case paths.baseMember.test(url):
            // warning: no check over membership !
            actions.push({
              actionType: ActionType.DELETE_MEMBER,
              extra: { memberId: paramItemId },
            });
            // todo: should save

            break;
        }
        break;
      default:
        log.debug('action: request does not match any allowed routes.');
        break;
    }

    return actions;
  };
