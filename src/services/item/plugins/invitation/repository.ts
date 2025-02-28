import { and, eq } from 'drizzle-orm/expressions';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { isAncestorOrSelf } from '../../../../drizzle/operations';
import { InvitationInsertDTO, invitationsTable } from '../../../../drizzle/schema';
import { InvitationRaw } from '../../../../drizzle/types';
import { throwsIfParamIsInvalid } from '../../../../repositories/utils';
import { AuthenticatedUser } from '../../../../types';
import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { InvitationNotFound } from './errors';

type CreatorId = Member['id'];
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

  async getOne(db: DBConnection, id: string) {
    throwsIfParamIsInvalid('id', id);
    return await db.query.invitationsTable.findFirst({
      with: { item: true },
      where: eq(invitationsTable.id, id),
    });
  }

  /**
   * Get invitation by id or null if it is not found
   * @param id Invitation id
   */
  async getOneByIdAndByCreatorOrThrow(
    db: DBConnection,
    id: string,
    creatorId: CreatorId,
  ): Promise<InvitationWIthItemAndCreator> {
    throwsIfParamIsInvalid('id', id);
    throwsIfParamIsInvalid('creatorId', creatorId);

    const entity = await db.query.invitationsTable.findFirst({
      where: and(eq(invitationsTable.id, id), eq(invitationsTable.creatorId, creatorId)),
      with: {
        item: true,
        creator: true,
      },
    });

    if (!entity) {
      throw new InvitationNotFound(id);
    }

    return entity;
  }

  /**
   * Get invitations for item path and below
   * @param itemPath Item path
   */
  async getManyByItem(db: DBConnection, itemPath: ItemPath) {
    throwsIfParamIsInvalid('itemPath', itemPath);

    return await db.query.invitationsTable.findMany({
      where: isAncestorOrSelf(invitationsTable.itemPath, itemPath),
      with: { item: true },
    });
  }

  async getManyByEmail(db: DBConnection, email: Email) {
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
    partialInvitations: InvitationInsertDTO[],
    itemPath: string,
    creator: AuthenticatedUser,
  ): Promise<InvitationRaw[]> {
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

    return await db
      .insert(invitationsTable)
      .values(
        data
          .filter(
            (i) =>
              // exclude duplicate item-email combinations that are already invited
              !existingEntries.find(
                ({ email, item }) => email === i.email && item.path === itemPath,
              ),
          )
          .map((inv) => ({
            ...inv,
            item: { path: itemPath },
            creator,
          })),
      )
      .returning();
  }

  async updateOne(db: DBConnection, invitationId: string, body: Partial<InvitationInsertDTO>) {
    await db
      .update(invitationsTable)
      .set(body)
      .where(eq(invitationsTable.id, invitationId))
      .returning();
  }

  async deleteManyByEmail(db: DBConnection, email: Email) {
    throwsIfParamIsInvalid('email', email);

    await db.delete(invitationsTable).where(eq(invitationsTable.email, email));
  }
}
