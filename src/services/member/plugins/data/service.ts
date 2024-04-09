import { Repositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action';
import { Item } from '../../../item/entities/Item';
import { AppActionService } from '../../../item/plugins/app/appAction/service';
import { AppDataService } from '../../../item/plugins/app/appData/service';
import { AppSettingService } from '../../../item/plugins/app/appSetting/service';
import { FavoriteService } from '../../../item/plugins/itemFavorite/services/favorite';
import { ItemLikeService } from '../../../item/plugins/itemLike/service';
import ItemService from '../../../item/service';
import ItemMembershipService from '../../../itemMembership/service';
import { Actor } from '../../entities/member';

type DataMemberServiceProps = {
  actionService: ActionService;
  appDataService: AppDataService;
  appActionService: AppActionService;
  appSettingService: AppSettingService;
  favoriteService: FavoriteService;
  itemLikeService: ItemLikeService;
  itemMembershipService: ItemMembershipService;
  itemService: ItemService;
};

export class DataMemberService {
  private actionService: ActionService;
  private appDataService: AppDataService;
  private appActionService: AppActionService;
  private appSettingService: AppSettingService;
  private favoriteService: FavoriteService;
  private itemLikeService: ItemLikeService;
  private itemMembershipService: ItemMembershipService;
  private itemService: ItemService;

  constructor({
    actionService,
    appDataService,
    appActionService,
    appSettingService,
    favoriteService,
    itemLikeService,
    itemMembershipService,
    itemService,
  }: DataMemberServiceProps) {
    this.actionService = actionService;
    this.appDataService = appDataService;
    this.appActionService = appActionService;
    this.appSettingService = appSettingService;
    this.favoriteService = favoriteService;
    this.itemLikeService = itemLikeService;
    this.itemMembershipService = itemMembershipService;
    this.itemService = itemService;
  }

  async getActions(member: Actor, repositories: Repositories) {
    return await this.actionService.getForMember(member, repositories);
  }

  async getAppActions(member: Actor, repositories: Repositories) {
    return await this.appActionService.getForMember(member, repositories);
  }

  async getAppData(member: Actor, repositories: Repositories) {
    return await this.appDataService.getForMember(member, repositories);
  }

  async getAppSettings(member: Actor, repositories: Repositories) {
    return await this.appSettingService.getForMember(member, repositories);
  }

  async getBookMarks(member: Actor, repositories: Repositories) {
    // TODO: limit by foreign key id ?
    return await this.favoriteService.getOwn(member, repositories);
  }

  async getItemLikes(member: Actor, repositories: Repositories) {
    return await this.itemLikeService.getForMember(member, repositories);
  }

  async getItemsMemberShips(member: Actor, repositories: Repositories) {
    // TODO: check if items are required in memberships
    return await this.itemMembershipService.getForMember(member, repositories);
  }

  getOwnItemIds(memberItemsOwner: Item[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getOwnItems(member: Actor, repositories: Repositories) {
    return await this.itemService.getCreatedBy(member, repositories);
  }
}
