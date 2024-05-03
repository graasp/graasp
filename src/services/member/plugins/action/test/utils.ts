import { ActionTriggers, DiscriminatedItem } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { Action } from '../../../../action/entities/action';
import { saveActions } from '../../../../action/test/fixtures/actions';
import { ItemTestUtils } from '../../../../item/test/fixtures/items';
import { saveMember } from '../../../test/fixtures/members';

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
    {
      member,
      createdAt: new Date().toISOString(),
      type: ActionTriggers.Update,
      item: item as unknown as DiscriminatedItem,
    },
    { member, createdAt: new Date().toISOString(), type: ActionTriggers.CollectionView },
    {
      member,
      createdAt: new Date('1999-07-08').toISOString(),
      type: ActionTriggers.Update,
    },
    { member, createdAt: new Date().toISOString(), type: ActionTriggers.ItemLike },
  ];

  if (saveActionForNotOwnedItem) {
    const m = await saveMember();
    const notOwnItem = await testUtils.saveItem({ actor: m });
    actions.push({
      member,
      createdAt: new Date().toISOString(),
      type: ActionTriggers.Update,
      item: notOwnItem as unknown as DiscriminatedItem,
    });
  }
  await saveActions(rawRepository, actions);
};
