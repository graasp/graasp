import { ItemTagType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../../utils/repositories';
import { Member } from '../../../../member/entities/member';
import { ItemWrapper } from '../../../ItemWrapper';
import { ItemService } from '../../../service';
import { ItemTagRepository } from '../../itemTag/repository';
import { ItemPublishedRepository } from '../published/repositories/itemPublished';
import { ItemValidationGroupRepository } from '../validation/repositories/ItemValidationGroup';
import { PublicationState } from './publicationState';

export class PublicationService {
  private readonly itemService: ItemService;
  private readonly itemTagRepository: ItemTagRepository;
  private readonly validationRepository: typeof ItemValidationGroupRepository;
  private readonly publishedRepository: ItemPublishedRepository;

  constructor(
    itemService: ItemService,
    itemTagRepository: ItemTagRepository,
    validationRepository: typeof ItemValidationGroupRepository,
    publishedRepository: ItemPublishedRepository,
  ) {
    this.itemService = itemService;
    this.itemTagRepository = itemTagRepository;
    this.validationRepository = validationRepository;
    this.publishedRepository = publishedRepository;
  }

  public async computeStateForItem(member: Member, repositores: Repositories, itemId: string) {
    const item = await this.itemService.get(member, repositores, itemId, PermissionLevel.Admin);
    const publicTag = await this.itemTagRepository.getType(item, ItemTagType.Public, {
      shouldThrow: false,
    });
    const packedItem = new ItemWrapper(item, undefined, publicTag ? [publicTag] : []).packed();
    const validationGroup = await this.validationRepository.getLastForItem(itemId);
    const publishedEntry = (await this.publishedRepository.getForItem(item)) ?? undefined;

    return new PublicationState(packedItem, validationGroup, publishedEntry?.item).computeStatus();
  }
}
