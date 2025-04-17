import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { ItemRaw } from '../../../../drizzle/types';
import { MemberInfo, MinimalMember } from '../../../../types';
import { ExportDataRepository } from './memberExportData.repository';
import { anonymizeMentionsMessage, anonymizeMessages } from './utils/anonymize.utils';
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

  async requestDataExport(dbConnection: DBConnection, member: MemberInfo) {
    // get the data to export
    const dataRetriever = async () => await this.getAllData(dbConnection, member);
    await this.requestDataExportService.requestExport(member, member.id, dataRetriever);
  }

  async getAllData(dbConnection: DBConnection, actor: MinimalMember) {
    const actions = await this.getActions(dbConnection, actor);
    const appActions = await this.getAppActions(dbConnection, actor);
    const appData = await this.getAppData(dbConnection, actor);
    const appSettings = await this.getAppSettings(dbConnection, actor);
    const chatMentions = await this.getChatMentions(dbConnection, actor);
    const chatMessages = await this.getChatMessages(dbConnection, actor);

    const items = await this.getItems(dbConnection, actor);
    const itemBookmarks = await this.getItemBookmarks(dbConnection, actor);
    const itemLikes = await this.getItemLikes(dbConnection, actor);
    const itemMemberShips = await this.getItemsMemberShips(dbConnection, actor);

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

  async getActions(dbConnection: DBConnection, actor: MinimalMember) {
    return await this.exportDataRepository.getActions(dbConnection, actor.id);
  }

  async getAppActions(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getAppActions(dbConnection, actor.id);
    return results;
  }

  async getAppData(dbConnection: DBConnection, actor: MinimalMember) {
    const appData = await this.exportDataRepository.getAppData(dbConnection, actor.id);
    return appData;
  }

  async getAppSettings(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getAppSettings(dbConnection, actor.id);
    return results;
  }

  async getChatMentions(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getChatMentions(dbConnection, actor.id);
    const anonymized = anonymizeMentionsMessage({
      results,
      exportingActorId: actor.id,
    });
    return anonymized;
  }

  async getChatMessages(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getChatMessages(dbConnection, actor.id);
    const anonymized = anonymizeMessages({
      results,
      exportingActorId: actor.id,
    });
    return anonymized;
  }

  async getItemsMemberShips(dbConnection: DBConnection, actor: MinimalMember) {
    const itemMemberShips = await this.exportDataRepository.getItemMemberships(
      dbConnection,
      actor.id,
    );
    return itemMemberShips;
  }

  getOwnItemIds(memberItemsOwner: ItemRaw[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getItems(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getItems(dbConnection, actor.id);
    return results;
  }

  async getItemBookmarks(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getItemBookmarks(dbConnection, actor.id);
    return results;
  }

  async getItemLikes(dbConnection: DBConnection, actor: MinimalMember) {
    // TODO: check if we should also export the likes created by another actor on its items
    // In this case, don't forget to anonymize the id of the other actor ?
    // Or should we put the username of the other actor who liked the item ?
    const results = await this.exportDataRepository.getByCreatorToExport(dbConnection, actor.id);
    return results;
  }
}
