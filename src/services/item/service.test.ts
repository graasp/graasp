import { FastifyInstance } from 'fastify';

import build, { clearDatabase } from '../../../test/app';
import { BaseLogger } from '../../logger';
import { buildRepositories } from '../../utils/repositories';
import { ThumbnailService } from '../thumbnail/service';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemService } from './service';
import { ItemTestUtils } from './test/fixtures/items';

const testUtils = new ItemTestUtils();
const mockedThumbnailService = {
  copyFolder: jest.fn(),
} as unknown as jest.Mocked<ThumbnailService>;
const service = new ItemService(
  mockedThumbnailService,
  {} as ItemThumbnailService,
  {} as BaseLogger,
);

describe('Item Service', () => {
  let app: FastifyInstance;
  let actor;

  beforeEach(async () => {
    ({ app, actor } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });
  describe('Copy', () => {
    it('Should copy thumbnails on item copy if original has thumbnails', async () => {
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: { settings: { hasThumbnail: true } },
      });
      await service.copy(actor, buildRepositories(), item.id);
      expect(mockedThumbnailService.copyFolder).toHaveBeenCalled();
    });
    it('Should not copy thumbnails on item copy if original has no thumbnails', async () => {
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: { settings: { hasThumbnail: false } },
      });
      await service.copy(actor, buildRepositories(), item.id);
      expect(mockedThumbnailService.copyFolder).not.toHaveBeenCalled();
    });
  });
});
