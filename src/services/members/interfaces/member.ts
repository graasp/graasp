// global
import { Actor } from '../../../interfaces/actor';

declare module 'fastify' {
  interface FastifyRequest {
    member: Member;
  }
}

export enum MemberType {
  Individual = 'individual',
  Group = 'group'
}

export interface Member extends Actor {
  id: string;
  name: string;
  email: string;
  type: MemberType;
  createdAt: string;
  updatedAt: string;
}
