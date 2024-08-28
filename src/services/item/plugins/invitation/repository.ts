import { EntityManager, FindOptionsRelations } from 'typeorm';

import { MutableRepository } from '../../../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../repositories/const';
import { EntryNotFoundBeforeDeleteException } from '../../../../repositories/errors';
import { AncestorOf } from '../../../../utils/typeorm/treeOperators';
import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { Invitation } from './entity';
import { InvitationNotFound } from './errors';

type CreatorId = Member['id'];
type ItemPath = Item['path'];
type Email = Invitation['email'];
const BASIC_RELATIONS: FindOptionsRelations<Invitation> = { item: true };

type CreateInvitationBody = {
  partialInvitations: Partial<Invitation>[];
  itemPath: ItemPath;
  creatorId: CreatorId;
};
type UpdateInvitationBody = Partial<Invitation>;

/**
 * Database's first layer of abstraction for Invitations
 */
export class InvitationRepository extends MutableRepository<Invitation, UpdateInvitationBody> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, Invitation, manager);
  }

  async addOne({ partialInvitations, itemPath, creatorId }: CreateInvitationBody) {
    this.throwsIfParamIsInvalid('itemPath', itemPath);
    this.throwsIfParamIsInvalid('creatorId', creatorId);

    return await super.insert({
      ...partialInvitations,
      item: { path: itemPath },
      creator: { id: creatorId },
    });
  }

  async getOne(id: string) {
    this.throwsIfPKIsInvalid(id);
    return await this.repository
      .createQueryBuilder('invitation')
      .innerJoinAndSelect('invitation.item', 'item')
      .where('invitation.id = :id', { id })
      .getOne();
  }

  /**
   * Get invitation by id or null if it is not found
   * @param id Invitation id
   */
  async getOneByIdAndByCreatorOrThrow(id: string, creatorId: CreatorId): Promise<Invitation> {
    this.throwsIfPKIsInvalid(id);
    this.throwsIfParamIsInvalid('creatorId', creatorId);

    const entity = await this.repository
      .createQueryBuilder('invitation')
      .innerJoinAndSelect('invitation.item', 'item')
      .innerJoinAndSelect('invitation.creator', 'creator')
      .where('invitation.id = :id', { id })
      .andWhere('invitation.creator_id = :creatorId', { creatorId })
      .getOne();

    if (!entity) {
      throw new InvitationNotFound(id);
    }

    return entity;
  }

  /**
   * Get invitations for item path and below
   * @param itemPath Item path
   */
  async getManyByItem(itemPath: ItemPath) {
    this.throwsIfParamIsInvalid('itemPath', itemPath);

    return await this.repository.find({
      where: { item: { path: AncestorOf(itemPath) } },
      relations: { item: true },
    });
  }

  async getManyByEmail(email: Email) {
    this.throwsIfParamIsInvalid('email', email);
    const lowercaseEmail = email.toLowerCase();

    return await this.repository.find({
      where: { email: lowercaseEmail },
      relations: BASIC_RELATIONS,
    });
  }

  /**
   * Create many invitations and return them.
   * @param partialInvitations array of data to create the invitations
   * @param itemPath path of the item to use ot create the invitations
   * @param creator user responsible for the creation of invitations
   */
  async addMany(
    partialInvitations: Partial<Invitation>[],
    itemPath: string,
    creator: Member,
  ): Promise<Invitation[]> {
    const invitations = partialInvitations.map((inv) => ({
      ...inv,
      // this normalisation is necessary because we match emails 1:1 and they are expeted to be in lowercase
      email: inv.email?.toLowerCase(),
    }));
    // get invitations for the item and its parents
    const existingEntries = await this.repository
      .createQueryBuilder('invitation')
      .leftJoinAndSelect('invitation.item', 'item')
      .where('item.path @> :path', { path: itemPath })
      .getMany();

    const insertResult = await this.repository.insert(
      invitations
        .filter(
          (i) =>
            // exclude duplicate item-email combinations that are already invited
            !existingEntries.find(({ email, item }) => email === i.email && item.path === itemPath),
        )
        .map((invitations) => ({
          ...invitations,
          item: { path: itemPath },
          creator,
        })),
    );

    const ids = insertResult.identifiers.map(({ id }) => id);
    if (ids.length) {
      // get the created invitations
      const res = await this.repository
        .createQueryBuilder('invitation')
        .innerJoinAndSelect('invitation.item', 'item')
        .innerJoinAndSelect('invitation.creator', 'creator')
        .where('invitation.id IN (:...ids)', { ids })
        .getMany();
      return res;
    }
    return [];
  }

  async deleteByEmail(email: Email) {
    this.throwsIfParamIsInvalid('email', email);

    const entity = await this.repository.findOne({ where: { email } });
    if (!entity) {
      throw new EntryNotFoundBeforeDeleteException(this.entity);
    }
    await this.delete(entity.id);
  }
}
