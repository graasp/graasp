import { SQL, ilike } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm/sql';

import { DEFAULT_LANG } from '@graasp/translations';

import { isMember } from '../services/authentication';
import { MaybeUser } from '../types';
import { ALLOWED_SEARCH_LANGS } from '../utils/config';

export function isAncestorOrSelf(column: PgColumn, path: string | PgColumn): SQL {
  return sql`${column} @> ${path}`;
}
export function isDescendantOrSelf(column: PgColumn, parentPath: string | PgColumn): SQL {
  return sql`${column} <@ ${parentPath}`;
}
export function isDirectChild(column: PgColumn, parentPath: string | PgColumn): SQL {
  return sql`${column} ~ ${`${parentPath}.*{1}`}`;
}

/**
 * build an sql query to build a full text search ts vector
 * @param table columns references (usually items or itemsRaw)
 * @param lang language in which the search should be done
 * @returns sql condition for a full text searcg
 */
export function itemFullTextSearch(
  table: {
    name: PgColumn;
    description: PgColumn;
    extra: PgColumn;
  },
  lang: string,
  keywordsString: string,
) {
  return sql`(
  setweight(to_tsvector('simple', ${table.name}), 'A') || ' ' ||
      setweight(to_tsvector(${lang}, COALESCE(${table.description},'')), 'B') || ' ' ||
    setweight(to_tsvector(${lang}, COALESCE((${table.extra})->'document'->>'content','{}')), 'D') || ' ' ||
    setweight(to_tsvector(${lang}, COALESCE((${table.extra})->'file'->'content','{}')), 'D') || ' ' ||
    setweight(to_tsvector(${lang}, COALESCE((${table.extra})->'s3File'->'content','{}')), 'D')
  ):: tsvector @@ plainto_tsquery(${lang}, ${keywordsString})`;
}

/**
 * build ilike sql queries given keywords
 * @param column
 * @param allKeywords
 * @returns
 */
export function keywordSearch(column: PgColumn, allKeywords: string[]) {
  return allKeywords.map((k) => {
    return ilike(column, `%${k}%`);
  });
}

/**
 * return full text search query using the actor lang. If the lang is the default one or is not defined, return undefined.
 * @param actor
 * @param table
 * @param keywordsString
 * @returns search query with actor lang, undefined if lang is the default one or does not exist
 */
export function itemFullTextSearchWithMemberLang(
  actor: MaybeUser,
  table: {
    name: PgColumn;
    description: PgColumn;
    extra: PgColumn;
  },
  keywordsString: string,
) {
  const memberLang = actor && isMember(actor) ? actor.lang : DEFAULT_LANG;
  const memberLangKey = memberLang as keyof typeof ALLOWED_SEARCH_LANGS;
  if (memberLang != DEFAULT_LANG && ALLOWED_SEARCH_LANGS[memberLangKey]) {
    return itemFullTextSearch(table, ALLOWED_SEARCH_LANGS[memberLangKey], keywordsString);
  }

  return undefined;
}
