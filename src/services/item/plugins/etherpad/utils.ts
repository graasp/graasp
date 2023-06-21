import { EtherpadPluginOptions } from './types';

export function validatePluginOptions(options: EtherpadPluginOptions) {
  const { url, apiKey } = options;

  if (!url) {
    throw new Error('Etherpad url environment variable is not defined!');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Etherpad url environment variable must contain protocol!');
  }

  const publicUrl = options.publicUrl ?? url;

  const cookieDomain = options.cookieDomain ?? new URL(publicUrl).hostname;

  if (!apiKey) {
    throw new Error('Etherpad API key environment variable is not defined!');
  }

  if (!apiKey.match(/^[a-f\d]{64}$/)) {
    throw new Error('Etherpad API key environment variable format must be /^[a-fd]{64}$/');
  }

  return {
    ...options,
    publicUrl,
    cookieDomain,
  };
}
