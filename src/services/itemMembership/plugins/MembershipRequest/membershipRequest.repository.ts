import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { membershipRequestsTable } from '../../../../drizzle/schema';
import type { MembershipRequestWithMember } from '../../../../drizzle/types';
import { ItemNotFound, MemberNotFound } from '../../../../utils/errors';
import { AccountNotFound } from '../../../account/errors';

@singleton()
export class MembershipRequestRepository {
  async get(dbConnection: DBConnection, memberId: string, itemId: string) {
    if (!memberId) {
      throw new AccountNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    return await dbConnection.query.membershipRequestsTable.findFirst({
      where: and(
        eq(membershipRequestsTable.memberId, memberId),
        eq(membershipRequestsTable.itemId, itemId),
      ),
      with: {
        member: true,
        item: true,
      },
    });
  }

  async post(dbConnection: DBConnection, memberId: string, itemId: string) {
    if (!memberId) {
      throw new MemberNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    return await dbConnection
      .insert(membershipRequestsTable)
      .values({
        memberId,
        itemId,
      })
      .returning();
  }

  async getAllByItem(
    dbConnection: DBConnection,
    itemId: string,
  ): Promise<MembershipRequestWithMember[]> {
    if (!itemId) {
      throw new ItemNotFound(itemId);
    }
    const res = await dbConnection.query.membershipRequestsTable.findMany({
      where: eq(membershipRequestsTable.itemId, itemId),
      with: { member: true },
    });
    return res as MembershipRequestWithMember[];
  }

  async deleteOne(dbConnection: DBConnection, memberId: string, itemId: string) {
    const res = await dbConnection
      .delete(membershipRequestsTable)
      .where(
        and(
          eq(membershipRequestsTable.memberId, memberId),
          eq(membershipRequestsTable.itemId, itemId),
        ),
      )
      .returning();
    return res[0];
  }
}
