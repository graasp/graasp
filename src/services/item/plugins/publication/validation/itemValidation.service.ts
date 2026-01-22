import { mkdirSync } from 'fs';
import path from 'path';
import { singleton } from 'tsyringe';

import { ItemValidationStatus, type UUID } from '@graasp/sdk';

import type { DBConnection } from '../../../../../drizzle/db';
import { type ItemRaw } from '../../../../../drizzle/types';
import { BaseLogger } from '../../../../../logger';
import type { MinimalMember } from '../../../../../types';
import { TMP_FOLDER } from '../../../../../utils/config';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import type { FolderItem } from '../../../discrimination';
import { ItemRepository } from '../../../item.repository';
import { ItemPublishedService } from '../published/itemPublished.service';
import { ItemValidationGroupRepository } from './ItemValidationGroup.repository';
import { ItemValidationModerator } from './moderators/itemValidationModerator';
import { ValidationQueue } from './validationQueue';

@singleton()
export class ItemValidationService {
  private readonly itemPublishedService: ItemPublishedService;
  private readonly contentModerator: ItemValidationModerator;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly validationQueue: ValidationQueue;
  private readonly itemValidationGroupRepository: ItemValidationGroupRepository;
  private readonly itemRepository: ItemRepository;
  private readonly logger: BaseLogger;

  constructor(
    itemPublishedService: ItemPublishedService,
    contentModerator: ItemValidationModerator,
    authorizedItemService: AuthorizedItemService,
    validationQueue: ValidationQueue,
    itemValidationGroupRepository: ItemValidationGroupRepository,
    itemRepository: ItemRepository,
    logger: BaseLogger,
  ) {
    this.itemPublishedService = itemPublishedService;
    this.contentModerator = contentModerator;
    this.authorizedItemService = authorizedItemService;
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

  async getLastItemValidationGroupForItem(
    dbConnection: DBConnection,
    member: MinimalMember,
    item: ItemRaw,
  ) {
    const group = await this.itemValidationGroupRepository.getLastForItem(dbConnection, item.id);

    // check permissions
    await this.authorizedItemService.assertAccess(dbConnection, {
      permission: 'admin',
      accountId: member.id,
      item,
    });

    return group;
  }

  async post(dbConnection: DBConnection, item: FolderItem, onValidationStarted?: () => void) {
    const descendants = await this.itemRepository.getDescendants(dbConnection, item);

    // create record in item-validation
    const iVG = await this.itemValidationGroupRepository.post(dbConnection, item.id);

    // indicates that the item's validation is pending
    await this.validationQueue.addInProgress(item.id);
    // Indicates the caller that the validation will start.
    // It can be usefull if we want to refetch on the frontend to display the pending status.
    onValidationStarted?.();

    const items = [item, ...descendants];

    const results = await Promise.all(
      items.map(async (currItem) => {
        try {
          const validationResults = await this.contentModerator.validate(
            dbConnection,
            currItem,
            iVG.id,
          );
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
      await this.itemPublishedService.touchUpdatedAt(dbConnection, item);
    }

    return operationResult;
  }
}
