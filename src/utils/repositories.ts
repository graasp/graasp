import { EntityManager } from 'typeorm';

import { ActionRepository } from '../services/action/repositories/action';
import { MemberPasswordRepository } from '../services/auth/plugins/password/repository';
import { ChatMentionRepository } from '../services/chat/plugins/mentions/repository';
import { ChatMessageRepository } from '../services/chat/repository';
import { InvitationRepository } from '../services/invitation/repository';
import { ActionRequestExportRepository } from '../services/item/plugins/action/requestExport/repository';
import { AppActionRepository } from '../services/item/plugins/app/appAction/repository';
import { AppDataRepository } from '../services/item/plugins/app/appData/repository';
import { AppSettingRepository } from '../services/item/plugins/app/appSetting/repository';
import { PublisherRepository } from '../services/item/plugins/app/publisherRepository';
import { AppRepository } from '../services/item/plugins/app/repository';
import { CategoryRepository } from '../services/item/plugins/itemCategory/repositories/category';
import { ItemCategoryRepository } from '../services/item/plugins/itemCategory/repositories/itemCategory';
import { FavoriteRepository } from '../services/item/plugins/itemFavorite/repositories/favorite';
import { ItemFlagRepository } from '../services/item/plugins/itemFlag/repository';
import { ItemLikeRepository } from '../services/item/plugins/itemLike/repository';
import { ItemTagRepository } from '../services/item/plugins/itemTag/repository';
import { ItemPublishedRepository } from '../services/item/plugins/published/repositories/itemPublished';
import { RecycledItemDataRepository } from '../services/item/plugins/recycled/repository';
import { ItemValidationGroupRepository } from '../services/item/plugins/validation/repositories/ItemValidationGroup';
import { ItemValidationRepository } from '../services/item/plugins/validation/repositories/itemValidation';
import { ItemValidationReviewRepository } from '../services/item/plugins/validation/repositories/itemValidationReview';
import { ItemRepository } from '../services/item/repository';
import ItemLoginRepository from '../services/itemLogin/repositories/itemLogin';
import ItemLoginSchemaRepository from '../services/itemLogin/repositories/itemLoginSchema';
import { ItemMembershipRepository } from '../services/itemMembership/repository';
import MemberProfileRepository from '../services/libraryProfile/repository';
import MemberRepository from '../services/member/repository';

export type Repositories = {
  actionRepository: typeof ActionRepository;
  actionRequestExportRepository: typeof ActionRequestExportRepository;
  appActionRepository: typeof AppActionRepository;
  appDataRepository: typeof AppDataRepository;
  appRepository: typeof AppRepository;
  appSettingRepository: typeof AppSettingRepository;
  categoryRepository: typeof CategoryRepository;
  chatMessageRepository: typeof ChatMessageRepository;
  invitationRepository: typeof InvitationRepository;
  itemCategoryRepository: typeof ItemCategoryRepository;
  itemFavoriteRepository: typeof FavoriteRepository;
  itemFlagRepository: typeof ItemFlagRepository;
  itemLikeRepository: typeof ItemLikeRepository;
  itemLoginRepository: typeof ItemLoginRepository;
  itemLoginSchemaRepository: typeof ItemLoginSchemaRepository;
  itemMembershipRepository: typeof ItemMembershipRepository;
  itemPublishedRepository: typeof ItemPublishedRepository;
  itemRepository: typeof ItemRepository;
  itemTagRepository: typeof ItemTagRepository;
  itemValidationGroupRepository: typeof ItemValidationGroupRepository;
  itemValidationRepository: typeof ItemValidationRepository;
  itemValidationReviewRepository: typeof ItemValidationReviewRepository;
  memberPasswordRepository: typeof MemberPasswordRepository;
  memberRepository: typeof MemberRepository;
  mentionRepository: typeof ChatMentionRepository;
  publisherRepository: typeof PublisherRepository;
  recycledItemRepository: typeof RecycledItemDataRepository;
  memberProfileRepository: typeof MemberProfileRepository;
};
// public: exists in item tag

export const buildRepositories = (manager?: EntityManager): Repositories => ({
  itemRepository: manager ? manager.withRepository(ItemRepository) : ItemRepository,
  itemMembershipRepository: manager
    ? manager.withRepository(ItemMembershipRepository)
    : ItemMembershipRepository,
  memberRepository: manager ? manager.withRepository(MemberRepository) : MemberRepository,

  itemPublishedRepository: manager
    ? manager.withRepository(ItemPublishedRepository)
    : ItemPublishedRepository,
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
  mentionRepository: manager
    ? manager.withRepository(ChatMentionRepository)
    : ChatMentionRepository,
  itemCategoryRepository: manager
    ? manager.withRepository(ItemCategoryRepository)
    : ItemCategoryRepository,
  itemFavoriteRepository: manager ? manager.withRepository(FavoriteRepository) : FavoriteRepository,
  categoryRepository: manager ? manager.withRepository(CategoryRepository) : CategoryRepository,
  itemTagRepository: manager ? manager.withRepository(ItemTagRepository) : ItemTagRepository,
  itemValidationRepository: manager
    ? manager.withRepository(ItemValidationRepository)
    : ItemValidationRepository,
  itemValidationReviewRepository: manager
    ? manager.withRepository(ItemValidationReviewRepository)
    : ItemValidationReviewRepository,
  itemValidationGroupRepository: manager
    ? manager.withRepository(ItemValidationGroupRepository)
    : ItemValidationGroupRepository,

  actionRepository: manager ? manager.withRepository(ActionRepository) : ActionRepository,
  actionRequestExportRepository: manager
    ? manager.withRepository(ActionRequestExportRepository)
    : ActionRequestExportRepository,
  memberProfileRepository: manager
    ? manager.withRepository(MemberProfileRepository)
    : MemberProfileRepository,
});
