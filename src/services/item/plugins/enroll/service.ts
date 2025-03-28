import { singleton } from 'tsyringe';

import { ItemLoginSchemaStatus, PermissionLevel, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { MinimalMember } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
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
  private readonly authorizationService: AuthorizationService;
  private readonly itemMembershipRepository: ItemMembershipRepository;

  constructor(
    itemLoginService: ItemLoginService,
    itemRepository: ItemRepository,
    authorizationService: AuthorizationService,
    itemMembershipRepository: ItemMembershipRepository,
  ) {
    this.itemLoginService = itemLoginService;
    this.itemRepository = itemRepository;
    this.authorizationService = authorizationService;
    this.itemMembershipRepository = itemMembershipRepository;
  }

  async enroll(db: DBConnection, member: MinimalMember, itemId: UUID) {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    const itemLoginSchema = await this.itemLoginService.getByItemPath(db, item.path);
    if (!itemLoginSchema || itemLoginSchema.status === ItemLoginSchemaStatus.Disabled) {
      throw new CannotEnrollItemWithoutItemLoginSchema();
    } else if (itemLoginSchema.status === ItemLoginSchemaStatus.Freeze) {
      throw new CannotEnrollFrozenItemLoginSchema();
    }

    // Check if the member already has an access to the item (from membership or item visibility), if so, throw an error
    if (await this.authorizationService.hasPermission(db, PermissionLevel.Read, member, item)) {
      throw new ItemMembershipAlreadyExists();
    }

    await this.itemMembershipRepository.addOne(db, {
      itemPath: item.path,
      permission: PermissionLevel.Read,
      accountId: member.id,
      creatorId: member.id,
    });
  }
}
