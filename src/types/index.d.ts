import { Database } from 'plugins/database';
import { ItemService } from 'services/items/db-service';
import { ItemMembershipService } from 'services/item-memberships/db-service';
import { MemberService } from 'services/members/db-service';
import { Member } from 'services/members/interfaces/member';
import { BaseTaskManager } from 'services/base-task-manager';
import { Item } from 'services/items/interfaces/item';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    memberService: MemberService;
    itemService: ItemService;
    itemMembershipService: ItemMembershipService;
    taskManager: BaseTaskManager<Item /*| Member*/>;
  }

  interface FastifyRequest {
    member: Member;
  }
}
