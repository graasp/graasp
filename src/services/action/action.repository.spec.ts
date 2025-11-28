import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { Context } from '@graasp/sdk';

import { ActionFactory } from '../../../test/factories/action.factory';
import { type SeedActor, seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { actionsTable } from '../../drizzle/schema';
import { assertIsDefined } from '../../utils/assertions';
import { assertIsMemberForTest } from '../authentication';
import { getPreviousMonthFromNow } from '../member/plugins/action/memberAction.service';
import { ActionRepository } from './action.repository';
import { DEFAULT_ACTIONS_SAMPLE_SIZE } from './constants';
import { expectActions } from './test/fixtures/actions';

const actionRepository = new ActionRepository();

const getActionsByAccountId = async (accountId: string) => {
  return await db.query.actionsTable.findMany({ where: eq(actionsTable.accountId, accountId) });
};

describe('Action Repository', () => {
  describe('postMany', () => {
    it('save many actions', async () => {
      const actions = [ActionFactory(), ActionFactory(), ActionFactory(), ActionFactory()];

      await actionRepository.postMany(db, actions);

      for (const a of actions) {
        const savedAction = await db.query.actionsTable.findFirst({
          where: and(eq(actionsTable.type, a.type), eq(actionsTable.view, a.view)),
        });
        expect(savedAction).toBeDefined();
      }
    });
  });

  describe('deleteAllForAccount', () => {
    it('delete all actions for member', async () => {
      const {
        actor,
        members: [bob],
      } = await seedFromJson({
        actions: [
          { account: 'actor' },
          { account: 'actor' },
          { account: 'actor' },
          { account: 'actor' },
          // noise
          { account: { name: 'bob' } },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      expect(await getActionsByAccountId(actor.id)).toHaveLength(4);

      await actionRepository.deleteAllForAccount(db, actor.id);

      expect(await getActionsByAccountId(actor.id)).toHaveLength(0);
      // contains at least bob's actions
      expect(await getActionsByAccountId(bob.id)).toHaveLength(1);
    });
  });

  describe('getAccountActions', () => {
    it('get actions for member within the last month', async () => {
      const { actor } = await seedFromJson({
        actions: [
          {
            account: 'actor',
            createdAt: new Date().toISOString(),
          },
          {
            account: 'actor',
            createdAt: new Date().toISOString(),
          },
          {
            createdAt: new Date('1999-07-08').toISOString(),
            account: 'actor',
          },
          {
            account: 'actor',
            createdAt: new Date().toISOString(),
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const result = await actionRepository.getAccountActions(db, actor.id, {
        startDate: getPreviousMonthFromNow(),
        endDate: new Date(),
      });

      expect(result.length).toEqual(3);
    });
  });

  describe('getForItem', () => {
    it('get all actions for item', async () => {
      const {
        actions,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              { account: 'actor', createdAt: '2025-03-25T13:02:29.210Z' },
              { account: 'actor', createdAt: '2025-03-25T13:02:29.210Z' },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, item.path, {
        endDate: '2025-03-25T15:02:29.210Z',
      });

      expectActions(
        result,
        actions.map((a) => ({ ...a, item })),
      );
    });

    it('get all actions for item for max sampleSize', async () => {
      const {
        actions: [action1, action2, actions3],
        items: [item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              { account: 'actor', createdAt: '2025-03-25T12:02:29.210Z' },
              { account: 'actor', createdAt: '2025-03-25T13:02:29.210Z' },
              { account: 'actor', createdAt: '2025-03-25T13:02:29.210Z' },
              // noise - out of sample size because is older
              { account: 'actor', createdAt: '2025-03-25T11:02:29.210Z' },
              // noise - out of date range
              { account: 'actor', createdAt: '2020-03-25T13:02:29.210Z' },
              { account: 'actor', createdAt: '2020-03-25T13:02:29.210Z' },
            ],
          },
        ],
      });

      const sampleSize = 3;
      const result = await actionRepository.getForItem(db, item.path, {
        sampleSize,
        endDate: '2025-03-25T15:02:29.210Z',
      });

      expectActions(result, [
        { ...action1, item },
        { ...action2, item },
        { ...actions3, item },
      ]);
    });

    it('get all actions for item for default sampleSize', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              ...Array.from({ length: DEFAULT_ACTIONS_SAMPLE_SIZE }, () => ({
                account: 'actor' as SeedActor,
                createdAt: '2025-03-25T13:02:29.210Z',
              })),
              // noise - out of date range
              { account: 'actor', createdAt: '2020-03-25T13:02:29.210Z' },
              { account: 'actor', createdAt: '2020-03-25T13:02:29.210Z' },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, item.path, {
        endDate: '2025-03-25T15:02:29.210Z',
      });

      expect(result).toHaveLength(DEFAULT_ACTIONS_SAMPLE_SIZE);
    });

    it('get all actions for item for view', async () => {
      const view = Context.Builder;

      const {
        actions: [action1, action2, actions3],
        items: [item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              { view, account: 'actor', createdAt: '2025-03-25T12:02:29.210Z' },
              { view, account: 'actor', createdAt: '2025-03-25T13:02:29.210Z' },
              { view, account: 'actor', createdAt: '2025-03-25T13:02:29.210Z' },
              // noise - another view
              { view: Context.Account, account: 'actor' },
              { view: Context.Library, account: 'actor' },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, item.path, {
        view,
        endDate: '2025-03-25T15:02:29.210Z',
      });

      expectActions(
        result,
        [action1, action2, actions3].map((a) => ({ ...a, item })),
      );
    });

    it('get all actions for item for member Id', async () => {
      const {
        actions: [action1, action2, actions3],
        items: [item],
        members: [member],
      } = await seedFromJson({
        items: [
          {
            actions: [
              { account: { name: 'bob' }, createdAt: '2025-03-25T12:02:29.210Z' },
              { account: { name: 'bob' }, createdAt: '2025-03-25T13:02:29.210Z' },
              { account: { name: 'bob' }, createdAt: '2025-03-25T13:02:29.210Z' },
              // noise - another account
              { account: 'actor' },
              { account: 'actor' },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, item.path, {
        accountId: member.id,
        endDate: '2025-03-25T15:02:29.210Z',
      });

      expectActions(
        result,
        [action1, action2, actions3].map((a) => ({ ...a, item })),
      );
    });

    it('get all actions for item and its descendants', async () => {
      const {
        actions: [action1, action2, action3, action4, action5],
        items: [parent, item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              { account: 'actor', createdAt: '2025-03-25T12:02:29.210Z' },
              { account: 'actor', createdAt: '2025-03-25T13:02:29.210Z' },
              { account: 'actor', createdAt: '2025-03-25T13:02:29.210Z' },
            ],
            children: [
              {
                actions: [
                  { account: { name: 'bob' }, createdAt: '2025-03-25T12:02:29.210Z' },
                  { account: { name: 'bob' }, createdAt: '2025-03-25T13:02:29.210Z' },
                ],
              },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, parent.path, {
        endDate: '2025-03-25T15:02:29.210Z',
      });

      expectActions(result, [
        { ...action1, item: parent },
        { ...action2, item: parent },
        { ...action3, item: parent },
        { ...action4, item },
        { ...action5, item },
      ]);
    });
  });
});
