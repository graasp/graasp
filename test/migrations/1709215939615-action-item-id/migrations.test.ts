import { migrations1679669193720 } from '../../../src/migrations/1679669193720-migrations';
import { Migrations1679669193721 } from '../../../src/migrations/1679669193721-migrations';
import { Migrations1683637099103 } from '../../../src/migrations/1683637099103-add-favorites';
import { Migrations1689666251815 } from '../../../src/migrations/1689666251815-clean-tags';
import { Migrations1689777747530 } from '../../../src/migrations/1689777747530-default-item-settings';
import { Migrations1690365054666 } from '../../../src/migrations/1690365054666-membership-indices';
import { Migrations1691062874841 } from '../../../src/migrations/1691062874841-gist-path-indices';
import { Migrations1692624998160 } from '../../../src/migrations/1692624998160-category-seed';
import { Migrations1695655073720 } from '../../../src/migrations/1695655073720-gist-action-path';
import { Migrations1701368251781 } from '../../../src/migrations/1701368251781-short-links';
import { Migrations1706089724916 } from '../../../src/migrations/1706089724916-item-geolocation';
import { Migrations1707735413855 } from '../../../src/migrations/1707735413855-geolocation-address';
import { Migrations1709215939615 } from '../../../src/migrations/1709215939615-action-item-id';
import build from '../../app';
import { buildInsertIntoQuery, buildSelectQuery, checkDatabaseIsEmpty } from '../utils';
import { up } from './fixtures';

// mock datasource
jest.mock('../../../src/plugins/datasource');

describe('Migrations1709215939615', () => {
  let app;

  beforeEach(async () => {
    // init db empty, it is sync by default
    ({ app } = await build());
    await app.db.dropDatabase();

    // // should contain no table
    await checkDatabaseIsEmpty(app);

    await app.db.runMigrations();
    await app.db.undoLastMigration();
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

    await new Migrations1709215939615().up(app.db.createQueryRunner());

    for (const { id: actionId, item_path: prevItemPath } of migrationData.action) {
      const [action] = await app.db.query(buildSelectQuery('action', { id: actionId }));

      expect(action.item_path).toBeUndefined();
      expect(action.item_id).toEqual(up.values.item.find(({ path }) => path === prevItemPath)!.id);

      const expected = up.values.action.find(({ id }) => id === actionId)!;
      expect(action.id).toEqual(expected.id);
      expect(action.member_id).toEqual(expected.member_id);
      expect(JSON.parse(action.geolocation)).toEqual(expected.geolocation);
      expect(action.type).toEqual(expected.type);
      expect(JSON.parse(action.extra)).toEqual(expected.extra);
      expect(action.view).toEqual(expected.view);
      expect(action.created_at.toISOString()).toEqual(expected.created_at);
    }
  }, 70000);
});
