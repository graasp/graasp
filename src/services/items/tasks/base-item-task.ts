// global
import { BaseTask } from '../../base-task';
// other services
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';

export abstract class BaseItemTask<R> extends BaseTask<Member, R> {
  protected itemService: ItemService;

  constructor(member: Member, itemService: ItemService, partialSubtasks?: boolean) {
    super(member);
    this.itemService = itemService;
    this._partialSubtasks = partialSubtasks;
  }
}
