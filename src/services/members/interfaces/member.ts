// global
import { Actor } from '../../../interfaces/actor';
import { UnknownExtra } from '../../../interfaces/extra';

declare module 'fastify' {
  interface FastifyRequest {
    member?: Member;
  }
}

export enum MemberType {
  Individual = 'individual',
  Group = 'group'
}

export interface Member<T = UnknownExtra> extends Actor {
  id: string;
  name: string;
  email: string;
  type: MemberType;
  extra: T;
  createdAt: string;
  updatedAt: string;
}
