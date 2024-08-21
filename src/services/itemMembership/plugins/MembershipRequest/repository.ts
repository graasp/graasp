import { EntityManager } from 'typeorm';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { ItemNotFound, MemberNotFound } from '../../../../utils/errors';
import { AccountNotFound } from '../../../account/errors';
import { MembershipRequest } from './entities/MembershipRequest';

export class MembershipRequestRepository extends AbstractRepository<MembershipRequest> {
  constructor(manager?: EntityManager) {
    super(MembershipRequest, manager);
  }

  async get(memberId: string, itemId: string) {
    if (!memberId) {
      throw new AccountNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    return await this.repository.findOne({
      where: {
        member: { id: memberId },
        item: { id: itemId },
      },
      relations: {
        member: true,
        item: true,
      },
    });
  }

  async post(memberId: string, itemId: string) {
    if (!memberId) {
      throw new MemberNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    await this.repository.insert({
      member: { id: memberId },
      item: { id: itemId },
    });
    return await this.get(memberId, itemId);
  }

  async getAllByItem(itemId: string) {
    if (!itemId) {
      throw new ItemNotFound(itemId);
    }
    return await this.repository.find({
      where: { item: { id: itemId } },
      relations: ['member'],
    });
  }

  async deleteOne(memberId: string, itemId: string) {
    const membershipRequest = await this.get(memberId, itemId);
    if (!membershipRequest) {
      return null;
    }
    await this.repository.delete(membershipRequest.id);
    return membershipRequest;
  }
}
