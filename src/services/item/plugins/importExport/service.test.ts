import yazl from 'yazl';

import { FastifyInstance, FastifyReply } from 'fastify';

import { ItemTagType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app.js';
import { buildRepositories } from '../../../../utils/repositories.js';
import { ItemTestUtils } from '../../test/fixtures/items.js';
import FileItemService from '../file/service.js';
import type { H5PService } from '../html/h5p/service.js';
import { ItemTagRepository } from '../itemTag/repository.js';
import { ImportExportService } from './service.js';

// mock datasource
jest.mock('../../../../plugins/datasource');
const testUtils = new ItemTestUtils();

describe('ZIP routes tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('export', () => {
    it('Do not include hidden children', async () => {
      ({ app, actor } = await build());
      const mock = jest.spyOn(yazl.ZipFile.prototype, 'addEmptyDirectory');
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });
      const child1 = await testUtils.saveItem({
        actor,
        parentItem: item,
      });
      await testUtils.saveItem({
        actor,
        parentItem: item,
      });
      await new ItemTagRepository().post(actor, child1, ItemTagType.Hidden);

      const importExportService = new ImportExportService(
        app.db,
        {} as unknown as FileItemService,
        app.items.service,
        {} as unknown as H5PService,
        app.log,
      );
      const repositories = buildRepositories();
      const reply = {} as unknown as FastifyReply;
      await importExportService.export(actor, repositories, { item, reply });

      // called for parent and one child
      expect(mock).toHaveBeenCalledTimes(2);
    });
  });
});
