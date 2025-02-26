import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { membershipRequests } from '../../../../drizzle/schema';
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

    return await db.query.membershipRequests.findFirst({
      where: and(eq(membershipRequests.memberId, memberId), eq(membershipRequests.itemId, itemId)),
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
      .insert(membershipRequests)
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
    return await db.query.membershipRequests.findMany({
      where: eq(membershipRequests.itemId, itemId),
      with: { member: true },
    });
  }

  async deleteOne(db: DBConnection, memberId: string, itemId: string) {
    return await db
      .delete(membershipRequests)
      .where(and(eq(membershipRequests.memberId, memberId), eq(membershipRequests.itemId, itemId)));
  }
}
