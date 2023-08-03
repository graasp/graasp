import { Context } from '@graasp/sdk';

import { CLIENT_HOSTS } from '../../utils/config';

const defaultClientHost = CLIENT_HOSTS.find((c) => c.name === Context.Builder);
if (!defaultClientHost) {
  throw new Error('Default Builder client host environment variable not set!');
}

const validOrigins = CLIENT_HOSTS.map((c) => c.url.origin);

export const getRedirectionUrl = (target?: string) => {
  if (!target) {
    return defaultClientHost.url.origin;
  }

  const targetUrl = new URL(target);
  if (!validOrigins.includes(targetUrl.origin)) {
    return defaultClientHost.url.origin;
  }

  return target;
};
