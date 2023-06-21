import { FastifyLoggerInstance } from 'fastify';

import {
  Actor,
  DatabaseTransactionHandler,
  EtherpadItemExtra,
  Item,
  ItemMembership,
  ItemType,
  Member,
  MemberType,
  PermissionLevel,
  Task,
  TaskStatus,
} from '@graasp/sdk';

export const MOCK_GROUP_ID = 'g.s8oes9dhwrvt0zif';
export const MOCK_PAD_READ_ONLY_ID = 'r.s8oes9dhwrvt0zif';
export const MOCK_PAD_ID = 'g.s8oes9dhwrvt0zif$mock-pad-name';
export const MOCK_AUTHOR_ID = 'a.s8oes9dhwrvt0zif';
export const MOCK_SESSION_ID = 's.s8oes9dhwrvt0zif';
export const MODES: Array<'read' | 'write'> = ['read', 'write'];

export const MOCK_MEMBER: Member = {
  name: 'mock-name',
  email: 'mock-email',
  type: 'individual' as MemberType,
  extra: {},
  createdAt: 'mock-created-at',
  updatedAt: 'mock-updated-at',
  id: 'mock-id',
};

export const MOCK_MEMBERSHIP: ItemMembership = {
  id: 'mock-id',
  memberId: 'mock-member-id',
  itemPath: 'mock-item-path',
  permission: 'read' as PermissionLevel,
  creator: 'mock-creator',
  createdAt: 'mock-created-at',
  updatedAt: 'mock-updated-at',
};

export const MOCK_ITEM: Item<EtherpadItemExtra> = {
  id: 'mock-id',
  name: 'mock-name',
  description: 'mock-description',
  type: ItemType.ETHERPAD,
  path: 'mock-path',
  extra: {
    etherpad: {
      padID: MOCK_PAD_ID,
      groupID: MOCK_GROUP_ID,
    },
  },
  creator: 'mock-creator',
  createdAt: 'mock-created-at',
  updatedAt: 'mock-updated-at',
  settings: {},
};

/**
 * Mock item result task factory
 */
export const mockTask = <T>(
  name: string,
  actor: Actor,
  result: T,
  status: TaskStatus = TaskStatus.NEW,
  run: (
    handler: DatabaseTransactionHandler,
    log: FastifyLoggerInstance,
  ) => Promise<void | Task<Actor, T>[]> = async (handler, log) => {
    status = TaskStatus.OK;
  },
): Task<Actor, T> => ({
  name,
  actor,
  status,
  result,
  run,
});

export const DELETE_ITEM_TASK_NAME = 'DeleteItemTask';
export const COPY_ITEM_TASK_NAME = 'CopyItemTask';
