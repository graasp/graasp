import { PgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm/sql';

export function isAncestorOrSelf(column: PgColumn, path: string | PgColumn) {
  return sql`${column} @> ${path}`;
}
export function isDescendantOrSelf(column: PgColumn, parentPath: string | PgColumn) {
  return sql`${column} <@ ${parentPath}`;
}
export function isDirectChild(column: PgColumn, parentPath: string | PgColumn) {
  return sql`${column} ~ ${`${parentPath}.*{1}`}`;
}
