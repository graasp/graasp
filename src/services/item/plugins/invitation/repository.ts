import { ResultOf } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { Member } from '../../../member/entities/member';
import { mapById } from '../../../utils';
import { InvitationNotFound } from './errors';
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
    const query = this.createQueryBuilder('invitation')
      .innerJoinAndSelect('invitation.item', 'item')
      .where('invitation.id = :id', { id });

    if (actor) {
      query.innerJoinAndSelect('invitation.creator', 'creator');
    }
    const invitation = await query.getOne();
    if (!invitation) {
      throw new InvitationNotFound(id);
    }
    return invitation;
  },

  /**
   * Get invitations map by id
   * @param ids Invitation ids
   */
  async getMany(ids: string[], actor?: Member): Promise<ResultOf<Invitation>> {
    const query = this.createQueryBuilder('invitation')
      .innerJoinAndSelect('invitation.item', 'item')
      .where('invitation.id IN (:...ids)', { ids });

    if (actor) {
      query.innerJoinAndSelect('invitation.creator', 'creator');
    }
    const invitations = await query.getMany();

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
  async getForItem(itemPath: string): Promise<Invitation[]> {
    return this.createQueryBuilder('invitation')
      .innerJoinAndSelect('invitation.item', 'item')
      .where(':path <@ item.path', { path: itemPath })
      .getMany();
  },

  /**
   * Create invitation and return it.
   * @param invitation Invitation to create
   */
  async postMany(
    partialInvitations: Partial<Invitation>[],
    itemPath: string,
    creator: Member,
  ): Promise<ResultOf<Invitation>> {
    const invitations = partialInvitations.map((inv) => ({
      ...inv,
      // this normalisation is necessary because we match emails 1:1 and they are expeted to be in lowercase
      email: inv.email?.toLowerCase(),
    }));
    const existingEntries = await this.createQueryBuilder('invitation')
      .leftJoinAndSelect('invitation.item', 'item')
      .where('item.path @> :path', { path: itemPath })
      .getMany();

    const insertResult = await this.insert(
      invitations
        .filter(
          (i) =>
            !existingEntries.find(({ email, item }) => email === i.email && item.id === itemPath),
        )
        .map((invitations) => ({
          ...invitations,
          item: { path: itemPath },
          creator,
        })),
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
