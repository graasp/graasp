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
  CreateItemMembershipTaskInputType,
} from './tasks/create-item-membership-task';
import { UpdateItemMembershipTask } from './tasks/update-item-membership-task';
import { DeleteItemMembershipTask } from './tasks/delete-item-membership-task';
import { GetOneItemItemMembershipsTask } from './tasks/get-one-item-item-membership-task';
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
import { Item, UnknownExtra } from '../..';
import { GetManyItemsItemMembershipsTask } from './tasks/get-many-items-item-membership-task';

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
    return GetOneItemItemMembershipsTask.name;
  }
  getDeleteAllOnAndBelowItemTaskName(): string {
    return DeleteItemItemMembershipsTask.name;
  }

  // CRUD
  createCreateTask(member: Member, data: Partial<ItemMembership>): CreateItemMembershipSubTask {
    return new CreateItemMembershipSubTask(member, this.itemMembershipService, { data });
  }

  createGetAdminMembershipTaskSequence(member: Member, itemId: string) {
    const t1 = new GetItemTask(member, this.itemService, { itemId });

    const t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t2.getInput = () => ({ item: t1.result, validatePermission: PermissionLevel.Admin });

    return [t1, t2];
  }

  createCreateSubTaskSequence(member: Member, input: CreateItemMembershipTaskInputType) {
    const t1 = new GetMemberTask(member, this.memberService, { memberId: input.data.memberId });

    const t2 = new CreateItemMembershipTask(member, this.itemMembershipService, input);
    return [t1, t2];
  }

  createCreateTaskSequence(
    member: Member,
    input: Partial<ItemMembership>,
    itemId: string,
  ): Task<Actor, unknown>[] {
    const checkAdminMembershipTaskSequence = this.createGetAdminMembershipTaskSequence(
      member,
      itemId,
    );

    const createTaskSequence = this.createCreateSubTaskSequence(member, { data: input });
    // set item in last create task
    const getItemTask = checkAdminMembershipTaskSequence[0] as GetItemTask<UnknownExtra>;
    const [_getMemberTask, createTask] = createTaskSequence;
    createTask.getInput = () => ({ ...input, item: getItemTask.result });

    return [...checkAdminMembershipTaskSequence, ...createTaskSequence];
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

  // get item memberships for given item
  createGetOfItemTask(member: Member, item?: Item): GetOneItemItemMembershipsTask {
    return new GetOneItemItemMembershipsTask(member, this.itemMembershipService, { item });
  }

  // get item memberships for many items
  createGetOfManyItemsTask(
    member: Member,
    items?: Item[],
    shouldValidatePermission?: boolean,
  ): GetManyItemsItemMembershipsTask {
    return new GetManyItemsItemMembershipsTask(member, this.itemMembershipService, {
      items,
      shouldValidatePermission,
    });
  }

  // Other
  createGetOfItemTaskSequence(member: Member, itemId: string): Task<Member, unknown>[] {
    const t1 = new GetItemTask(member, this.itemService, { itemId });

    const t2 = new GetOneItemItemMembershipsTask(member, this.itemMembershipService);
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
