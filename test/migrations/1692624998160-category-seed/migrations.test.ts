import { FastifyInstance } from 'fastify';

import { migrations1679669193720 } from '../../../src/migrations/1679669193720-migrations';
import { Migrations1679669193721 } from '../../../src/migrations/1679669193721-migrations';
import { Migrations1683637099103 } from '../../../src/migrations/1683637099103-add-favorites';
import { Migrations1689666251815 } from '../../../src/migrations/1689666251815-clean-tags';
import { Migrations1689777747530 } from '../../../src/migrations/1689777747530-default-item-settings';
import { Migrations1692624998160 } from '../../../src/migrations/1692624998160-category-seed';
import build from '../../app';
import { checkDatabaseIsEmpty } from '../utils';

describe('Migrations1692624998160', () => {
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
    await new Migrations1683637099103().up(app.db.createQueryRunner());
    await new Migrations1689666251815().up(app.db.createQueryRunner());
    await new Migrations1689777747530().up(app.db.createQueryRunner());
  });

  afterEach(async () => {
    app.close();
  });

  it('Up', async () => {
    await new Migrations1692624998160().up(app.db.createQueryRunner());

    const categories = await app.db.query<{ name: string }[]>('select * from category');
    const names = categories.map((c) => c.name);
    expect(names).toContain('arts');
    expect(names).toContain('language');
    expect(names).toContain('mathematics');
    expect(names).toContain('literature');
    expect(names).toContain('natural-science');
    expect(names).toContain('social-science');
    expect(names).toContain('kindergarten');
    expect(names).toContain('primary-school');
    expect(names).toContain('lower-secondary-education');
    expect(names).toContain('upper-secondary-education');
    expect(names).toContain('higher-education');
    expect(names).toContain('vocation-training');
    expect(names).toContain('english');
    expect(names).toContain('german');
    expect(names).toContain('french');
    expect(names).toContain('italian');
    expect(names).toContain('arabic');
    expect(names).toContain('app');
    expect(names).toContain('collection');
    expect(names).toContain('template');
    expect(names).toContain('physical-education');
    expect(names).toContain('informatics');

    expect(names).toHaveLength(22);
  });
});
