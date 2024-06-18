import { FastifyInstance } from 'fastify';

import { migrations1679669193720 } from '../../../src/migrations/1679669193720-migrations.js';
import { Migrations1679669193721 } from '../../../src/migrations/1679669193721-migrations.js';
import { Migrations1683637099103 } from '../../../src/migrations/1683637099103-add-favorites.js';
import build from '../../app.js';
import { buildInsertIntoQuery, buildSelectQuery, checkDatabaseIsEmpty } from '../utils.js';
import { up } from './fixture.js';

// mock datasource
jest.mock('../../../src/plugins/datasource');

describe('migrations1683637099103', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // init db empty, it is sync by default
    ({ app } = await build());
    await app.db.dropDatabase();

    // should contain no table
    await checkDatabaseIsEmpty(app);

    // run previous migrations
    // TODO: this will quickly become cumbersome when we have 100 migrations... Is there an easier way to test migrations? How much do we want to test these migration in integration tests?
    await new migrations1679669193720().up(app.db.createQueryRunner());
    await new Migrations1679669193721().up(app.db.createQueryRunner());
  });

  afterEach(async () => {
    app.close();
  });

  it('Up', async () => {
    // insert mock data and check return value
    const { values: migrationData } = up;
    // insert mock data and check return value
    for (const [tableName, data] of Object.entries(migrationData)) {
      for (const [_idx, d] of data.entries()) {
        await app.db.query(buildInsertIntoQuery(tableName, d));
      }
    }

    await new Migrations1683637099103().up(app.db.createQueryRunner());

    const result = await app.db.query(
      buildSelectQuery('member', { id: migrationData.member[0].id }),
    );

    expect(JSON.parse(result[0].extra).favoriteItems).toBeUndefined(); // Favorite removed from extra
    expect(JSON.parse(result[0].extra).hasThumbnail).toBe(true); // remaining extras still intact

    const favoriteResult = await app.db.query(
      buildSelectQuery('item_favorite', { member_id: migrationData.member[0].id }),
    );

    expect(favoriteResult).toHaveLength(1); // Only one favorite was really existing
    expect(favoriteResult[0]).toMatchObject({
      item_id: migrationData.item[0].id,
      member_id: migrationData.member[0].id,
    }); // Favorite item now linked to member in the new table
  });
});
