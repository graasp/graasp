import { CLIENT_HOST, CLIENT_HOSTS } from '../../utils/config';

export const getRedirectionUrl = (url?: string) => {
  // TODO: improve check
  if (!url || !CLIENT_HOSTS.some(({ hostname }) => url.startsWith(hostname))) {
    return CLIENT_HOST;
  }
  return url;
};
