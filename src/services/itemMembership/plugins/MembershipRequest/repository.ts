import { EntityManager } from 'typeorm';

import { AbstractRepository } from '../../../../repository';
import { MembershipRequest } from './entities/MembershipRequest';

export class MembershipRequestRepository extends AbstractRepository<MembershipRequest> {
  constructor(manager?: EntityManager) {
    super(MembershipRequest, manager);
  }
}
