import type { FastifyBaseLogger } from 'fastify';

import { ClientManager, Context } from '@graasp/sdk';

import { ALLOWED_ORIGINS } from '../../utils/config';

const defaultClientHost = ClientManager.getInstance().getLinkByContext(Context.Home);

export const getRedirectionLink = (log: FastifyBaseLogger, target?: string) => {
  if (!target) {
    return defaultClientHost;
  }

  try {
    const targetUrl = new URL(target);
    if (!ALLOWED_ORIGINS.includes(targetUrl.origin)) {
      log.error(
        `redirection-url-util: Attempted to use a non valid origin  (url: ${targetUrl.toString()})`,
      );
      return defaultClientHost;
    }
  } catch {
    return defaultClientHost;
  }

  return target;
};
