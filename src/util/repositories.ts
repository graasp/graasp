import { EntityManager } from 'typeorm';

import { MemberPasswordRepository } from '../services/auth/plugins/password/repository';
import { ChatMentionRepository } from '../services/chat/plugins/mentions/repository';
import { ChatMessageRepository } from '../services/chat/repository';
import { InvitationRepository } from '../services/invitation/repository';
import { AppActionRepository } from '../services/item/plugins/app/appAction/repository';
import { AppDataRepository } from '../services/item/plugins/app/appData/repository';
import { AppSettingRepository } from '../services/item/plugins/app/appSetting/repository';
import { PublisherRepository } from '../services/item/plugins/app/publisherRepository';
import { AppRepository } from '../services/item/plugins/app/repository';
import { RecycledItemDataRepository } from '../services/item/plugins/recycled/repository';
import { ItemValidationGroupRepository } from '../services/item/plugins/validation/repositories/ItemValidationGroup';
import { ItemValidationRepository } from '../services/item/plugins/validation/repositories/itemValidation';
import { ItemValidationReviewRepository } from '../services/item/plugins/validation/repositories/itemValidationReview';
import { ItemRepository } from '../services/item/repository';
import { CategoryRepository } from '../services/itemCategory/repositories/category';
import { ItemCategoryRepository } from '../services/itemCategory/repositories/itemCategory';
import { ItemFlagRepository } from '../services/itemFlag/repository';
import { ItemLikeRepository } from '../services/itemLike/repository';
import ItemLoginRepository from '../services/itemLogin/repositories/itemLogin';
import ItemLoginSchemaRepository from '../services/itemLogin/repositories/itemLoginSchema';
import { ItemMembershipRepository } from '../services/itemMembership/repository';
import { ItemTagRepository } from '../services/itemTag/repository';
import MemberRepository from '../services/member/repository';
import { ItemPublishedRepository } from '../services/published/repositories/itemPublished';

export type Repositories = {
  appActionRepository: typeof AppActionRepository;
  appDataRepository: typeof AppDataRepository;
  appRepository: typeof AppRepository;
  appSettingRepository: typeof AppSettingRepository;
  categoryRepository: typeof CategoryRepository;
  chatMessageRepository: typeof ChatMessageRepository;
  invitationRepository: typeof InvitationRepository;
  itemCategoryRepository: typeof ItemCategoryRepository;
  itemFlagRepository: typeof ItemFlagRepository;
  itemLikeRepository: typeof ItemLikeRepository;
  itemLoginRepository: typeof ItemLoginRepository;
  itemLoginSchemaRepository: typeof ItemLoginSchemaRepository;
  itemMembershipRepository: typeof ItemMembershipRepository;
  itemRepository: typeof ItemRepository;
  itemTagRepository: typeof ItemTagRepository;
  memberPasswordRepository: typeof MemberPasswordRepository;
  memberRepository: typeof MemberRepository;
  mentionRepository: typeof ChatMentionRepository;
  itemPublishedRepository: typeof ItemPublishedRepository;
  publisherRepository: typeof PublisherRepository;
  recycledItemRepository: typeof RecycledItemDataRepository;
  itemValidationRepository: typeof ItemValidationRepository;
  itemValidationReviewRepository: typeof ItemValidationReviewRepository;
  itemValidationGroupRepository: typeof ItemValidationGroupRepository;
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
});
