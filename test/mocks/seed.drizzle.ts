import { PgInsertValue } from 'drizzle-orm/pg-core';

import { db } from '../../src/drizzle/db';
import { accountsTable, itemsRaw } from '../../src/drizzle/schema';

/**
 * This is the central place to register a table to be used in the seed.
 * If we register a table name here, it will make it available to the seed process.
 * The name used should be the exported name (named export) of the table.
 */
const tables = { accountsTable, itemsRaw };

type SeedInput = {
  [TName in keyof typeof tables]: (typeof tables)[TName]['$inferInsert'][];
};
type SeedOutput = {
  [TName in keyof typeof tables]: (typeof tables)[TName]['$inferSelect'][];
};

export async function seed(datas: SeedInput) {
  // HACK: this is because TS does not understand that we will be creating these objects later
  const result: SeedOutput = {} as SeedOutput;
  // Begin transation.
  await db.transaction(async (tx) => {
    for (const key in datas) {
      // get the table from the tables indexed by the key string
      const tableName = key as keyof typeof tables;
      const table = tables[tableName];

      // casting to help TS understand that we will be inserting into the correct values
      const values = datas[tableName] as PgInsertValue<typeof table>[];

      if (values && values.length !== 0) {
        const createdEntities = await tx
          .insert(table)
          .values(values)
          .returning();
        result[key] = createdEntities;
      } else {
        result[key] = [];
      }
    }
  });
  return result;
}
