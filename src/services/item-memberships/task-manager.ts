// global
// other services
import { Member } from '../../services/members/interfaces/member';
import { ItemService } from '../../services/items/db-service';
import { MemberService } from '../members/db-service';
import { GetItemTask } from '../items/tasks/get-item-task';
// local
import { ItemMembershipService } from './db-service';
import { ItemMembership, PermissionLevel } from './interfaces/item-membership';
import {
  CreateItemMembershipSubTask,
  CreateItemMembershipTask,
} from './tasks/create-item-membership-task';
import { UpdateItemMembershipTask } from './tasks/update-item-membership-task';
import { DeleteItemMembershipTask } from './tasks/delete-item-membership-task';
import { GetItemsItemMembershipsTask } from './tasks/get-items-item-membership-task';
import { ItemMembershipTaskManager } from './interfaces/item-membership-task-manager';
import { DeleteItemItemMembershipsTask } from './tasks/delete-item-item-memberships-task';
import { Task } from '../../interfaces/task';
import { GetItemMembershipTask } from './tasks/get-item-membership-task';
import {
  GetMemberItemMembershipOverItemTask,
  GetMemberItemMembershipOverItemTaskInputType,
} from './tasks/get-member-item-membership-over-item-task';
import { GetItemWithPathTask } from '../items/tasks/get-item-with-path-task';
import { GetMemberTask } from '../members/tasks/get-member-task';
import { Actor } from '../../interfaces/actor';

export class TaskManager implements ItemMembershipTaskManager<Member | Actor> {
  private itemService: ItemService;
  private itemMembershipService: ItemMembershipService;
  private memberService: MemberService;

  constructor(
    itemService: ItemService,
    itemMembershipService: ItemMembershipService,
    memberService: MemberService,
  ) {
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
    this.memberService = memberService;
  }

  getCreateTaskName(): string {
    return CreateItemMembershipTask.name;
  }
  getGetTaskName(): string {
    throw new Error('Method not implemented.');
  }
  getUpdateTaskName(): string {
    return UpdateItemMembershipTask.name;
  }
  getDeleteTaskName(): string {
    return DeleteItemMembershipTask.name;
  }

  getGetOfItemTaskName(): string {
    return GetItemsItemMembershipsTask.name;
  }
  getDeleteAllOnAndBelowItemTaskName(): string {
    return DeleteItemItemMembershipsTask.name;
  }

  // CRUD
  createCreateTask(member: Member, data: Partial<ItemMembership>): CreateItemMembershipSubTask {
    return new CreateItemMembershipSubTask(member, this.itemMembershipService, { data });
  }

  createCreateTaskSequence(
    member: Member,
    data: Partial<ItemMembership>,
    itemId: string,
  ): Task<Actor, unknown>[] {
    const t1 = new GetItemTask(member, this.itemService, { itemId });

    const t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t2.getInput = () => ({ item: t1.result, validatePermission: PermissionLevel.Admin });

    const t3 = new GetMemberTask(member, this.memberService, { memberId: data.memberId });

    const t4 = new CreateItemMembershipTask(member, this.itemMembershipService, { data });
    t4.getInput = () => ({ item: t1.result });

    return [t1, t2, t3, t4];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createGetTask(member: Member, objectId: string): Task<Member, ItemMembership> {
    throw new Error('Method not implemented.');
  }

  createUpdateTaskSequence(
    member: Member,
    itemMembershipId: string,
    data: Partial<ItemMembership>,
  ): Task<Member, unknown>[] {
    const t1 = new GetItemMembershipTask(member, this.itemMembershipService, { itemMembershipId });

    const t2 = new GetItemWithPathTask(member, this.itemService);
    t2.getInput = () => ({ itemPath: t1.result.itemPath });

    const t3 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t3.getInput = () => ({ item: t2.result, validatePermission: PermissionLevel.Admin });

    const t4 = new UpdateItemMembershipTask(member, this.itemMembershipService);
    t4.getInput = () => ({ itemMembership: t1.result, item: t2.result, data });

    return [t1, t2, t3, t4];
  }

  createDeleteTaskSequence(
    member: Member,
    itemMembershipId: string,
    purgeBelow?: boolean,
  ): Task<Member, unknown>[] {
    const t1 = new GetItemMembershipTask(member, this.itemMembershipService, { itemMembershipId });

    const t2 = new GetItemWithPathTask(member, this.itemService);
    t2.getInput = () => {
      if (member.id !== t1.result.memberId) return { itemPath: t1.result.itemPath };
      t2.skip = true;
    };

    const t3 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t3.getInput = () => {
      if (member.id !== t1.result.memberId) {
        return { item: t2.result, validatePermission: PermissionLevel.Admin };
      }
      t3.skip = true;
    };

    const t4 = new DeleteItemMembershipTask(member, this.itemMembershipService, { purgeBelow });
    t4.getInput = () => ({ itemMembership: t1.result });

    return [t1, t2, t3, t4];
  }

  // Other
  createGetOfItemTaskSequence(member: Member, itemId: string): Task<Member, unknown>[] {
    const t1 = new GetItemTask(member, this.itemService, { itemId });

    const t2 = new GetItemsItemMembershipsTask(member, this.itemMembershipService);
    t2.getInput = () => ({ item: t1.result });

    return [t1, t2];
  }

  createDeleteAllOnAndBelowItemTaskSequence(
    member: Member,
    itemId: string,
  ): Task<Member, unknown>[] {
    const t1 = new GetItemTask(member, this.itemService, { itemId });

    const t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t2.getInput = () => ({ item: t1.result, validatePermission: PermissionLevel.Admin });

    const t3 = new DeleteItemItemMembershipsTask(member, this.itemMembershipService);
    t3.getInput = () => ({ item: t1.result });

    return [t1, t2, t3];
  }

  createGetMemberItemMembershipTask(
    actor: Member,
    input?: GetMemberItemMembershipOverItemTaskInputType,
  ): GetMemberItemMembershipOverItemTask {
    return new GetMemberItemMembershipOverItemTask(actor, this.itemMembershipService, input);
  }
}
