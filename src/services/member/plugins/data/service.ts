import { MailerDecoration } from '../../../../plugins/mailer';
import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import FileService from '../../../file/service';
import { Item } from '../../../item/entities/Item';
import { Actor } from '../../entities/member';
import {
  actionArraySchema,
  appActionArraySchema,
  appDataArraySchema,
  appSettingArraySchema,
  itemArraySchema,
  itemCategoryArraySchema,
  itemFavoriteArraySchema,
  itemLikeArraySchema,
  itemMembershipArraySchema,
  messageArraySchema,
  messageMentionArraySchema,
} from './schemas/schemas';
import {
  anonymizeMentionsMessage,
  anonymizeMessages,
  getFilteredData,
} from './utils/anonymize.utils';
import { RequestDataExportService } from './utils/export.utils';

export class DataMemberService {
  // TODO: check if it is not in the controller instead of here
  async requestDataExport({
    member,
    repositories,
    fileService,
    mailer,
  }: {
    member: Actor;
    repositories: Repositories;
    fileService: FileService;
    mailer: MailerDecoration;
  }) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    // get the data to export
    const dataToExport = await this.getAllData(member, repositories);
    const requestExportService = new RequestDataExportService(fileService, mailer);
    return await requestExportService.requestExport(member, dataToExport);
  }

  async getAllData(member: Actor, repositories: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const actions = await this.getActions(member, repositories);
    const appActions = await this.getAppActions(member, repositories);
    const appData = await this.getAppData(member, repositories);
    const appSettings = await this.getAppSettings(member, repositories);
    const chatMentions = await this.getChatMentions(member, repositories);
    const chatMessages = await this.getChatMessages(member, repositories);
    // TODO: item_flag
    // TODO: item_geolocation
    // TODO: item_login ? and login schema
    const items = await this.getItems(member, repositories);
    const itemCategories = await this.getItemCategories(member, repositories);
    const itemFavorites = await this.getItemFavorites(member, repositories);
    const itemLikes = await this.getItemLikes(member, repositories);
    const itemMemberShips = await this.getItemsMemberShips(member, repositories);
    // TODO: item_published
    // TODO: item_tag
    // TODO: item_validation ?, validation_group and validation_review ?
    // TODO: member
    // TODO: member_profile
    // TODO: recycled_item_data
    // TODO: short_link

    return {
      actions,
      appActions,
      appData,
      appSettings,
      chatMentions,
      chatMessages,
      items,
      itemCategories,
      itemFavorites,
      itemLikes,

      itemMemberShips,
    };
  }

  async getActions(member: Actor, { actionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await actionRepository.getForMemberExport(member.id);
    return getFilteredData(results, actionArraySchema);
  }

  async getAppActions(member: Actor, { appActionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await appActionRepository.getForMemberExport(member.id);
    return getFilteredData(results, appActionArraySchema);
  }

  async getAppData(member: Actor, { appDataRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const appData = await appDataRepository.getForMemberExport(member.id);
    return getFilteredData(appData, appDataArraySchema);
  }

  async getAppSettings(member: Actor, { appSettingRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await appSettingRepository.getForMemberExport(member.id);
    return getFilteredData(results, appSettingArraySchema);
  }

  async getChatMentions(member: Actor, { mentionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await mentionRepository.getForMemberExport(member.id);
    const anonymized = anonymizeMentionsMessage({ results, exportingActorId: member.id });
    return getFilteredData(anonymized, messageMentionArraySchema);
  }

  async getChatMessages(member: Actor, { chatMessageRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await chatMessageRepository.getForMemberExport(member.id);
    const anonymized = anonymizeMessages({ results, exportingActorId: member.id });
    return getFilteredData(anonymized, messageArraySchema);
  }

  async getItemsMemberShips(member: Actor, { itemMembershipRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const itemMemberShips = await itemMembershipRepository.getForMemberExport(member.id);
    return getFilteredData(itemMemberShips, itemMembershipArraySchema);
  }

  getOwnItemIds(memberItemsOwner: Item[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getItems(member: Actor, { itemRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }
    const results = await itemRepository.getForMemberExport(member.id);
    return getFilteredData(results, itemArraySchema);
  }

  async getItemCategories(member: Actor, { itemCategoryRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }
    const results = await itemCategoryRepository.getForMemberExport(member.id);
    return getFilteredData(results, itemCategoryArraySchema);
  }

  async getItemFavorites(member: Actor, { itemFavoriteRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await itemFavoriteRepository.getForMemberExport(member.id);
    return getFilteredData(results, itemFavoriteArraySchema);
  }

  async getItemLikes(member: Actor, { itemLikeRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    // TODO: check if we should also export the likes created by another member on its items
    // In this case, don't forget to anonymize the id of the other member ?
    // Or should we put the username of the other member who liked the item ?
    const results = await itemLikeRepository.getForMemberExport(member.id);
    return getFilteredData(results, itemLikeArraySchema);
  }
}
