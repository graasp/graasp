import { v4 } from 'uuid';

import { Item, Member, MemberType } from '@graasp/sdk';

import { BaseAnalytics } from './base-analytics';

const item = {} as unknown as Item;
const descendants = [];
const actions = [];
const itemMemberships = [];
const metadata = {
  numActionsRetrieved: 0,
  requestedSampleSize: 0,
};

describe('Base Analytics', () => {
  it('Members should be cleaned', () => {
    const members: Member[] = [
      {
        id: v4(),
        name: 'member-1',
        email: 'member-1@email.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: MemberType.Individual,
        extra: {
          lang: 'en',
          favoriteItems: [],
        },
        password: 'my-password',
      },
      {
        id: v4(),
        name: 'member-1',
        email: 'member-1@email.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: MemberType.Individual,
        extra: {
          lang: 'fr',
          favoriteItems: [],
        },
        password: 'my-password-2',
      },
    ];

    const analytics = new BaseAnalytics({
      item,
      descendants,
      actions,
      members,
      itemMemberships,
      metadata,
    });

    for (const m of analytics.members) {
      // lang exists
      expect(m.extra.lang).toBeTruthy();

      // no password
      expect(m.password).toBeUndefined();

      // no favorites
      expect(m.extra.favoriteItems).toBeUndefined();
    }
  });
});
