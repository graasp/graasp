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
   * Get member(s) matching the properties of the given (partial) member.
   * @param member Partial member
   * @param dbHandler Database handler
   * @param properties List of Member properties to fetch - defaults to 'all'
   */
  async getMatching(member: Partial<Member>, dbHandler: TrxHandler, properties?: (keyof Member)[]) {
    let selectColumns;

    if (properties && properties.length) {
      selectColumns = sql.join(
        properties.map(p => sql.identifier([p])),
        sql`, `
      );
    }

    // TODO: 'createdAt' and 'updatedAt' are not handled properly - will not match any column.
    const whereConditions = sql.join(
      Object.keys(member)
        .map((key: keyof Partial<Member>) =>
          sql.join([sql.identifier([key]), sql`${member[key]}`], sql` = `)
        ),
      sql` AND `
    );

    return dbHandler
      .query<Partial<Member>>(sql`
        SELECT ${selectColumns || MemberService.allColumns}
        FROM member
        WHERE ${whereConditions}
      `)
      // TODO: is there a better way?
      .then(({ rows }) => rows.slice(0));
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
      .query<Partial<Member>>(sql`
        SELECT ${selectColumns || MemberService.allColumns}
        FROM member
        WHERE id = ${id}
      `)
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Create member and return it.
   * @param member Member to create
   * @param transactionHandler Database transaction handler
   */
  async create(member: Partial<Member>, transactionHandler: TrxHandler) {
    const { name, email } = member;

    return transactionHandler
      .query<Member>(sql`
        INSERT INTO member (name, email)
        VALUES (${name}, ${email})
        RETURNING ${MemberService.allColumns}
      `)
      .then(({ rows }) => rows[0]);
  }
}
