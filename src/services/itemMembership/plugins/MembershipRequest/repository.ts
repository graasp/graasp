import { EntityManager } from 'typeorm';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { ItemNotFound, MemberNotFound } from '../../../../utils/errors';
import { MembershipRequest } from './entities/MembershipRequest';

export class MembershipRequestRepository extends AbstractRepository<MembershipRequest> {
  constructor(manager?: EntityManager) {
    super(MembershipRequest, manager);
  }

  async get(memberId: string, itemId: string) {
    if (!memberId) {
      throw new MemberNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    return await this.repository.findOne({
      where: {
        member: { id: memberId },
        item: { id: itemId },
      },
      relations: ['member', 'item'],
    });
  }

  async post(memberId: string, itemId: string) {
    await this.repository.insert({
      member: { id: memberId },
      item: { id: itemId },
    });
    return await this.get(memberId, itemId);
  }
}
