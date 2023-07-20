import { ItemTagType } from '@graasp/sdk';

import { migrations1679669193720 } from '../../../src/migrations/1679669193720-migrations';
import { Migrations1679669193721 } from '../../../src/migrations/1679669193721-migrations';
import { Migrations1683637099103 } from '../../../src/migrations/1683637099103-add-favorites';
import { Migrations1689666251815 } from '../../../src/migrations/1689666251815-clean-tags';
import build from '../../app';
import { buildInsertIntoQuery, buildSelectQuery, checkDatabaseIsEmpty } from '../utils';
import { up } from './fixture';

// mock datasource
jest.mock('../../../src/plugins/datasource');

describe('migrations1689666251815', () => { 
  let app;

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
    await new Migrations1683637099103().up(app.db.createQueryRunner());
  });

  afterEach(async () => {
    app.close();
  });

  it('Up', async () => {
    // insert mock data and check return value
    const { values: migrationData } = up;
    // insert mock data and check return value
    for (const [tableName, data] of Object.entries(migrationData)) {
      for (const [idx, d] of data.entries()) {
        await app.db.query(buildInsertIntoQuery(tableName, d));
      }
    }

    await new Migrations1689666251815().up(app.db.createQueryRunner());

    const [publicTag] = await app.db.query(
      buildSelectQuery('item_tag', { id: migrationData.item_tag[0].id }),
    );
    expect(publicTag.type).toEqual(ItemTagType.Public);

    const publishedTag = await app.db.query(
      buildSelectQuery('item_tag', { id: migrationData.item_tag[1].id }),
    );
    expect(publishedTag).toHaveLength(0);

    const itemLoginTag = await app.db.query(
      buildSelectQuery('item_tag', { id: migrationData.item_tag[2].id }),
    );
    expect(itemLoginTag).toHaveLength(0);

    const [hiddenTag] = await app.db.query(
      buildSelectQuery('item_tag', { id: migrationData.item_tag[3].id }),
    );
    expect(hiddenTag.type).toEqual(ItemTagType.Hidden);

    const [remainingPublicTag] = await app.db.query(
      buildSelectQuery('item_tag', { id: migrationData.item_tag[4].id }),
    );
    expect(remainingPublicTag.type).toEqual(ItemTagType.Public);

    const duplicateTag = await app.db.query(
      buildSelectQuery('item_tag', { id: migrationData.item_tag[5].id }),
    );
    expect(duplicateTag).toHaveLength(0);
  });
});
