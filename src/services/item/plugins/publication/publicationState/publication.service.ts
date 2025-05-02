import { singleton } from 'tsyringe';

import { ItemVisibilityType, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { AuthenticatedUser } from '../../../../../types';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import { ItemWrapper } from '../../../ItemWrapper';
import { ItemRepository } from '../../../item.repository';
import { ItemVisibilityRepository } from '../../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../published/itemPublished.repository';
import { ItemValidationGroupRepository } from '../validation/ItemValidationGroup.repository';
import { ValidationQueue } from '../validation/validationQueue';
import { PublicationState } from './publicationState';

@singleton()
export class PublicationService {
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  private readonly validationRepository: ItemValidationGroupRepository;
  private readonly publishedRepository: ItemPublishedRepository;
  private readonly validationQueue: ValidationQueue;
  private readonly itemRepository: ItemRepository;

  constructor(
    authorizedItemService: AuthorizedItemService,
    itemVisibilityRepository: ItemVisibilityRepository,
    validationRepository: ItemValidationGroupRepository,
    publishedRepository: ItemPublishedRepository,
    validationQueue: ValidationQueue,
    itemRepository: ItemRepository,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.validationRepository = validationRepository;
    this.publishedRepository = publishedRepository;
    this.validationQueue = validationQueue;
    this.itemRepository = itemRepository;
  }

  public async computeStateForItem(
    dbConnection: DBConnection,
    member: AuthenticatedUser,
    itemId: string,
  ) {
    const item = await this.itemRepository.getOneWithCreatorOrThrow(dbConnection, itemId);
    await this.authorizedItemService.hasPermission(dbConnection, {
      actor: member,
      item,
      permission: PermissionLevel.Admin,
    });
    const publicVisibility = await this.itemVisibilityRepository.getType(
      dbConnection,
      item.path,
      ItemVisibilityType.Public,
      {
        shouldThrow: false,
      },
    );
    const packedItem = new ItemWrapper(
      item,
      undefined,
      publicVisibility ? [publicVisibility] : [],
    ).packed();
    const validationGroup = await this.validationRepository.getLastForItem(dbConnection, itemId);
    const publishedEntry =
      (await this.publishedRepository.getForItem(dbConnection, item.path)) ?? undefined;
    const isValidationInProgress = await this.validationQueue.isInProgress(item.path);

    return new PublicationState(packedItem, {
      isValidationInProgress,
      validationGroup: validationGroup ?? undefined,
      publishedItem: publishedEntry?.item,
    }).computeStatus();
  }
}
