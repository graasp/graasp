import { ShortLink } from '@graasp/sdk';

import { ShortLink as Entity } from '../entities/ShortLink';

export class ShortLinkDTO {
  public static from({
    alias,
    platform,
    item,
  }: Pick<Entity, 'alias' | 'platform' | 'item'>): ShortLink {
    return {
      alias,
      platform,
      itemId: item.id,
    };
  }
}
