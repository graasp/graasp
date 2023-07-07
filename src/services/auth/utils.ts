import { Context } from '@graasp/sdk';

import { CLIENT_HOSTS } from '../../utils/config';

const defaultClientHost = CLIENT_HOSTS.find((c) => c.name === Context.Builder);
if (!defaultClientHost) {
  throw new Error('Default Builder client host environment variable not set!');
}

export const getRedirectionUrl = (url?: string) => {
  // TODO: improve check
  // TODO: whitelist graasp domains for redirection
  if (!url || !CLIENT_HOSTS.some(({ hostname }) => url.startsWith(hostname))) {
    return defaultClientHost.hostname;
  }
  return url;
};
