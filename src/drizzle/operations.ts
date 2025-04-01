import { SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm/sql';

export function isAncestorOrSelf(column: PgColumn, path: string | PgColumn): SQL {
  return sql`${column} @> ${path}`;
}
export function isDescendantOrSelf(column: PgColumn, parentPath: string | PgColumn): SQL {
  return sql`${column} <@ ${parentPath}`;
}
export function isDirectChild(column: PgColumn, parentPath: string | PgColumn): SQL {
  return sql`${column} ~ ${`${parentPath}.*{1}`}`;
}
