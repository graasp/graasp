import { singleton } from 'tsyringe';

import { ItemLoginSchemaStatus, PermissionLevel, UUID } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { hasPermission } from '../../../authorization';
import {
  CannotEnrollFrozenItemLoginSchema,
  CannotEnrollItemWithoutItemLoginSchema,
} from '../../../itemLogin/errors';
import { ItemLoginService } from '../../../itemLogin/service';
import { ItemMembershipAlreadyExists } from '../../../itemMembership/plugins/MembershipRequest/error';
import { Member } from '../../../member/entities/member';
import { ItemService } from '../../service';

@singleton()
export class EnrollService {
  private itemService: ItemService;
  private itemLoginService: ItemLoginService;

  constructor(itemService: ItemService, itemLoginService: ItemLoginService) {
    this.itemService = itemService;
    this.itemLoginService = itemLoginService;
  }

  async enroll(member: Member, repositories: Repositories, itemId: UUID) {
    const item = await this.itemService.get(
      member,
      repositories,
      itemId,
      PermissionLevel.Read,
      false,
    );

    const itemLoginSchema = await this.itemLoginService.getByItemPath(repositories, item.path);
    if (!itemLoginSchema || itemLoginSchema.status === ItemLoginSchemaStatus.Disabled) {
      throw new CannotEnrollItemWithoutItemLoginSchema();
    } else if (itemLoginSchema.status === ItemLoginSchemaStatus.Freeze) {
      throw new CannotEnrollFrozenItemLoginSchema();
    }

    // Check if the member already has an access to the item (from membership or item visibility), if so, throw an error
    if (await hasPermission(repositories, PermissionLevel.Read, member, item)) {
      throw new ItemMembershipAlreadyExists();
    }

    return await repositories.itemMembershipRepository.addOne({
      itemPath: item.path,
      permission: PermissionLevel.Read,
      accountId: member.id,
      creatorId: member.id,
    });
  }
}
