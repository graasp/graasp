import { singleton } from 'tsyringe';

import { ItemLoginSchemaStatus, PermissionLevel, UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import {
  CannotEnrollFrozenItemLoginSchema,
  CannotEnrollItemWithoutItemLoginSchema,
} from '../../../itemLogin/errors';
import { ItemLoginService } from '../../../itemLogin/itemLogin.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ItemMembershipAlreadyExists } from '../../../itemMembership/plugins/MembershipRequest/error';
import { ItemRepository } from '../../item.repository';

@singleton()
export class EnrollService {
  private readonly itemLoginService: ItemLoginService;
  private readonly itemRepository: ItemRepository;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly itemMembershipRepository: ItemMembershipRepository;

  constructor(
    itemLoginService: ItemLoginService,
    itemRepository: ItemRepository,
    authorizedItemService: AuthorizedItemService,
    itemMembershipRepository: ItemMembershipRepository,
  ) {
    this.itemLoginService = itemLoginService;
    this.itemRepository = itemRepository;
    this.authorizedItemService = authorizedItemService;
    this.itemMembershipRepository = itemMembershipRepository;
  }

  async enroll(dbConnection: DBConnection, member: MinimalMember, itemId: UUID) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    const itemLoginSchema = await this.itemLoginService.getByItemPath(dbConnection, item.path);
    if (!itemLoginSchema || itemLoginSchema.status === ItemLoginSchemaStatus.Disabled) {
      throw new CannotEnrollItemWithoutItemLoginSchema();
    } else if (itemLoginSchema.status === ItemLoginSchemaStatus.Freeze) {
      throw new CannotEnrollFrozenItemLoginSchema();
    }

    // Check if the member already has an access to the item (from membership or item visibility), if so, throw an error
    try {
      await this.authorizedItemService.assertPermission(dbConnection, {
        permission: PermissionLevel.Read,
        actor: member,
        item,
      });
      throw new ItemMembershipAlreadyExists();
    } catch (_e) {
      // we expect the member to not have access to the item
    }

    await this.itemMembershipRepository.addOne(dbConnection, {
      itemPath: item.path,
      permission: PermissionLevel.Read,
      accountId: member.id,
      creatorId: member.id,
    });
  }
}
