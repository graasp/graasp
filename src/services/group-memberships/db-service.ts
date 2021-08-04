// global
import { sql, DatabaseTransactionConnectionType as TrxHandler } from 'slonik';
import {GroupMembershipTaskManager} from './interfaces/group-membership-task-manager';
import {GroupMembership} from './interfaces/group-membership';
// local

declare module 'fastify' {
  interface FastifyInstance {
    groupMemberships: {
      taskManager: GroupMembershipTaskManager,
      dbService: GroupMembershipService
    };
  }
}

export class GroupMembershipService {
  // the 'safe' way to dynamically generate the columns names:
  private static allColumns = sql.join(
    [
      'id',
      'member',
      'group',
    ].map(c =>
      !Array.isArray(c) ?
        sql.identifier([c]) :
        sql.join(c.map(cwa => sql.identifier([cwa])), sql` AS `)
    ),
    sql`, `
  );

  async create(membership: Partial<GroupMembership>, transactionHandler: TrxHandler): Promise<GroupMembership> {
    const { member,group } = membership;
    return transactionHandler.query<GroupMembership>(sql`
        INSERT INTO group_membership (member,"group")
        VALUES (${member}, ${group})
        RETURNING ${GroupMembershipService.allColumns}
      `)
      .then(({ rows }) => rows[0]);
  }

  async getGroupMemberships(memberId: string, transactionHandler: TrxHandler): Promise<GroupMembership[]> {

    return transactionHandler.query<GroupMembership>(sql`

      WITH RECURSIVE grpRecursion AS (
          SELECT * from group_membership
          WHERE member = ${memberId}

          UNION
              SELECT
                  gm.* from group_membership gm
              INNER JOIN grpRecursion s ON s."group" = gm.member


      ) SELECT * FROM grpRecursion
    `).then(({ rows }) => rows.slice(0));

  }

  async checkMembership(memberId: string, groupId: string, transactionHandler: TrxHandler) : Promise<boolean> {
    return transactionHandler.query<boolean>(sql`

      WITH RECURSIVE grpRecursion AS (
          SELECT * from group_membership
          WHERE member = ${memberId}

          UNION
              SELECT
                  gm.* from group_membership gm
              INNER JOIN grpRecursion s ON s."group" = gm.member


      ) SELECT * FROM grpRecursion WHERE "group" = ${groupId}
    `).then(({ rows }) => rows.length!==0);
  }

}
