import { mkdirSync } from 'fs';
import path from 'path';
import { singleton } from 'tsyringe';

import { ItemValidationStatus, PermissionLevel, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { Item } from '../../../../../drizzle/types';
import { BaseLogger } from '../../../../../logger';
import { MinimalMember } from '../../../../../types';
import { TMP_FOLDER } from '../../../../../utils/config';
import { AuthorizationService } from '../../../../authorization';
import { FolderItem } from '../../../discrimination';
import { ItemRepository } from '../../../repository';
import { ItemPublishedService } from '../published/service';
import { ItemValidationGroupRepository } from './ItemValidationGroup.repository';
import { ItemValidationModerator } from './moderators/itemValidationModerator';
import { ValidationQueue } from './validationQueue';

@singleton()
export class ItemValidationService {
  private readonly itemPublishedService: ItemPublishedService;
  private readonly contentModerator: ItemValidationModerator;
  private readonly authorizationService: AuthorizationService;
  private readonly validationQueue: ValidationQueue;
  private readonly itemValidationGroupRepository: ItemValidationGroupRepository;
  private readonly itemRepository: ItemRepository;
  private readonly logger: BaseLogger;

  constructor(
    itemPublishedService: ItemPublishedService,
    contentModerator: ItemValidationModerator,
    authorizationService: AuthorizationService,
    validationQueue: ValidationQueue,
    itemValidationGroupRepository: ItemValidationGroupRepository,
    itemRepository: ItemRepository,
    logger: BaseLogger,
  ) {
    this.itemPublishedService = itemPublishedService;
    this.contentModerator = contentModerator;
    this.authorizationService = authorizationService;
    this.itemValidationGroupRepository = itemValidationGroupRepository;
    this.validationQueue = validationQueue;
    this.itemRepository = itemRepository;
    this.logger = logger;
  }

  buildStoragePath(itemValidationId: UUID) {
    const p = path.join(TMP_FOLDER, 'validation', itemValidationId);
    mkdirSync(p, { recursive: true });
    return p;
  }

  async getLastItemValidationGroupForItem(db: DBConnection, member: MinimalMember, item: Item) {
    const group = await this.itemValidationGroupRepository.getLastForItem(db, item.id);

    // check permissions
    await this.authorizationService.validatePermission(db, PermissionLevel.Admin, member, item);

    return group;
  }

  async getItemValidationGroup(
    db: DBConnection,
    member: MinimalMember,
    itemValidationGroupId: string,
  ) {
    const group = await this.itemValidationGroupRepository.get(db, itemValidationGroupId);

    await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Admin,
      member,
      group.item,
    );

    return group;
  }

  async post(db: DBConnection, item: FolderItem, onValidationStarted?: () => void) {
    const descendants = await this.itemRepository.getDescendants(db, item);

    // create record in item-validation
    const iVG = await this.itemValidationGroupRepository.post(db, item.id);

    // indicates that the item's validation is pending
    await this.validationQueue.addInProgress(item.id);
    // Indicates the caller that the validation will start.
    // It can be usefull if we want to refetch on the frontend to display the pending status.
    onValidationStarted?.();

    const items = [item, ...descendants];

    const results = await Promise.all(
      items.map(async (currItem) => {
        try {
          const validationResults = await this.contentModerator.validate(db, currItem, iVG);
          return validationResults.every((v) => v === ItemValidationStatus.Success);
        } catch (e) {
          this.logger.error(e);
        }
        return false;
      }),
    );

    await this.validationQueue.removeInProgress(item.id);

    const operationResult = results.every((v) => v);

    // update publication date
    if (operationResult) {
      await this.itemPublishedService.touchUpdatedAt(db, item);
    }

    return operationResult;
  }
}
