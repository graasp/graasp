import { ActionFactory, ActionTriggers, DiscriminatedItem } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource.js';
import { Action } from '../../../../action/entities/action.js';
import { saveActions } from '../../../../action/test/fixtures/actions.js';
import { ItemTestUtils } from '../../../../item/test/fixtures/items.js';
import { saveMember } from '../../../test/fixtures/members.js';

const testUtils = new ItemTestUtils();
const rawRepository = AppDataSource.getRepository(Action);

export const getDateBeforeOrAfterNow = (dateDiff) => {
  const date = new Date(); // Today's date
  date.setDate(date.getDate() + dateDiff);
  return date.toISOString();
};

export const saveActionsWithItems = async (member, { saveActionForNotOwnedItem = false } = {}) => {
  const item = await testUtils.saveItem({ actor: member });
  const actions = [
    ActionFactory({
      member,
      item: item as unknown as DiscriminatedItem,
      createdAt: new Date().toISOString(),
    }),
    ActionFactory({
      member,
      type: ActionTriggers.CollectionView,
      createdAt: new Date().toISOString(),
    }),
    ActionFactory({ member }),
    ActionFactory({ member, createdAt: new Date().toISOString(), type: ActionTriggers.ItemLike }),
  ];

  if (saveActionForNotOwnedItem) {
    const m = await saveMember();
    const notOwnItem = await testUtils.saveItem({ actor: m });
    actions.push(
      ActionFactory({
        member,
        createdAt: new Date().toISOString(),
        item: notOwnItem as unknown as DiscriminatedItem,
      }),
    );
  }
  await saveActions(rawRepository, actions);
};
