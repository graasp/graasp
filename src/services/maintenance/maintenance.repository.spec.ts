import { add, sub } from 'date-fns';
import { afterEach, describe, expect, it } from 'vitest';

import { db } from '../../drizzle/db';
import { maintenanceTable } from '../../drizzle/schema';
import { assertIsDefined } from '../../utils/assertions';
import { MaintenanceRepository } from './maintenance.repository';

const repository = new MaintenanceRepository();

describe('MaintenanceRepository', () => {
  afterEach(async () => {
    await db.delete(maintenanceTable);
  });

  describe('getNext', () => {
    it('return empty for no next maintenance', async () => {
      // save maintenance before now
      const value = {
        startAt: sub(new Date(), { months: 2 }).toISOString(),
        endAt: sub(new Date(), { months: 1 }).toISOString(),
        slug: 'my-slug',
      };
      await db.insert(maintenanceTable).values(value);

      const entry = await repository.getNext(db);
      expect(entry).toBeUndefined();
    });
    it('get next maintenance', async () => {
      // save maintenance
      const value = {
        startAt: add(new Date(), { months: 1 }).toISOString(),
        endAt: add(new Date(), { months: 2 }).toISOString(),
        slug: 'my-slug',
      };
      await db.insert(maintenanceTable).values(value);

      const entry = await repository.getNext(db);
      assertIsDefined(entry);
      expect(entry.slug).toEqual(value.slug);
    });
    it('return closest maintenance', async () => {
      // save maintenance
      const value = {
        startAt: add(new Date(), { months: 1 }).toISOString(),
        endAt: add(new Date(), { months: 2 }).toISOString(),
        slug: 'my-slug',
      };
      await db.insert(maintenanceTable).values(value);
      // maintenance later in the futur
      await db.insert(maintenanceTable).values({
        startAt: add(new Date(), { months: 4 }).toISOString(),
        endAt: add(new Date(), { months: 5 }).toISOString(),
        slug: 'my-slug-1',
      });

      const entry = await repository.getNext(db);
      assertIsDefined(entry);
      expect(entry.slug).toEqual(value.slug);
    });
  });
});
