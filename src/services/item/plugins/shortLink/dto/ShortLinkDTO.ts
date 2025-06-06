import type { ShortLink } from '@graasp/sdk';

import type { ShortLinkRaw } from '../../../../../drizzle/types';

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
