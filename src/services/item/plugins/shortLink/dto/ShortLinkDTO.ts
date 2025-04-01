import { ShortLink } from '@graasp/sdk';

import { ShortLinkRaw } from '../../../../../drizzle/types';

export class ShortLinkDTO {
  /**
   * Strip sensible data
   */
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
