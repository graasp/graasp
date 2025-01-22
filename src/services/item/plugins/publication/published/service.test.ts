import { v4 } from 'uuid';

import { buildPathFromIds } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../../test/app';
import { MailerService } from '../../../../../plugins/mailer/service';
import { Repositories } from '../../../../../utils/repositories';
import { ItemService } from '../../../service';
import { ItemThumbnailService } from '../../thumbnail/service';
import { MeiliSearchWrapper } from './plugins/search/meilisearch';
import { ItemPublishedService } from './service';

const meiliSearchWrapper = {
  updateItem: jest.fn(),
} as unknown as MeiliSearchWrapper;

const itemPublishedService = new ItemPublishedService(
  {} as ItemService,
  {} as ItemThumbnailService,
  {} as MailerService,
  meiliSearchWrapper,
  MOCK_LOGGER,
);

const repositories = {
  itemRepository: {
    getPublishedItemsForMember: jest.fn(),
  },
  itemPublishedRepository: {
    touchUpdatedAt: jest.fn(),
  },
} as unknown as Repositories;

describe('ItemPublishedService - touchUpdatedAt', () => {
  it('change updatedAt with current time', async () => {
    // GIVEN
    const id = v4();
    const item = { id, path: buildPathFromIds(id) };
    const updatedAt = new Date().toISOString();

    // MOCK
    const updateItemMock = jest.spyOn(meiliSearchWrapper, 'updateItem');
    jest.spyOn(repositories.itemPublishedRepository, 'touchUpdatedAt').mockResolvedValue(updatedAt);

    // WHEN
    await itemPublishedService.touchUpdatedAt(repositories, item);

    // EXPECT
    expect(updateItemMock).toHaveBeenCalledWith(id, { updatedAt });
  });
});
