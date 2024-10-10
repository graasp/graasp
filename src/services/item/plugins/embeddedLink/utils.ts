import urlHttp from 'url-http';

export const isValidUrl = (url: string): boolean => {
  // url-http returns the URL href or false if it is not a URL
  return Boolean(urlHttp(ensureProtocol(url)));
};

export const ensureProtocol = (url: string) => {
  if (!/^https?:\/\//i.test(url)) {
    return 'https://' + url;
  }
  return url;
};
