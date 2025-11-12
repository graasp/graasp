import { describe, expect, it } from 'vitest';

import { ItemType } from '@graasp/sdk';

import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { assertIsDefined } from '../../../../../utils/assertions';
import { assertIsMemberForTest } from '../../../../authentication';
import { ActionRequestExportRepository } from './itemAction.requestExport.repository';

const actionRequestExportRepository = new ActionRequestExportRepository();

describe('Action Request Export Repository', () => {
  describe('getAccountsForTree', () => {
    it('Get accounts from memberships', async () => {
      const {
        actor,
        members: [bob],
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor' }, { account: { name: 'bob' } }] }],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      expect(await actionRequestExportRepository.getAccountsForTree(db, item.path)).toEqual(
        expect.arrayContaining([
          { name: actor.name, id: actor.id },
          { id: bob.id, name: bob.name },
        ]),
      );
    });
    it('Returns all descendants', async () => {
      const { items } = await seedFromJson({
        actor: null,
        items: [{ children: [{}, { children: [{}] }] }, {}],
      });

      // remove noise
      items.pop();

      expect(await actionRequestExportRepository.getItemTree(db, items[0].path)).toEqual(
        expect.arrayContaining(items),
      );
    });
  });
  describe('getItemTree', () => {
    it('No children returns self', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      expect(await actionRequestExportRepository.getItemTree(db, item.path)).toEqual([item]);
    });
    it('Returns all descendants', async () => {
      const { items } = await seedFromJson({
        actor: null,
        items: [{ children: [{}, { children: [{}] }] }, {}],
      });

      // remove noise
      items.pop();

      expect(await actionRequestExportRepository.getItemTree(db, items[0].path)).toEqual(
        expect.arrayContaining(items),
      );
    });
  });
  describe('getItemMembershipsForTree', () => {
    it('Get memberships', async () => {
      const {
        items: [item],
        itemMemberships: [im1, im2],
      } = await seedFromJson({
        items: [
          { memberships: [{ account: 'actor' }, { account: { name: 'bob' } }] },
          // noise
          { memberships: [{ account: 'actor' }, { account: { name: 'bob' } }] },
        ],
      });

      expect(await actionRequestExportRepository.getItemMembershipsForTree(db, item.path)).toEqual([
        im1,
        im2,
      ]);
    });
  });
  describe('getChatMessagesForTree', () => {
    it('Get memberships', async () => {
      const {
        items: [item],
        chatMessages: [m1, m2],
      } = await seedFromJson({
        items: [
          { chatMessages: [{ creator: 'actor' }, { creator: { name: 'bob' } }] },
          // noise
          { chatMessages: [{ creator: 'actor' }, { creator: { name: 'bob' } }] },
        ],
      });

      expect(await actionRequestExportRepository.getChatMessagesForTree(db, item.path)).toEqual([
        m1,
        m2,
      ]);
    });
  });
  describe('getAppDataForTree', () => {
    it('Get no app data', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.APP,
          },
          // noise
          {
            type: ItemType.APP,
            appData: [
              { account: 'actor', creator: 'actor' },
              { account: { name: 'bob' }, creator: { name: 'bob' } },
            ],
          },
        ],
      });

      expect(await actionRequestExportRepository.getAppDataForTree(db, item.path)).toHaveLength(0);
    });
    it('Get app data', async () => {
      const {
        items: [item],
        appData: [a1, a2],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.APP,
            appData: [
              { account: 'actor', creator: 'actor' },
              { account: { name: 'bob' }, creator: { name: 'bob' } },
            ],
          },
          // noise
          {
            type: ItemType.APP,
            appData: [
              { account: 'actor', creator: 'actor' },
              { account: { name: 'bob' }, creator: { name: 'bob' } },
            ],
          },
        ],
      });

      expect(await actionRequestExportRepository.getAppDataForTree(db, item.path)).toEqual([
        a1,
        a2,
      ]);
    });
  });
  describe('getAppActionsForTree', () => {
    it('Get no app action', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.APP,
          },
          // noise
          {
            type: ItemType.APP,
            appActions: [{ account: 'actor' }, { account: { name: 'bob' } }],
          },
        ],
      });

      expect(await actionRequestExportRepository.getAppActionsForTree(db, item.path)).toHaveLength(
        0,
      );
    });
    it('Get app actions', async () => {
      const {
        items: [item],
        appActions: [a1, a2],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.APP,
            appActions: [{ account: 'actor' }, { account: { name: 'bob' } }],
          },
          // noise
          {
            type: ItemType.APP,
            appActions: [{ account: 'actor' }, { account: { name: 'bob' } }],
          },
        ],
      });

      expect(await actionRequestExportRepository.getAppActionsForTree(db, item.path)).toEqual([
        a1,
        a2,
      ]);
    });
  });
  describe('getAppSettingsForTree', () => {
    it('Get no app setting', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.APP,
          },
          // noise
          {
            type: ItemType.APP,
            appSettings: [{ creator: 'actor' }, { creator: { name: 'bob' } }],
          },
        ],
      });

      expect(await actionRequestExportRepository.getAppDataForTree(db, item.path)).toHaveLength(0);
    });
    it('Get app data', async () => {
      const {
        items: [item],
        appSettings: [a1, a2],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.APP,
            appSettings: [{ creator: 'actor' }, { creator: { name: 'bob' } }],
          },
          // noise
          {
            type: ItemType.APP,
            appSettings: [{ creator: 'actor' }, { creator: { name: 'bob' } }],
          },
        ],
      });

      expect(await actionRequestExportRepository.getAppSettingsForTree(db, item.path)).toEqual([
        a1,
        a2,
      ]);
    });
  });
});
