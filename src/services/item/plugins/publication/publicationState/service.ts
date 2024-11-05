import { ItemVisibilityType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../../utils/repositories';
import { Account } from '../../../../account/entities/account';
import { ItemWrapper } from '../../../ItemWrapper';
import { ItemService } from '../../../service';
import { ItemVisibilityRepository } from '../../itemVisibility/repository';
import { ItemPublishedRepository } from '../published/repositories/itemPublished';
import { ItemValidationGroupRepository } from '../validation/repositories/ItemValidationGroup';
import { ValidationQueue } from '../validation/validationQueue';
import { PublicationState } from './publicationState';

export class PublicationService {
  private readonly itemService: ItemService;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  private readonly validationRepository: ItemValidationGroupRepository;
  private readonly publishedRepository: ItemPublishedRepository;
  private readonly validationQueue: ValidationQueue;

  constructor(
    itemService: ItemService,
    itemVisibilityRepository: ItemVisibilityRepository,
    validationRepository: ItemValidationGroupRepository,
    publishedRepository: ItemPublishedRepository,
    validationQueue: ValidationQueue,
  ) {
    this.itemService = itemService;
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.validationRepository = validationRepository;
    this.publishedRepository = publishedRepository;
    this.validationQueue = validationQueue;
  }

  public async computeStateForItem(member: Account, repositores: Repositories, itemId: string) {
    const item = await this.itemService.get(member, repositores, itemId, PermissionLevel.Admin);
    const publicTag = await this.itemVisibilityRepository.getType(
      item.path,
      ItemVisibilityType.Public,
      {
        shouldThrow: false,
      },
    );
    const packedItem = new ItemWrapper(item, undefined, publicTag ? [publicTag] : []).packed();
    const validationGroup = await this.validationRepository.getLastForItem(itemId);
    const publishedEntry = (await this.publishedRepository.getForItem(item)) ?? undefined;
    const isValidationInProgress = await this.validationQueue.isInProgress(item.path);

    return new PublicationState(packedItem, {
      isValidationInProgress,
      validationGroup: validationGroup ?? undefined,
      publishedItem: publishedEntry?.item,
    }).computeStatus();
  }
}
