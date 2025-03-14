import { v4 } from 'uuid';

import { buildPathFromIds } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../../test/app.js';
import { db } from '../../../../../drizzle/db.js';
import { MailerService } from '../../../../../plugins/mailer/mailer.service.js';
import { ActionRepository } from '../../../../action/action.repository.js';
import { ItemMembershipRepository } from '../../../../itemMembership/repository.js';
import { ItemWrapperService } from '../../../ItemWrapper.js';
import { BasicItemService } from '../../../basic.service.js';
import { ItemRepository } from '../../../repository.js';
import { ItemVisibilityRepository } from '../../itemVisibility/repository.js';
import { ItemThumbnailService } from '../../thumbnail/service.js';
import { ItemPublishedRepository } from './itemPublished.repository.js';
import { ItemPublishedService } from './itemPublished.service.js';
import { MeiliSearchWrapper } from './plugins/search/meilisearch.js';

const meiliSearchWrapper = {
  updateItem: jest.fn(),
} as unknown as MeiliSearchWrapper;

const itemPublishedRepository = {} as ItemPublishedRepository;

const itemPublishedService = new ItemPublishedService(
  {} as BasicItemService,
  {} as MailerService,
  // {} as ItemThumbnailService,
  meiliSearchWrapper,
  {} as ItemVisibilityRepository,
  {} as ItemMembershipRepository,
  itemPublishedRepository,
  {} as ActionRepository,
  {} as ItemWrapperService,
  {} as ItemRepository,
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
