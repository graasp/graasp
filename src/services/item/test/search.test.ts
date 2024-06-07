import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { ItemTestUtils, expectManyPackedItems } from './fixtures/items';

// mock datasource
jest.mock('../../../plugins/datasource');

const testUtils = new ItemTestUtils();

describe('Item routes tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  it.only('Throw on signed out', async () => {
    ({ app, actor } = await build({ member: null }));

    const response = await app.inject({
      method: HttpMethod.Get,
      url: `/items/search`,
    });

    expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
  });

  describe.skip('Signed In', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
    });

    it('Returns successfully', async () => {
      const { item: parentItem } = await testUtils.saveItemAndMembership({
        member: actor,
      });
      const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem,
      });
      const { packedItem: child2 } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem,
      });

      const children = [child1, child2];
      // create child of child
      await testUtils.saveItemAndMembership({ member: actor, parentItem: parentItem1 });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${parentItem.id}/children`,
      });

      const data = response.json();
      expect(data).toHaveLength(children.length);
      expectManyPackedItems(data, children);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });
});
