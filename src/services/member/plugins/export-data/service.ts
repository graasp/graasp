import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../item/entities/Item';
import { Member } from '../../entities/member';
import { ExportDataRepository } from './repository';
import {
  actionArraySchema,
  appActionArraySchema,
  appDataArraySchema,
  appSettingArraySchema,
  itemArraySchema,
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
  private readonly exportDataRepository: ExportDataRepository;

  constructor(
    requestDataExportService: RequestDataExportService,
    exportDataRepository: ExportDataRepository,
  ) {
    this.requestDataExportService = requestDataExportService;
    this.exportDataRepository = exportDataRepository;
  }

  async requestDataExport(
    db: DBConnection,
    {
      member,
    }: {
      member: Member;
    },
  ) {
    // get the data to export
    const dataRetriever = async () => await this.getAllData(db, member);
    await this.requestDataExportService.requestExport(member, member.id, dataRetriever);
  }

  async getAllData(db: DBConnection, actor: Member) {
    // TODO: export more data
    const actions = await this.getActions(db, actor);
    const appActions = await this.getAppActions(db, actor);
    const appData = await this.getAppData(db, actor);
    const appSettings = await this.getAppSettings(db, actor);
    const chatMentions = await this.getChatMentions(db, actor);
    const chatMessages = await this.getChatMessages(db, actor);

    const items = await this.getItems(db, actor);
    const itemFavorites = await this.getItemBookmarks(db, actor);
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
      itemFavorites,
      itemLikes,
      itemMemberShips,
    };
  }

  async getActions(db: DBConnection, actor: Member) {
    const results = await this.exportDataRepository.getActions(db, actor.id);
    return getFilteredData(results, actionArraySchema);
  }

  async getAppActions(db: DBConnection, actor: Member) {
    const results = await this.exportDataRepository.getAppActions(db, actor.id);
    return getFilteredData(results, appActionArraySchema);
  }

  async getAppData(db: DBConnection, actor: Member) {
    const appData = await this.exportDataRepository.getAppData(db, actor.id);
    return getFilteredData(appData, appDataArraySchema);
  }

  async getAppSettings(db: DBConnection, actor: Member) {
    const results = await this.exportDataRepository.getAppSettings(db, actor.id);
    return getFilteredData(results, appSettingArraySchema);
  }

  async getChatMentions(db: DBConnection, actor: Member) {
    const results = await this.exportDataRepository.getChatMentions(db, actor.id);
    const anonymized = anonymizeMentionsMessage({ results, exportingActorId: actor.id });
    return getFilteredData(anonymized, messageMentionArraySchema);
  }

  async getChatMessages(db: DBConnection, actor: Member) {
    const results = await this.exportDataRepository.getChatMessages(db, actor.id);
    const anonymized = anonymizeMessages({ results, exportingActorId: actor.id });
    return getFilteredData(anonymized, messageArraySchema);
  }

  async getItemsMemberShips(db: DBConnection, actor: Member) {
    const itemMemberShips = await this.exportDataRepository.getItemMemberships(db, actor.id);
    return getFilteredData(itemMemberShips, itemMembershipArraySchema);
  }

  getOwnItemIds(memberItemsOwner: Item[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getItems(db: DBConnection, actor: Member) {
    const results = await this.exportDataRepository.getItems(db, actor.id);
    return getFilteredData(results, itemArraySchema);
  }

  async getItemBookmarks(db: DBConnection, actor: Member) {
    const results = await this.exportDataRepository.getItemBookmarks(db, actor.id);
    return getFilteredData(results, itemFavoriteArraySchema);
  }

  async getItemLikes(db: DBConnection, actor: Member) {
    // TODO: check if we should also export the likes created by another actor on its items
    // In this case, don't forget to anonymize the id of the other actor ?
    // Or should we put the username of the other actor who liked the item ?
    const results = await this.exportDataRepository.getByCreatorToExport(db, actor.id);
    return getFilteredData(results, itemLikeArraySchema);
  }
}
