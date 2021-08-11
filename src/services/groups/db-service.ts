// global
import { sql, DatabaseTransactionConnectionType as TrxHandler } from 'slonik';
import {GroupTaskManager} from './interfaces/group-task-manager';
import {Group} from '../members/interfaces/member';

// local

declare module 'fastify' {
  interface FastifyInstance {
    groups: {
      taskManager: GroupTaskManager,
      dbService: GroupService
    };
  }
}

export class GroupService {

  private static allColumnsForJoins = sql.join(
    [
      [['member', 'id'], ['id']],
      [['member', 'name'], ['name']],
      [['member', 'email'], ['email']],
      [['member', 'type'], ['type']],
      [['member', 'extra'], ['extra']],
      [['member', 'created_at'], ['createdAt']],
      [['member', 'updated_at'], ['updatedAt']],
    ].map(c => sql.join(c.map(cwa => sql.identifier(cwa)), sql` AS `)),
    sql`, `
  );


  async getGroupChildren(memberId: string, groupId: string, transactionHandler: TrxHandler) : Promise<Group[]> {

    return transactionHandler.query<Group>(sql`

      SELECT ${GroupService.allColumnsForJoins} FROM (
            WITH RECURSIVE subordinates AS (
                SELECT *
                from group_membership
                     WHERE member = ${memberId}

                UNION
                SELECT gm.*
                from group_membership gm
                INNER JOIN subordinates s ON s."group" = gm.member
            )
            SELECT *
            FROM subordinates
            ) as groupM
      JOIN member ON groupM.member = member.id
      WHERE groupM."group"= ${groupId}
      AND member.type='group'
    `).then(({ rows }) => rows.slice(0));
  }
  async getGroupParents(groupId: string, transactionHandler: TrxHandler) : Promise<Group[]> {

    return transactionHandler.query<Group>(sql`

      SELECT ${GroupService.allColumnsForJoins} FROM (
            WITH RECURSIVE subordinates AS (
                SELECT *
                from group_membership
                     WHERE member = ${groupId}

                UNION
                SELECT gm.*
                from group_membership gm
                INNER JOIN subordinates s ON s."group" = gm.member
            )
            SELECT *
            FROM subordinates
            ) as groupM
      JOIN member ON groupM."group" = member.id
    `).then(({ rows }) => rows.slice(0));
  }

  async getOwnGroups(memberId: string, transactionHandler: TrxHandler) : Promise<Group[]> {

    return transactionHandler.query<Group>(sql`

      SELECT DISTINCT ${GroupService.allColumnsForJoins} FROM (
            WITH RECURSIVE subordinates AS (
                SELECT *
                from group_membership
                     WHERE member = ${memberId}

                UNION
                SELECT gm.*
                from group_membership gm
                INNER JOIN subordinates s ON s."group" = gm.member
            )
            SELECT *
            FROM subordinates
            ) as groupM
      JOIN member ON groupM.group = member.id
    `).then(({ rows }) => rows.slice(0));
  }

  async getRootGroups (memberId: string,transationHandler: TrxHandler) : Promise<Group[]> {
    return transationHandler.query<Group>(sql`
        SELECT ${GroupService.allColumnsForJoins} FROM (SELECT DISTINCT groupM."group" FROM (
              WITH RECURSIVE subordinates AS (
                      SELECT *
                      from group_membership
                      WHERE member = ${memberId}

                      UNION
                      SELECT gm.*
                      from group_membership gm
                               INNER JOIN subordinates s ON s."group" = gm.member
                  )
                  SELECT *  FROM subordinates


                  ) as groupM

              WHERE groupM."group" NOT IN (
                  WITH RECURSIVE subordinates AS (
                      SELECT *
                      from group_membership
                      WHERE member = ${memberId}

                      UNION
                      SELECT gm.*
                      from group_membership gm
                               INNER JOIN subordinates s ON s."group" = gm.member
                  )
                  SELECT DISTINCT subordinates.member
                  FROM subordinates
              )) as groupIds JOIN member ON member.id = groupIds."group"
        `).then(({rows}) => rows.slice(0));
  }
}

