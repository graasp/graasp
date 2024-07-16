import { singleton } from 'tsyringe';

import { Repositories } from '../../../../utils/repositories';
import { Item } from '../../../item/entities/Item';
import { Member } from '../../entities/member';
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

@singleton()
export class ExportMemberDataService {
  private readonly requestDataExportService: RequestDataExportService;

  constructor(requestDataExportService: RequestDataExportService) {
    this.requestDataExportService = requestDataExportService;
  }

  async requestDataExport({ actor, repositories }: { actor: Member; repositories: Repositories }) {
    // get the data to export
    const dataRetriever = async () => await this.getAllData(actor, repositories);
    await this.requestDataExportService.requestExport(actor, actor.id, dataRetriever);
  }

  async getAllData(actor: Member, repositories: Repositories) {
    // TODO: export more data
    const actions = await this.getActions(actor, repositories);
    const appActions = await this.getAppActions(actor, repositories);
    const appData = await this.getAppData(actor, repositories);
    const appSettings = await this.getAppSettings(actor, repositories);
    const chatMentions = await this.getChatMentions(actor, repositories);
    const chatMessages = await this.getChatMessages(actor, repositories);

    const items = await this.getItems(actor, repositories);
    const itemCategories = await this.getItemCategories(actor, repositories);
    const itemFavorites = await this.getItemFavorites(actor, repositories);
    const itemLikes = await this.getItemLikes(actor, repositories);
    const itemMemberShips = await this.getItemsMemberShips(actor, repositories);

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

  async getActions(actor: Member, { actionRepository }: Repositories) {
    const results = await actionRepository.getForMemberExport(actor.id);
    return getFilteredData(results, actionArraySchema);
  }

  async getAppActions(actor: Member, { appActionRepository }: Repositories) {
    const results = await appActionRepository.getForMemberExport(actor.id);
    return getFilteredData(results, appActionArraySchema);
  }

  async getAppData(actor: Member, { appDataRepository }: Repositories) {
    const appData = await appDataRepository.getForMemberExport(actor.id);
    return getFilteredData(appData, appDataArraySchema);
  }

  async getAppSettings(actor: Member, { appSettingRepository }: Repositories) {
    const results = await appSettingRepository.getForMemberExport(actor.id);
    return getFilteredData(results, appSettingArraySchema);
  }

  async getChatMentions(actor: Member, { mentionRepository }: Repositories) {
    const results = await mentionRepository.getForMemberExport(actor.id);
    const anonymized = anonymizeMentionsMessage({ results, exportingActorId: actor.id });
    return getFilteredData(anonymized, messageMentionArraySchema);
  }

  async getChatMessages(actor: Member, { chatMessageRepository }: Repositories) {
    const results = await chatMessageRepository.getForMemberExport(actor.id);
    const anonymized = anonymizeMessages({ results, exportingActorId: actor.id });
    return getFilteredData(anonymized, messageArraySchema);
  }

  async getItemsMemberShips(actor: Member, { itemMembershipRepository }: Repositories) {
    const itemMemberShips = await itemMembershipRepository.getForMemberExport(actor.id);
    return getFilteredData(itemMemberShips, itemMembershipArraySchema);
  }

  getOwnItemIds(memberItemsOwner: Item[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getItems(actor: Member, { itemRepository }: Repositories) {
    const results = await itemRepository.getForMemberExport(actor.id);
    return getFilteredData(results, itemArraySchema);
  }

  async getItemCategories(actor: Member, { itemCategoryRepository }: Repositories) {
    const results = await itemCategoryRepository.getForMemberExport(actor.id);
    return getFilteredData(results, itemCategoryArraySchema);
  }

  async getItemFavorites(actor: Member, { itemFavoriteRepository }: Repositories) {
    const results = await itemFavoriteRepository.getForMemberExport(actor.id);
    return getFilteredData(results, itemFavoriteArraySchema);
  }

  async getItemLikes(actor: Member, { itemLikeRepository }: Repositories) {
    // TODO: check if we should also export the likes created by another actor on its items
    // In this case, don't forget to anonymize the id of the other actor ?
    // Or should we put the username of the other actor who liked the item ?
    const results = await itemLikeRepository.getForMemberExport(actor.id);
    return getFilteredData(results, itemLikeArraySchema);
  }
}
