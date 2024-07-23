import { FastifyInstance } from 'fastify';

import { migrations1679669193720 } from '../../../src/migrations/1679669193720-migrations';
import build from '../../app';
import { buildInsertIntoQuery, checkDatabaseIsEmpty, getNumberOfTables } from '../utils';
import { expected, values as migrationData } from './migrations1679669193720.fixtures';

// mock datasource
// jest.mock('../../../src/plugins/datasource');

describe('migrations1679669193720', () => {
  let app: FastifyInstance;
  const migration = new migrations1679669193720();

  beforeEach(async () => {
    // init db empty, it is sync by default
    ({ app } = await build({ member: null }));
    await app.db.dropDatabase();

    // should contain no table
    await checkDatabaseIsEmpty(app);
  });

  afterEach(async () => {
    // TODO: dump db and set it back?
    app.close();
  });

  it('Up', async () => {
    await migration.up(app.db.createQueryRunner());

    // insert mock data and check return value
    for (const [tableName, data] of Object.entries(migrationData)) {
      for (const [idx, d] of data.entries()) {
        const [returnedValue] = await app.db.query(buildInsertIntoQuery(tableName, d));
        await expected[tableName](returnedValue, idx, app.db);
      }
    }

    // every table is checked
    const nbTables = await getNumberOfTables(app);
    expect(Object.keys(migrationData).length).toEqual(nbTables);
  });

  it('Down', async () => {
    await migration.up(app.db.createQueryRunner());

    // everything is deleted
    await migration.down(app.db.createQueryRunner());

    // should contain no table
    await checkDatabaseIsEmpty(app);
  });
});
