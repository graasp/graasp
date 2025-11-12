import { afterEach, describe, it, vi } from 'vitest';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { assertIsDefined } from '../../../../utils/assertions';
import { ExportDataRepository } from './memberExportData.repository';
import {
  actionSchema,
  appActionSchema,
  appDataSchema,
  appSettingSchema,
  itemBookmarkSchema,
  itemLikeSchema,
  itemMembershipSchema,
  itemSchema,
  messageMentionSchema,
  messageSchema,
} from './memberExportData.schemas';
import { expectNoLeaksAndEquality } from './test/fixtures';

/**
 * The repository tests ensure that no unwanted columns are leaked during the export.
 */
const repository = new ExportDataRepository();

describe('DataMember Export', () => {
  // let app: FastifyInstance;
  // let exportingActor;
  // let randomUser;
  // let item;
  // let itemOfRandomUser;

  // beforeEach(async () => {
  //   ({ app, actor: exportingActor } = await build());
  //   randomUser = await saveMember();

  //   item = await itemTestUtils.saveItem({ actor: exportingActor });
  //   itemOfRandomUser = await itemTestUtils.saveItem({ actor: randomUser });
  // });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('Actions', () => {
    it('get all Actions for the member', async () => {
      // save for exporting actor
      const {
        actor,
        actions: [a1, a2, _another1, _another2, ia1, ia2],
      } = await seedFromJson({
        actions: [
          { account: 'actor' },
          { account: 'actor' },
          // noise
          { account: { name: 'bob' } },
          { account: { name: 'bob' } },
        ],
        items: [{ actions: [{ account: 'actor' }, { account: 'actor' }] }],
      });
      assertIsDefined(actor);

      const results = await repository.getActions(db, actor.id);
      expectNoLeaksAndEquality(results, [a1, a2, ia1, ia2], actionSchema);
    });
  });

  describe('AppActions', () => {
    it('get all AppActions for the member', async () => {
      const {
        actor,
        appActions: [a1, a2],
      } = await seedFromJson({
        items: [
          {
            appActions: [
              { account: 'actor' },
              { account: 'actor' },
              { account: { name: 'bob' } },
              { account: { name: 'bob' } },
            ],
          },
        ],
      });
      assertIsDefined(actor);

      const results = await repository.getAppActions(db, actor.id);
      expectNoLeaksAndEquality(results, [a1, a2], appActionSchema);
    });
  });

  describe('AppData', () => {
    it('get all AppData for the member', async () => {
      const {
        actor,
        appData: [a1, a2, a3, a4],
      } = await seedFromJson({
        items: [
          {
            appData: [
              { account: 'actor', creator: 'actor' },
              { account: 'actor', creator: 'actor' },
              { account: { name: 'bob' }, creator: 'actor' },
              { account: { name: 'bob' }, creator: 'actor' },
              // noise
              { account: { name: 'bob' }, creator: { name: 'bob' } },
            ],
          },
        ],
      });
      assertIsDefined(actor);

      const results = await repository.getAppData(db, actor.id);
      expectNoLeaksAndEquality(results, [a1, a2, a3, a4], appDataSchema);
    });
  });

  describe('AppSettings', () => {
    it('get all AppSettings for the member', async () => {
      const {
        actor,
        appSettings: [a1, a2],
      } = await seedFromJson({
        items: [
          {
            appSettings: [
              { creator: 'actor' },
              { creator: 'actor' },
              // noise
              { creator: { name: 'bob' } },
            ],
          },
        ],
      });
      assertIsDefined(actor);

      const results = await repository.getAppSettings(db, actor.id);
      expectNoLeaksAndEquality(results, [a1, a2], appSettingSchema);
    });
  });

  describe('Chat', () => {
    describe('ChatMentions', () => {
      it('get all ChatMentions for the member', async () => {
        const {
          actor,
          chatMentions: [c1, _c, c2],
          chatMessages: [cm1, cm2],
        } = await seedFromJson({
          items: [
            {
              chatMessages: [
                { creator: 'actor', mentions: ['actor'] },
                { creator: 'actor', mentions: [{ name: 'bob' }, 'actor'] },
                // noise
                { creator: { name: 'bob' }, mentions: [{ name: 'bob' }] },
              ],
            },
          ],
        });
        assertIsDefined(actor);

        const results = await repository.getChatMentions(db, actor.id);

        // change message because date is slightly different
        expectNoLeaksAndEquality(
          results.map((r) => ({
            ...r,
            message: { ...r.message, createdAt: 'anything', updatedAt: 'anything' },
          })),
          [
            { ...c1, message: { ...cm1, createdAt: 'anything', updatedAt: 'anything' } },
            { ...c2, message: { ...cm2, createdAt: 'anything', updatedAt: 'anything' } },
          ],
          messageMentionSchema,
        );
      });
    });

    describe('ChatMessages', () => {
      it('get all Messages for the member', async () => {
        const {
          actor,
          chatMessages: [c1, c2],
        } = await seedFromJson({
          items: [
            {
              chatMessages: [
                { creator: 'actor', mentions: [{ name: 'bob' }] },
                { creator: 'actor', mentions: [{ name: 'cedric' }] },
                // noise
                { creator: { name: 'bob' }, mentions: [{ name: 'cedric' }] },
              ],
            },
          ],
        });
        assertIsDefined(actor);

        const results = await repository.getChatMessages(db, actor.id);

        expectNoLeaksAndEquality(results, [c1, c2], messageSchema);
      });
    });
  });

  describe('Items', () => {
    it('get all Items for the member', async () => {
      const {
        actor,
        items: [i1, i2],
      } = await seedFromJson({
        items: [
          {
            creator: 'actor',
          },
          {
            creator: 'actor',
          },
          // noise
          {
            creator: { name: 'bob' },
          },
        ],
      });
      assertIsDefined(actor);

      const results = await repository.getItems(db, actor.id);

      expectNoLeaksAndEquality(results, [i1, i2], itemSchema);
    });

    it('get all Item Bookmarks for the member', async () => {
      const { actor, bookmarks } = await seedFromJson({
        items: [
          {
            isBookmarked: true,
            creator: 'actor',
          },
          {
            isBookmarked: true,
            creator: { name: 'bob' },
          },
          // noise
          {
            creator: 'actor',
          },
        ],
      });
      assertIsDefined(actor);

      const results = await repository.getItemBookmarks(db, actor.id);
      expectNoLeaksAndEquality(results, bookmarks, itemBookmarkSchema);
    });

    it('get all Item Likes for the member', async () => {
      const { actor, likes } = await seedFromJson({
        items: [
          {
            likes: ['actor'],
            creator: 'actor',
          },
          {
            likes: ['actor'],
            creator: { name: 'bob' },
          },
          // noise
          {
            creator: 'actor',
          },
        ],
      });
      assertIsDefined(actor);

      const results = await repository.getItemLikes(db, actor.id);

      expectNoLeaksAndEquality(results, likes, itemLikeSchema);
    });

    it('get all Item Memberships for the member', async () => {
      const {
        actor,
        itemMemberships: [im1, im2, im3],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor' }, { creator: 'actor', account: { name: 'bob' } }],
          },
          {
            memberships: [{ account: 'actor' }],
          },
          // noise
          {
            memberships: [{ account: { name: 'bob' } }],
          },
        ],
      });
      assertIsDefined(actor);
      const results = await repository.getItemMemberships(db, actor.id);
      expectNoLeaksAndEquality(results, [im1, im2, im3], itemMembershipSchema);
    });
  });
});
