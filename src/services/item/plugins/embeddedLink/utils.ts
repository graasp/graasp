import isUrlHttp from 'is-url-http';

export const isValidUrl = (url: string) => {
  return isUrlHttp(ensureProtocol(url));
};

export const ensureProtocol = (url: string) => {
  if (!/^https?:\/\//i.test(url)) {
    return 'https://' + url;
  }
  return url;
};
