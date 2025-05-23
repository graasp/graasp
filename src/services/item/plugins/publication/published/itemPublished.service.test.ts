import { v4 } from 'uuid';

import { buildPathFromIds } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../../test/app';
import { db } from '../../../../../drizzle/db';
import { MailerService } from '../../../../../plugins/mailer/mailer.service';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../../itemMembership/membership.repository';
import { MemberRepository } from '../../../../member/member.repository';
import { ItemWrapperService } from '../../../ItemWrapper';
import { ItemRepository } from '../../../item.repository';
import { ItemActionService } from '../../action/itemAction.service';
import { ItemVisibilityRepository } from '../../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from './itemPublished.repository';
import { ItemPublishedService } from './itemPublished.service';
import { MeiliSearchWrapper } from './plugins/search/meilisearch';

const meiliSearchWrapper = {
  updateItem: jest.fn(),
} as unknown as MeiliSearchWrapper;

const itemPublishedRepository = new ItemPublishedRepository();

const itemPublishedService = new ItemPublishedService(
  {} as AuthorizedItemService,
  {} as MailerService,
  meiliSearchWrapper,
  {} as ItemVisibilityRepository,
  {} as ItemMembershipRepository,
  itemPublishedRepository,
  {} as ItemWrapperService,
  {} as ItemRepository,
  {} as MemberRepository,
  {} as ItemActionService,
  MOCK_LOGGER,
);

describe('ItemPublishedService - touchUpdatedAt', () => {
  it('change updatedAt with current time', async () => {
    // GIVEN
    const id = v4();
    const item = { id, path: buildPathFromIds(id) };
    const updatedAt = new Date().toISOString();

    // MOCK
    const updateItemMock = jest.spyOn(meiliSearchWrapper, 'updateItem');
    jest.spyOn(itemPublishedRepository, 'touchUpdatedAt').mockResolvedValue(updatedAt);

    // WHEN
    await itemPublishedService.touchUpdatedAt(db, item);

    // EXPECT
    expect(updateItemMock).toHaveBeenCalledWith(id, { updatedAt });
  });
});
