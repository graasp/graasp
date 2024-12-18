import { ActionFactory, ActionTriggers, DiscriminatedItem } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { Action } from '../../../../action/entities/action';
import { saveActions } from '../../../../action/test/fixtures/actions';
import { ItemTestUtils } from '../../../../item/test/fixtures/items';
import { Member } from '../../../entities/member';
import { saveMember } from '../../../test/fixtures/members';

const testUtils = new ItemTestUtils();
const rawRepository = AppDataSource.getRepository(Action);

export const getDateBeforeOrAfterNow = (dateDiff: number) => {
  const date = new Date(); // Today's date
  date.setDate(date.getDate() + dateDiff);
  return date.toISOString();
};

export const saveActionsWithItems = async (
  member: Member,
  { saveActionForNotOwnedItem = false } = {},
) => {
  const item = await testUtils.saveItem({ actor: member });
  const actions = [
    ActionFactory({
      account: member,
      item: item as unknown as DiscriminatedItem,
      createdAt: new Date().toISOString(),
    }),
    ActionFactory({
      account: member,
      type: ActionTriggers.CollectionView,
      createdAt: new Date().toISOString(),
    }),
    ActionFactory({ account: member }),
    ActionFactory({
      account: member,
      createdAt: new Date().toISOString(),
      type: ActionTriggers.ItemLike,
    }),
  ];

  if (saveActionForNotOwnedItem) {
    const m = await saveMember();
    const notOwnItem = await testUtils.saveItem({ actor: m });
    actions.push(
      ActionFactory({
        account: member,
        createdAt: new Date().toISOString(),
        item: notOwnItem as unknown as DiscriminatedItem,
      }),
    );
  }
  await saveActions(rawRepository, actions);
};
