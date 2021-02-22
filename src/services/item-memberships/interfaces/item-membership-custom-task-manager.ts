// global
import { Actor } from '../../../interfaces/actor';
import { TaskManager } from '../../../interfaces/task-manager';
// other
import { Member } from '../../members/interfaces/member';
// local
import { ItemMembership } from './item-membership';
import { ItemMembershipTask } from './item-membership-task';

export interface ItemMembershipCustomTaskManager extends TaskManager<Actor, ItemMembership> {
  getGetItemsItemMembershipsTaskName(): string

  createGetItemsItemMembershipsTask(member: Member, itemId: string): ItemMembershipTask;
}
