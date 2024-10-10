import urlHttp from 'url-http';

export const isValidUrl = (url: string): boolean => {
  return !!urlHttp(ensureProtocol(url));
};

export const ensureProtocol = (url: string) => {
  if (!/^https?:\/\//i.test(url)) {
    return 'https://' + url;
  }
  return url;
};
