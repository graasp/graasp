import { and, eq } from 'drizzle-orm/expressions';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { isAncestorOrSelf } from '../../../../drizzle/operations';
import { type Invitation, invitations } from '../../../../drizzle/schema';
import { throwsIfParamIsInvalid } from '../../../../repositories/utils';
import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { InvitationNotFound } from './errors';

type CreatorId = Member['id'];
type ItemPath = Item['path'];
type Email = Invitation['email'];

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
    return await db.query.invitations.findFirst({
      with: { item: true },
      where: eq(invitations.id, id),
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
  ): Promise<Invitation> {
    throwsIfParamIsInvalid('id', id);
    throwsIfParamIsInvalid('creatorId', creatorId);

    const entity = await db.query.invitations.findFirst({
      where: and(eq(invitations.id, id), eq(invitations.creatorId, creatorId)),
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

    return await db.query.invitations.findMany({
      where: isAncestorOrSelf(invitations.itemPath, itemPath),
      with: { item: true },
    });
  }

  async getManyByEmail(db: DBConnection, email: Email) {
    throwsIfParamIsInvalid('email', email);
    const lowercaseEmail = email.toLowerCase();

    const res = await db.query.invitations.findMany({
      where: eq(invitations.email, lowercaseEmail),
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
    partialInvitations: Partial<Invitation>[],
    itemPath: string,
    creator: Member,
  ): Promise<Invitation[]> {
    const data = partialInvitations.map((inv) => ({
      ...inv,
      // this normalisation is necessary because we match emails 1:1 and they are expeted to be in lowercase
      email: inv.email?.toLowerCase(),
    }));
    // get invitations for the item and its parents
    const existingEntries = await db.query.invitations.findMany({
      with: { item: true },
      where: isAncestorOrSelf(invitations.itemPath, itemPath),
    });

    return await db
      .insert(invitations)
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

  async deleteManyByEmail(db: DBConnection, email: Email) {
    throwsIfParamIsInvalid('email', email);

    await db.delete(invitations).where(eq(invitations.email, email));
  }
}
