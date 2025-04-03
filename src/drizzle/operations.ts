import { SQL, ilike } from 'drizzle-orm';
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
 * returns sql operation to transform a column lang into a usable regconfig lang for tsvector search. Necessary for dynamic lang coming from a column
 * @param column lang column reference
 * @returns
 */
export function transformLangToReconfigLang(column: PgColumn) {
  return sql`case ${column} 
            when 'en' then 'english'::regconfig 
            when 'fr' then 'french'::regconfig 
            when 'it' then 'italian'::regconfig 
            when 'de' then 'german'::regconfig 
            when 'es' then 'spanish'::regconfig 
            else 'english'::regconfig 
            end`;
}
