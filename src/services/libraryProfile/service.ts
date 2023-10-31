import { FastifyBaseLogger } from 'fastify';

import { Repositories } from '../../utils/repositories';
import { Member } from '../member/entities/member';

export class MemberProfileService {
  log: FastifyBaseLogger;

  constructor(log) {
    this.log = log;
  }

  async post(data, repositories: Repositories, member: Member | undefined) {
    const { memberProfileRepository } = repositories;
    const d = await memberProfileRepository.createOne({ ...data, member });
    return d;
  }
}
