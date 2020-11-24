import { Member } from './services/members/interfaces/member';

declare module 'fastify' {
  interface FastifyRequest {
    member: Member;
  }
}

/**
 * Types that will be available/exposed when
 * adding '@types/graasp' as a (dev) dependency
 */

export { Item } from './services/items/interfaces/item';
export { ItemTaskManager } from './services/items/task-manager';

export { Member } from './services/members/interfaces/member';
