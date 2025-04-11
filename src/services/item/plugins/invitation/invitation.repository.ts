import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { isAncestorOrSelf } from '../../../../drizzle/operations';
import { invitationsTable, items } from '../../../../drizzle/schema';
import {
  InvitationInsertDTO,
  InvitationRaw,
  InvitationWithItem,
  Item,
} from '../../../../drizzle/types';
import { throwsIfParamIsInvalid } from '../../../../repositories/utils';
import { AuthenticatedUser } from '../../../../types';

type ItemPath = Item['path'];
type Email = InvitationRaw['email'];

// type CreateInvitationBody = {
//   partialInvitations: Partial<Invitation>[];
//   itemPath: ItemPath;
//   creatorId: CreatorId;
// };

/**
 * Database's first layer of abstraction for Invitations
 */
@singleton()
export class InvitationRepository {
  // async addOne(
  //   db: DBConnection,
  //   { partialInvitations, itemPath, creatorId }: CreateInvitationBody,
  // ) {
  //   throwsIfParamIsInvalid('itemPath', itemPath);
  //   throwsIfParamIsInvalid('creatorId', creatorId);

  //   return await db
  //     .insert(invitations)
  //     .values(
  //       partialInvitations.map((inv) => ({
  //         ...inv,
  //         itemPath,
  //         creatorId,
  //       })),
  //     )
  //     .returning();
  // }

  async getOne(db: DBConnection, id: string): Promise<InvitationWithItem | null> {
    throwsIfParamIsInvalid('id', id);
    const entity = await db
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
  //   db: DBConnection,
  //   id: string,
  // ): Promise<InvitationWithItem | null> {
  //   throwsIfParamIsInvalid('id', id);

  //   const entity = await db
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
  async getManyByItem(db: DBConnection, itemPath: ItemPath): Promise<InvitationWithItem[]> {
    throwsIfParamIsInvalid('itemPath', itemPath);

    return await db.query.invitationsTable.findMany({
      where: isAncestorOrSelf(invitationsTable.itemPath, itemPath),
      with: { item: true },
    });
  }

  async getManyByEmail(db: DBConnection, email: Email): Promise<InvitationWithItem[]> {
    throwsIfParamIsInvalid('email', email);
    const lowercaseEmail = email.toLowerCase();

    const res = await db.query.invitationsTable.findMany({
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
    db: DBConnection,
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
    const existingEntries = await db.query.invitationsTable.findMany({
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
      await db.insert(invitationsTable).values(newInvitations);
    }
  }

  async updateOne(
    db: DBConnection,
    invitationId: string,
    body: Partial<InvitationInsertDTO>,
  ): Promise<void> {
    await db
      .update(invitationsTable)
      .set(body)
      .where(eq(invitationsTable.id, invitationId))
      .returning();
  }

  async deleteManyByEmail(db: DBConnection, email: Email): Promise<void> {
    throwsIfParamIsInvalid('email', email);

    await db.delete(invitationsTable).where(eq(invitationsTable.email, email));
  }

  async delete(db: DBConnection, invitationId: string): Promise<void> {
    await db.delete(invitationsTable).where(eq(invitationsTable.id, invitationId));
  }
}
