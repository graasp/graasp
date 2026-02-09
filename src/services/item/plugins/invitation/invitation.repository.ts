import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { isAncestorOrSelf } from '../../../../drizzle/operations';
import { invitationsTable, items } from '../../../../drizzle/schema';
import type {
  InvitationInsertDTO,
  InvitationRaw,
  InvitationWithItem,
} from '../../../../drizzle/types';
import { throwsIfParamIsInvalid } from '../../../../repositories/utils';
import type { AuthenticatedUser } from '../../../../types';
import type { ItemRaw } from '../../item';

type ItemPath = ItemRaw['path'];
type Email = InvitationRaw['email'];

/**
 * Database's first layer of abstraction for Invitations
 */
@singleton()
export class InvitationRepository {
  async getOne(dbConnection: DBConnection, id: string): Promise<InvitationWithItem | null> {
    throwsIfParamIsInvalid('id', id);
    const entity = await dbConnection
      .select()
      .from(invitationsTable)
      .where(and(eq(invitationsTable.id, id)))
      // item should not be deleted
      .innerJoin(items, eq(items.path, invitationsTable.itemPath))
      .limit(1);

    if (!entity.length) {
      return null;
    }

    return { ...entity[0].invitation, item: entity[0].item_view };
  }

  // /**
  //  * Get invitation by id or null if it is not found
  //  * @param id Invitation id
  //  */
  // async getOneByIdAndByCreatorOrThrow(
  //   dbConnection: DBConnection,
  //   id: string,
  // ): Promise<InvitationWithItem | null> {
  //   throwsIfParamIsInvalid('id', id);

  //   const entity = await dbConnection
  //     .select()
  //     .from(invitationsTable)
  //     .where(and(eq(invitationsTable.id, id)))
  //     // item should not be deleted
  //     .innerJoin(items, eq(items.path, invitationsTable.itemPath))
  //     .limit(1);

  //   if (!entity.length) {
  //     return null;
  //   }

  //   return { ...entity[0].invitation, item: entity[0].item_view };
  // }

  /**
   * Get invitations for item path and below
   * @param itemPath Item path
   */
  async getManyByItem(
    dbConnection: DBConnection,
    itemPath: ItemPath,
  ): Promise<InvitationWithItem[]> {
    throwsIfParamIsInvalid('itemPath', itemPath);

    return await dbConnection.query.invitationsTable.findMany({
      where: isAncestorOrSelf(invitationsTable.itemPath, itemPath),
      with: { item: true },
    });
  }

  async getManyByEmail(dbConnection: DBConnection, email: Email): Promise<InvitationWithItem[]> {
    throwsIfParamIsInvalid('email', email);
    const lowercaseEmail = email.toLowerCase();

    const res = await dbConnection.query.invitationsTable.findMany({
      where: eq(invitationsTable.email, lowercaseEmail),
      with: { item: true },
    });

    return res;
  }

  /**
   * Create many invitations and return them.
   * @param partialInvitations array of data to create the invitations
   * @param itemPath path of the item to use ot create the invitations
   * @param creator user responsible for the creation of invitations
   */
  async addMany(
    dbConnection: DBConnection,
    partialInvitations: Pick<InvitationInsertDTO, 'permission' | 'email'>[],
    itemPath: string,
    creator: AuthenticatedUser,
  ): Promise<void> {
    const data = partialInvitations.map((inv) => ({
      ...inv,
      // this normalisation is necessary because we match emails 1:1 and they are expeted to be in lowercase
      email: inv.email?.toLowerCase(),
    }));
    // get invitations for the item and its parents
    const existingEntries = await dbConnection.query.invitationsTable.findMany({
      with: { item: true },
      where: isAncestorOrSelf(invitationsTable.itemPath, itemPath),
    });

    const newInvitations = data
      .filter(
        (i) =>
          // exclude duplicate item-email combinations that are already invited
          !existingEntries.find(({ email, item }) => email === i.email && item.path === itemPath),
      )
      .map((inv) => ({
        ...inv,
        itemPath,
        creator,
      }));
    if (newInvitations.length) {
      await dbConnection.insert(invitationsTable).values(newInvitations);
    }
  }

  async updateOne(
    dbConnection: DBConnection,
    invitationId: string,
    body: Partial<InvitationInsertDTO>,
  ): Promise<void> {
    await dbConnection
      .update(invitationsTable)
      .set(body)
      .where(eq(invitationsTable.id, invitationId))
      .returning();
  }

  async deleteManyByEmail(dbConnection: DBConnection, email: Email): Promise<void> {
    throwsIfParamIsInvalid('email', email);

    await dbConnection.delete(invitationsTable).where(eq(invitationsTable.email, email));
  }

  async delete(dbConnection: DBConnection, invitationId: string): Promise<void> {
    await dbConnection.delete(invitationsTable).where(eq(invitationsTable.id, invitationId));
  }
}
