import { Item } from './services/items/interfaces/item';
import { Member } from './services/members/interfaces/member';
import { TaskManager } from './interfaces/task-manager';
import { TaskManagerHookHandlers } from './interfaces/task-manager-hook-handlers';

declare module 'fastify' {
  interface FastifyRequest {
    member: Member;
  }
}

/**
 * Types that will be available/exposed when
 * adding '@types/graasp' as a (dev) dependency
 */

// Items
export * from './services/items/interfaces/item';
export type ItemTaskManager = TaskManager<Member, Item> & TaskManagerHookHandlers<Item>;

// Members
export * from './services/members/interfaces/member';
