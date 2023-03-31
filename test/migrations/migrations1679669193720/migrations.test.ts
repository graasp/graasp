import { migrations1679669193720 } from '../../../src/migrations/1679669193720-migrations';
import build from '../../app';
import { buildInsertIntoQuery, checkDatabaseIsEmpty, getNumberOfTables } from '../utils';
import { expected, values as migrationData } from './migrations1679669193720.fixtures';

// mock datasource
jest.mock('../../../src/plugins/datasource');

describe('Database', () => {
  let app;

  beforeAll(async () => {
    // init db empty, it is sync by default
    ({ app } = await build());
    await app.db.dropDatabase();

    // should contain no table
    await checkDatabaseIsEmpty(app);
  });

  afterAll(async () => {
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // await clearDatabase(app.db);
  });

  describe('migrations1679669193720', () => {
    const migration = new migrations1679669193720();

    it('Up', async () => {
      const queryRunner = app.db.createQueryRunner();
      await migration.up(queryRunner);

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
      // everything is deleted
      await migration.down(app.db.createQueryRunner());

      // should contain no table
      await checkDatabaseIsEmpty(app);
    });
  });
});
