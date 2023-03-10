import { In } from 'typeorm';

import { AppDataSource } from '../../plugins/datasource';
import { Member } from '../member/entities/member';
import { mapById } from '../utils';
import { DuplicateInvitationError, InvitationNotFound } from './errors';
import { Invitation } from './invitation';

/**
 * Database's first layer of abstraction for Invitations
 */
export const InvitationRepository = AppDataSource.getRepository(Invitation).extend({
  /**
   * Get invitation by id or null if it is not found
   * @param id Invitation id
   */
  async get(id: string, actor?: Member): Promise<Invitation> {
    const opts = actor ? { creator: true } : {};
    const invitation = await this.findOne({ where: { id }, relations: { item: true, ...opts } });
    if (!invitation) {
      throw new InvitationNotFound(id);
    }
    return invitation;
  },

  /**
   * Get invitations map by id
   * @param ids Invitation ids
   */
  async getMany(ids: string[], actor?: Member) {
    const opts = actor ? { creator: true } : {};
    const invitations = await this.find({
      where: { id: In(ids) },
      relations: { item: true, ...opts },
    });

    return mapById({
      keys: ids,
      findElement: (invId) => invitations.find(({ id }) => id === invId),
      buildError: (id) => new InvitationNotFound(id),
    });
  },

  /**
   * Get invitations for item path and below
   * @param itemPath Item path
   */
  async getForItem(itemPath: string): Promise<readonly Invitation[]> {
    return this.createQueryBuilder('invitation')
      .leftJoinAndSelect('invitation.item', 'item')
      .where(':path <@ item.path', { path: itemPath })
      .getMany();
  },

  /**
   * Create invitation and return it.
   * @param invitation Invitation to create
   */
  async postOne(
    invitation: Partial<Invitation>,
    creator: Member,
    itemId: string,
  ): Promise<Invitation> {
    const existingEntry = await this.findOneBy({ email: invitation.email });
    if (existingEntry) {
      throw new DuplicateInvitationError({ invitation });
    }

    return this.insert({ ...invitation, creator, item: { itemId } });
  },

  /**
   * Create invitation and return it.
   * @param invitation Invitation to create
   */
  async postMany(invitations: Partial<Invitation>[], itemId: string, creator: Member) {
    const existingEntries = await this.find({
      where: { email: In(invitations.map((i) => i.email)) },
      relations: { item: true },
    });

    const insertResult = await this.insert(
      invitations
        .filter(
          (i) =>
            !existingEntries.find(({ email, item }) => email === i.email && item.id === itemId),
        )
        .map((invitation) => ({ ...invitation, item: { id: itemId }, creator })),
    );
    // TODO: optimize
    return this.getMany(insertResult.identifiers.map(({ id }) => id));
  },

  /**
   * Update invitation
   * @param id Item id
   */
  async patch(id: string, data: Partial<Invitation>): Promise<Invitation> {
    await this.update(id, data);
    // TODO: optimize
    return this.get(id);
  },

  /**
   * Delete invitation
   * @see database_schema.sql
   * @param id Item id
   */
  async deleteOne(id: string): Promise<string> {
    await this.delete(id);
    return id;
  },

  async deleteForEmail(email: string): Promise<string> {
    await this.delete({ email });
    return email;
  },
});
