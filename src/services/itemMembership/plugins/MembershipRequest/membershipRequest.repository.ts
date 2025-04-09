import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { membershipRequestsTable } from '../../../../drizzle/schema';
import { ItemNotFound, MemberNotFound } from '../../../../utils/errors';
import { AccountNotFound } from '../../../account/errors';

@singleton()
export class MembershipRequestRepository {
  async get(db: DBConnection, memberId: string, itemId: string) {
    if (!memberId) {
      throw new AccountNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    return await db.query.membershipRequestsTable.findFirst({
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

  async post(db: DBConnection, memberId: string, itemId: string) {
    if (!memberId) {
      throw new MemberNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    return await db
      .insert(membershipRequestsTable)
      .values({
        memberId,
        itemId,
      })
      .returning();
  }

  async getAllByItem(db: DBConnection, itemId: string) {
    if (!itemId) {
      throw new ItemNotFound(itemId);
    }
    const res = await db.query.membershipRequestsTable.findMany({
      where: eq(membershipRequestsTable.itemId, itemId),
      with: { member: true },
    });
    return res.map((r) => ({
      ...r,
      // HACK: to ensure email is defined
      member: { ...r.member, email: r.member.email! },
    }));
  }

  async deleteOne(db: DBConnection, memberId: string, itemId: string) {
    const res = await db
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
