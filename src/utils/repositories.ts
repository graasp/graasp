import { EntityManager } from 'typeorm';

import { AccountRepository } from '../services/account/repository';
import { ActionRepository } from '../services/action/repositories/action';
import { MemberPasswordRepository } from '../services/auth/plugins/password/repository';
import { ChatMentionRepository } from '../services/chat/plugins/mentions/repository';
import { ChatMessageRepository } from '../services/chat/repository';
import { ActionRequestExportRepository } from '../services/item/plugins/action/requestExport/repository';
import { AppActionRepository } from '../services/item/plugins/app/appAction/repository';
import { AppDataRepository } from '../services/item/plugins/app/appData/repository';
import { AppSettingRepository } from '../services/item/plugins/app/appSetting/repository';
import { PublisherRepository } from '../services/item/plugins/app/publisherRepository';
import { AppRepository } from '../services/item/plugins/app/repository';
import { ItemGeolocationRepository } from '../services/item/plugins/geolocation/repository';
import { InvitationRepository } from '../services/item/plugins/invitation/repository';
import { CategoryRepository } from '../services/item/plugins/itemCategory/repositories/category';
import { ItemCategoryRepository } from '../services/item/plugins/itemCategory/repositories/itemCategory';
import { FavoriteRepository } from '../services/item/plugins/itemFavorite/repositories/favorite';
import { ItemFlagRepository } from '../services/item/plugins/itemFlag/repository';
import { ItemLikeRepository } from '../services/item/plugins/itemLike/repository';
import { ItemTagRepository } from '../services/item/plugins/itemTag/repository';
import { ItemPublishedRepository } from '../services/item/plugins/publication/published/repositories/itemPublished';
import { ItemValidationGroupRepository } from '../services/item/plugins/publication/validation/repositories/ItemValidationGroup';
import { ItemValidationRepository } from '../services/item/plugins/publication/validation/repositories/itemValidation';
import { ItemValidationReviewRepository } from '../services/item/plugins/publication/validation/repositories/itemValidationReview';
import { RecycledItemDataRepository } from '../services/item/plugins/recycled/repository';
import { ShortLinkRepository } from '../services/item/plugins/shortLink/repository';
import { ItemRepository } from '../services/item/repository';
import { GuestRepository } from '../services/itemLogin/repositories/guest';
import { GuestPasswordRepository } from '../services/itemLogin/repositories/guestPassword';
import { ItemLoginSchemaRepository } from '../services/itemLogin/repositories/itemLoginSchema';
import { MembershipRequestRepository } from '../services/itemMembership/plugins/MembershipRequest/repository';
import { ItemMembershipRepository } from '../services/itemMembership/repository';
import MemberProfileRepository from '../services/member/plugins/profile/repository';
import { MemberRepository } from '../services/member/repository';

export type Repositories = {
  actionRepository: ActionRepository;
  actionRequestExportRepository: ActionRequestExportRepository;
  appActionRepository: AppActionRepository;
  appDataRepository: AppDataRepository;
  appRepository: AppRepository;
  appSettingRepository: AppSettingRepository;
  categoryRepository: CategoryRepository;
  chatMessageRepository: typeof ChatMessageRepository;
  invitationRepository: InvitationRepository;
  itemCategoryRepository: ItemCategoryRepository;
  itemFavoriteRepository: FavoriteRepository;
  itemFlagRepository: ItemFlagRepository;
  itemLikeRepository: typeof ItemLikeRepository;
  itemLoginRepository: GuestRepository;
  itemLoginSchemaRepository: typeof ItemLoginSchemaRepository;
  itemMembershipRepository: typeof ItemMembershipRepository;
  membershipRequestRepository: MembershipRequestRepository;
  itemPublishedRepository: ItemPublishedRepository;
  itemRepository: ItemRepository;
  itemTagRepository: ItemTagRepository;
  itemValidationGroupRepository: ItemValidationGroupRepository;
  itemValidationRepository: ItemValidationRepository;
  itemValidationReviewRepository: ItemValidationReviewRepository;
  memberPasswordRepository: MemberPasswordRepository;
  guestPasswordRepository: GuestPasswordRepository;
  memberRepository: MemberRepository;
  mentionRepository: ChatMentionRepository;
  publisherRepository: PublisherRepository;
  recycledItemRepository: RecycledItemDataRepository;
  memberProfileRepository: MemberProfileRepository;
  shortLinkRepository: ShortLinkRepository;
  itemGeolocationRepository: ItemGeolocationRepository;
  accountRepository: AccountRepository;
};
// public: exists in item tag

export const buildRepositories = (manager?: EntityManager): Repositories => ({
  itemRepository: new ItemRepository(manager),
  itemMembershipRepository: manager
    ? manager.withRepository(ItemMembershipRepository)
    : ItemMembershipRepository,
  membershipRequestRepository: new MembershipRequestRepository(manager),
  memberRepository: new MemberRepository(manager),

  itemPublishedRepository: new ItemPublishedRepository(manager),
  itemLoginRepository: new GuestRepository(manager),
  itemLoginSchemaRepository: manager
    ? manager.withRepository(ItemLoginSchemaRepository)
    : ItemLoginSchemaRepository,
  memberPasswordRepository: new MemberPasswordRepository(manager),
  guestPasswordRepository: new GuestPasswordRepository(manager),
  appRepository: new AppRepository(manager),
  appDataRepository: new AppDataRepository(manager),
  appActionRepository: new AppActionRepository(manager),
  appSettingRepository: new AppSettingRepository(manager),
  publisherRepository: new PublisherRepository(manager),
  recycledItemRepository: new RecycledItemDataRepository(manager),
  itemLikeRepository: manager ? manager.withRepository(ItemLikeRepository) : ItemLikeRepository,
  itemFlagRepository: new ItemFlagRepository(manager),
  invitationRepository: new InvitationRepository(manager),
  chatMessageRepository: manager
    ? manager.withRepository(ChatMessageRepository)
    : ChatMessageRepository,
  mentionRepository: new ChatMentionRepository(manager),
  itemCategoryRepository: new ItemCategoryRepository(manager),
  itemFavoriteRepository: new FavoriteRepository(manager),
  categoryRepository: new CategoryRepository(manager),
  itemTagRepository: new ItemTagRepository(manager),
  itemValidationRepository: new ItemValidationRepository(manager),
  itemValidationReviewRepository: new ItemValidationReviewRepository(manager),
  itemValidationGroupRepository: new ItemValidationGroupRepository(manager),

  actionRepository: new ActionRepository(manager),
  actionRequestExportRepository: new ActionRequestExportRepository(manager),
  memberProfileRepository: new MemberProfileRepository(manager),
  shortLinkRepository: new ShortLinkRepository(manager),
  itemGeolocationRepository: new ItemGeolocationRepository(manager),
  accountRepository: new AccountRepository(manager),
});
