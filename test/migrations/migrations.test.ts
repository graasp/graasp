import build, { clearDatabase } from '../app';
import fs from 'fs';
import path from 'path';
import { migrations1679669193720 } from '../../src/migrations/1679669193720-migrations';
import { Migrations1679669193721 } from '../../src/migrations/1679669193721-migrations';
import { v4 } from 'uuid';

// get all migrations
const files = fs.readdirSync(path.join(__dirname, '../../src/migrations'));
let numberOfMigrationsTested = 0;

// mock datasource
jest.mock('../../src/plugins/datasource');

describe('Database', () => {
  let app;

  beforeAll(async () => {
    // init db empty, it is sync by default
    ({ app, } = await build());
    await app.db.dropDatabase();

    // should contain no table
    const result = await app.db.query(`select count(*)
      from information_schema.tables
      where table_schema = 'public'`);
    expect(result[0].count).toEqual('0');
  });

  afterAll(async () => {
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
  });

  describe('migrations1679669193720', () => {

    const migration = new migrations1679669193720();

    afterAll(async () => {
      // setup the db for next test
      await migration.up(app.db.createQueryRunner());
      // count the number of tests
      numberOfMigrationsTested++;
    });

    it('Up', async () => {
      const queryRunner = app.db.createQueryRunner();
      await migration.up(queryRunner);

      const parseValues = (values)=> {
        const result = (values).map((v)=>{
          if(typeof v === 'object') {
            return '\''+JSON.stringify(v)+'\'';
          }
          return `'${v}'`;
        });
        console.log(result);
        return result;
      };

      const buildInsertIntoQuery = (tableName, values) => {
        
        return `INSERT INTO ${tableName} (${Object.keys(values).join(',')}) values (${parseValues(Object.values(values)).join(',')}) RETURNING *`;
      };
      const memberId = v4();

      // insert mock member
      const memberValues = {
        id:memberId,
        name:'my member',
        email: 'email@email.com',
        extra: {hasThumbnail:true},
      };
      const [member] = await app.db.query(buildInsertIntoQuery('member',memberValues));
      expect(member.id).toEqual(memberId);
      expect(member.name).toEqual(memberValues.name);
      expect(member.email).toEqual(memberValues.email);
      expect(member.extra).toEqual(memberValues.extra);

      // insert mock data
      const itemId = v4();
      const values = {
        id:itemId,
        name:'my item',
        description: 'my description',
        extra: {
          folder: {}
        },
        path: itemId.replace(/-/g, '_'),
        settings: {hasThumbnail:true},
        creator: memberId,
      };
      const [item] = await app.db.query(buildInsertIntoQuery('item',values));
      expect(item.id).toEqual(itemId);
      expect(item.name).toEqual(values.name);
      expect(item.creator).toEqual(values.creator);
      expect(item.description).toEqual(values.description);
      expect(item.extra).toEqual(values.extra);
      expect(item.settings).toEqual(values.settings);
      expect(item.path).toEqual(values.path);

    });


    it('Down', async () => {
      // everything is deleted
      await migration.down(app.db.createQueryRunner());

    // should contain no table
    const result = await app.db.query(`select count(*)
      from information_schema.tables
      where table_schema = 'public'`);
    expect(result[0].count).toEqual('0');

    });
  });

  // describe('migrations1679669193721', () => {
  //   const migration = new Migrations1679669193721();

  //   afterAll(async () => {

  //     // setup the db for next test
  //     await migration.up(app.db.createQueryRunner());
  //     // count the number of tests
  //     numberOfMigrationsTested++;
  //   });

  //   it('Up', async () => {



  //     // insert mock data


  //     await migration.up(app.db.createQueryRunner());

  //     // check no data is lost

  //   });


  //   it('Down', async () => {

  //     await migration.down(app.db.createQueryRunner());
  //     // check no data is lost



  //   });
  // });

  // ADD YOUR TESTS FOR YOUR MIGRATION HERE

  // describe('MY MIGRATION NAME', () => {

  //   // your migration class
  //   const migration = new Migrations1679669193721();

  //   afterAll(async () => {
  //     // setup the db for next test
  //     await migration.up(app.db.createQueryRunner());
  //     // count the number of tests
  //     numberOfMigrationsTested++;
  //   });

  //   it('Up', async () => {

  //     // insert mock data

  //     await migration.up(app.db.createQueryRunner());

  //     // check no data is lost
  //   });

  //   it('Down', async () => {

  //     await migration.down(app.db.createQueryRunner());
  //     // check no data is lost

  //   });
  // });

  it('Check number of migrations', () => {
    // should contain as many describe as many 
    expect(numberOfMigrationsTested).toEqual(files.length);
  });


});

