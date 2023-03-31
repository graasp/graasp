import { migrations1679669193720 } from '../../../src/migrations/1679669193720-migrations';
import { Migrations1679669193721 } from '../../../src/migrations/1679669193721-migrations';
import build from '../../app';
import {
  buildInsertIntoQuery,
  buildSelectQuery,
  checkDatabaseIsEmpty,
  getNumberOfTables,
} from '../utils';
import { down, up } from './migrations1679669193721.fixtures';

// mock datasource
jest.mock('../../../src/plugins/datasource');

describe('migrations1679669193721', () => {
  let app;
  const migration = new Migrations1679669193721();

  beforeEach(async () => {
    // init db empty, it is sync by default
    ({ app } = await build());
    await app.db.dropDatabase();

    // should contain no table
    await checkDatabaseIsEmpty(app);

    // run previous migrations
    await new migrations1679669193720().up(app.db.createQueryRunner());
  });

  afterEach(async () => {
    app.close();
  });

  it('Up', async () => {
    const { expected, values: migrationData } = up;
    // insert mock data and check return value
    for (const [tableName, data] of Object.entries(migrationData)) {
      for (const [idx, d] of data.entries()) {
        await app.db.query(buildInsertIntoQuery(tableName, d));
      }
    }

    await migration.up(app.db.createQueryRunner());

    // check no data is lost
    for (const [tableName, data] of Object.entries(migrationData)) {
      for (const [idx, d] of data.entries()) {
        const [returnedValue] = await app.db.query(buildSelectQuery(tableName, { id: d.id }));
        await expected[tableName](returnedValue, idx, app.db);
      }
    }

    // every table is checked
    const nbTables = await getNumberOfTables(app);
    expect(Object.keys(migrationData).length).toEqual(nbTables);
  });

  it('Down', async () => {
    await migration.up(app.db.createQueryRunner());

    const { expected, values: migrationData } = down;
    // insert mock data
    for (const [tableName, data] of Object.entries(migrationData)) {
      for (const [idx, d] of data.entries()) {
        await app.db.query(buildInsertIntoQuery(tableName, d));
      }
    }

    await migration.down(app.db.createQueryRunner());

    // check no data is lost
    for (const [tableName, data] of Object.entries(migrationData)) {
      for (const [idx, d] of data.entries()) {
        const [returnedValue] = await app.db.query(buildSelectQuery(tableName, { id: d.id }));
        await expected[tableName](returnedValue, idx, app.db);
      }
    }

    // every table is checked
    const nbTables = await getNumberOfTables(app);
    expect(nbTables).toEqual(Object.keys(migrationData).length);
  });
});
