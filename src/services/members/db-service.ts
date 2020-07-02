// global
import {
  sql,
  DatabasePoolType as DbHandler,
  DatabaseTransactionConnectionType as TrxHandler
} from 'slonik';
// local
import { Member } from './interfaces/member';

/**
 * Database's first layer of abstraction for Members
 */
export class MemberService {
  // the 'safe' way to dynamically generate the columns names:
  private static allColumns = sql.join(
    [
      'id', 'name', 'email', 'type',
      ['created_at', 'createdAt'],
      ['updated_at', 'updatedAt'],
    ].map(c =>
      !Array.isArray(c) ?
        sql.identifier([c]) :
        sql.join(c.map(cwa => sql.identifier([cwa])), sql` AS `)
    ),
    sql`, `
  );

  /**
   * Get member matching the given `name` or `null`, if not found.
   * @param name Member's name
   * @param dbHandler Database handler
   */
  async getMatchingName(name: string, dbHandler: DbHandler) {
    return dbHandler
      .query<Member>(sql`
        SELECT ${MemberService.allColumns}
        FROM member
        WHERE name = ${name}
      `)
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Get member matching the given `id` or `null`, if not found.
   * @param id Member's id
   * @param dbHandler Database handler
   * @param properties List of Member properties to fetch - defaults to 'all'
   */
  async get(id: string, dbHandler: TrxHandler, properties?: (keyof Member)[]) {
    let selectColumns;

    if (properties && properties.length) {
      selectColumns = sql.join(
        properties.map(p => sql.identifier([p])),
        sql`, `
      );
    }

    return dbHandler
      .query<Member>(sql`
        SELECT ${selectColumns || MemberService.allColumns}
        FROM member
        WHERE id = ${id}
      `)
      .then(({ rows }) => rows[0] || null);
  }
}
