import { ShortLink } from '@graasp/sdk';

import { ShortLinkRaw } from '../../../../../drizzle/types.js';

export class ShortLinkDTO {
  public static from({
    alias,
    platform,
    itemId,
  }: Pick<ShortLinkRaw, 'alias' | 'platform' | 'itemId'>): ShortLink {
    return {
      alias,
      platform,
      itemId,
    };
  }
}
