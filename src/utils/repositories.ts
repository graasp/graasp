import { EntityManager } from 'typeorm';

import { ActionRepository } from '../services/action/repositories/action.js';
import { MemberPasswordRepository } from '../services/auth/plugins/password/repository.js';
import { ChatMentionRepository } from '../services/chat/plugins/mentions/repository.js';
import { ChatMessageRepository } from '../services/chat/repository.js';
import { ActionRequestExportRepository } from '../services/item/plugins/action/requestExport/repository.js';
import { AppActionRepository } from '../services/item/plugins/app/appAction/repository.js';
import { AppDataRepository } from '../services/item/plugins/app/appData/repository.js';
import { AppSettingRepository } from '../services/item/plugins/app/appSetting/repository.js';
import { PublisherRepository } from '../services/item/plugins/app/publisherRepository.js';
import { AppRepository } from '../services/item/plugins/app/repository.js';
import { ItemGeolocationRepository } from '../services/item/plugins/geolocation/repository.js';
import { InvitationRepository } from '../services/item/plugins/invitation/repository.js';
import { CategoryRepository } from '../services/item/plugins/itemCategory/repositories/category.js';
import { ItemCategoryRepository } from '../services/item/plugins/itemCategory/repositories/itemCategory.js';
import { FavoriteRepository } from '../services/item/plugins/itemFavorite/repositories/favorite.js';
import { ItemFlagRepository } from '../services/item/plugins/itemFlag/repository.js';
import { ItemLikeRepository } from '../services/item/plugins/itemLike/repository.js';
import { ItemTagRepository } from '../services/item/plugins/itemTag/repository.js';
import { ItemPublishedRepository } from '../services/item/plugins/published/repositories/itemPublished.js';
import { RecycledItemDataRepository } from '../services/item/plugins/recycled/repository.js';
import { ShortLinkRepository } from '../services/item/plugins/shortLink/repository.js';
import { ItemValidationGroupRepository } from '../services/item/plugins/validation/repositories/ItemValidationGroup.js';
import { ItemValidationRepository } from '../services/item/plugins/validation/repositories/itemValidation.js';
import { ItemValidationReviewRepository } from '../services/item/plugins/validation/repositories/itemValidationReview.js';
import { ItemRepository } from '../services/item/repository.js';
import { ItemLoginRepository } from '../services/itemLogin/repositories/itemLogin.js';
import { ItemLoginSchemaRepository } from '../services/itemLogin/repositories/itemLoginSchema.js';
import { ItemMembershipRepository } from '../services/itemMembership/repository.js';
import MemberProfileRepository from '../services/member/plugins/profile/repository.js';
import { MemberRepository } from '../services/member/repository.js';

export type Repositories = {
  actionRepository: ActionRepository;
  actionRequestExportRepository: typeof ActionRequestExportRepository;
  appActionRepository: typeof AppActionRepository;
  appDataRepository: typeof AppDataRepository;
  appRepository: typeof AppRepository;
  appSettingRepository: typeof AppSettingRepository;
  categoryRepository: typeof CategoryRepository;
  chatMessageRepository: typeof ChatMessageRepository;
  invitationRepository: typeof InvitationRepository;
  itemCategoryRepository: typeof ItemCategoryRepository;
  itemFavoriteRepository: FavoriteRepository;
  itemFlagRepository: typeof ItemFlagRepository;
  itemLikeRepository: typeof ItemLikeRepository;
  itemLoginRepository: typeof ItemLoginRepository;
  itemLoginSchemaRepository: typeof ItemLoginSchemaRepository;
  itemMembershipRepository: typeof ItemMembershipRepository;
  itemPublishedRepository: ItemPublishedRepository;
  itemRepository: ItemRepository;
  itemTagRepository: ItemTagRepository;
  itemValidationGroupRepository: typeof ItemValidationGroupRepository;
  itemValidationRepository: typeof ItemValidationRepository;
  itemValidationReviewRepository: typeof ItemValidationReviewRepository;
  memberPasswordRepository: typeof MemberPasswordRepository;
  memberRepository: MemberRepository;
  mentionRepository: ChatMentionRepository;
  publisherRepository: typeof PublisherRepository;
  recycledItemRepository: typeof RecycledItemDataRepository;
  memberProfileRepository: typeof MemberProfileRepository;
  shortLinkRepository: typeof ShortLinkRepository;
  itemGeolocationRepository: ItemGeolocationRepository;
};
// public: exists in item tag

export const buildRepositories = (manager?: EntityManager): Repositories => ({
  itemRepository: new ItemRepository(manager),
  itemMembershipRepository: manager
    ? manager.withRepository(ItemMembershipRepository)
    : ItemMembershipRepository,
  memberRepository: new MemberRepository(manager),

  itemPublishedRepository: new ItemPublishedRepository(manager),
  itemLoginRepository: manager ? manager.withRepository(ItemLoginRepository) : ItemLoginRepository,
  itemLoginSchemaRepository: manager
    ? manager.withRepository(ItemLoginSchemaRepository)
    : ItemLoginSchemaRepository,
  memberPasswordRepository: manager
    ? manager.withRepository(MemberPasswordRepository)
    : MemberPasswordRepository,
  appRepository: manager ? manager.withRepository(AppRepository) : AppRepository,
  appDataRepository: manager ? manager.withRepository(AppDataRepository) : AppDataRepository,
  appActionRepository: manager ? manager.withRepository(AppActionRepository) : AppActionRepository,
  appSettingRepository: manager
    ? manager.withRepository(AppSettingRepository)
    : AppSettingRepository,
  publisherRepository: manager ? manager.withRepository(PublisherRepository) : PublisherRepository,
  recycledItemRepository: manager
    ? manager.withRepository(RecycledItemDataRepository)
    : RecycledItemDataRepository,
  itemLikeRepository: manager ? manager.withRepository(ItemLikeRepository) : ItemLikeRepository,
  itemFlagRepository: manager ? manager.withRepository(ItemFlagRepository) : ItemFlagRepository,
  invitationRepository: manager
    ? manager.withRepository(InvitationRepository)
    : InvitationRepository,
  chatMessageRepository: manager
    ? manager.withRepository(ChatMessageRepository)
    : ChatMessageRepository,
  mentionRepository: new ChatMentionRepository(manager),
  itemCategoryRepository: manager
    ? manager.withRepository(ItemCategoryRepository)
    : ItemCategoryRepository,
  itemFavoriteRepository: new FavoriteRepository(manager),
  categoryRepository: manager ? manager.withRepository(CategoryRepository) : CategoryRepository,
  itemTagRepository: new ItemTagRepository(manager),
  itemValidationRepository: manager
    ? manager.withRepository(ItemValidationRepository)
    : ItemValidationRepository,
  itemValidationReviewRepository: manager
    ? manager.withRepository(ItemValidationReviewRepository)
    : ItemValidationReviewRepository,
  itemValidationGroupRepository: manager
    ? manager.withRepository(ItemValidationGroupRepository)
    : ItemValidationGroupRepository,

  actionRepository: new ActionRepository(manager),
  actionRequestExportRepository: manager
    ? manager.withRepository(ActionRequestExportRepository)
    : ActionRequestExportRepository,
  memberProfileRepository: manager
    ? manager.withRepository(MemberProfileRepository)
    : MemberProfileRepository,
  shortLinkRepository: manager ? manager.withRepository(ShortLinkRepository) : ShortLinkRepository,
  itemGeolocationRepository: new ItemGeolocationRepository(manager),
});
