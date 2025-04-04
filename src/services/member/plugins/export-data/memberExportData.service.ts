import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { ItemRaw } from '../../../../drizzle/types';
import { MemberInfo, MinimalMember } from '../../../../types';
import { ExportDataRepository } from './memberExportData.repository';
import { messageMentionArraySchema } from './memberExportData.schemas';
import {
  anonymizeMentionsMessage,
  anonymizeMessages,
  getFilteredData,
} from './utils/anonymize.utils';
import { RequestDataExportService } from './utils/export.utils';

@singleton()
export class ExportMemberDataService {
  private readonly requestDataExportService: RequestDataExportService;
  private readonly exportDataRepository: ExportDataRepository;

  constructor(
    requestDataExportService: RequestDataExportService,
    exportDataRepository: ExportDataRepository,
  ) {
    this.requestDataExportService = requestDataExportService;
    this.exportDataRepository = exportDataRepository;
  }

  async requestDataExport(db: DBConnection, member: MemberInfo) {
    // get the data to export
    const dataRetriever = async () => await this.getAllData(db, member);
    await this.requestDataExportService.requestExport(member, member.id, dataRetriever);
  }

  async getAllData(db: DBConnection, actor: MinimalMember) {
    // TODO: export more data
    const actions = await this.getActions(db, actor);
    const appActions = await this.getAppActions(db, actor);
    const appData = await this.getAppData(db, actor);
    const appSettings = await this.getAppSettings(db, actor);
    const chatMentions = await this.getChatMentions(db, actor);
    const chatMessages = await this.getChatMessages(db, actor);

    const items = await this.getItems(db, actor);
    const itemBookmarks = await this.getItemBookmarks(db, actor);
    const itemLikes = await this.getItemLikes(db, actor);
    const itemMemberShips = await this.getItemsMemberShips(db, actor);

    return {
      actions,
      appActions,
      appData,
      appSettings,
      chatMentions,
      chatMessages,
      items,
      itemBookmarks,
      itemLikes,
      itemMemberShips,
    };
  }
  // TODO: do we need to filter again? filtering happened in repository already
  async getActions(db: DBConnection, actor: MinimalMember) {
    return await this.exportDataRepository.getActions(db, actor.id);
    // return getFilteredData(results, actionArraySchema);
  }

  async getAppActions(db: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getAppActions(db, actor.id);
    // return getFilteredData(results, appActionArraySchema);
    return results;
  }

  async getAppData(db: DBConnection, actor: MinimalMember) {
    const appData = await this.exportDataRepository.getAppData(db, actor.id);
    // return getFilteredData(appData, appDataArraySchema);
    return appData;
  }

  async getAppSettings(db: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getAppSettings(db, actor.id);
    // return getFilteredData(results, appSettingArraySchema);
    return results;
  }

  async getChatMentions(db: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getChatMentions(db, actor.id);
    const anonymized = anonymizeMentionsMessage({
      results,
      exportingActorId: actor.id,
    });
    return anonymized;
  }

  async getChatMessages(db: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getChatMessages(db, actor.id);
    const anonymized = anonymizeMessages({
      results,
      exportingActorId: actor.id,
    });
    // return getFilteredData(anonymized, messageArraySchema);
    return anonymized;
  }

  async getItemsMemberShips(db: DBConnection, actor: MinimalMember) {
    const itemMemberShips = await this.exportDataRepository.getItemMemberships(db, actor.id);
    // return getFilteredData(itemMemberShips, itemMembershipArraySchema);
    return itemMemberShips;
  }

  getOwnItemIds(memberItemsOwner: ItemRaw[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getItems(db: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getItems(db, actor.id);
    // return getFilteredData(results, itemArraySchema);
    return results;
  }

  async getItemBookmarks(db: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getItemBookmarks(db, actor.id);
    // return getFilteredData(results, itemFavoriteArraySchema);
    return results;
  }

  async getItemLikes(db: DBConnection, actor: MinimalMember) {
    // TODO: check if we should also export the likes created by another actor on its items
    // In this case, don't forget to anonymize the id of the other actor ?
    // Or should we put the username of the other actor who liked the item ?
    const results = await this.exportDataRepository.getByCreatorToExport(db, actor.id);
    // return getFilteredData(results, itemLikeArraySchema);
    return results;
  }
}
