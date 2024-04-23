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

export class ExportMemberDataService {
  async requestDataExport({
    actor,
    repositories,
    fileService,
    mailer,
  }: {
    actor: Actor;
    repositories: Repositories;
    fileService: FileService;
    mailer: MailerDecoration;
  }) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    // get the data to export
    const dataRetriever = async () => await this.getAllData(actor, repositories);
    const requestExportService = new RequestDataExportService(fileService, mailer);
    await requestExportService.requestExport(actor, actor.id, dataRetriever);
  }

  async getAllData(actor: Actor, repositories: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

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

  async getActions(actor: Actor, { actionRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const results = await actionRepository.getForMemberExport(actor.id);
    return getFilteredData(results, actionArraySchema);
  }

  async getAppActions(actor: Actor, { appActionRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const results = await appActionRepository.getForMemberExport(actor.id);
    return getFilteredData(results, appActionArraySchema);
  }

  async getAppData(actor: Actor, { appDataRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const appData = await appDataRepository.getForMemberExport(actor.id);
    return getFilteredData(appData, appDataArraySchema);
  }

  async getAppSettings(actor: Actor, { appSettingRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const results = await appSettingRepository.getForMemberExport(actor.id);
    return getFilteredData(results, appSettingArraySchema);
  }

  async getChatMentions(actor: Actor, { mentionRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const results = await mentionRepository.getForMemberExport(actor.id);
    const anonymized = anonymizeMentionsMessage({ results, exportingActorId: actor.id });
    return getFilteredData(anonymized, messageMentionArraySchema);
  }

  async getChatMessages(actor: Actor, { chatMessageRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const results = await chatMessageRepository.getForMemberExport(actor.id);
    const anonymized = anonymizeMessages({ results, exportingActorId: actor.id });
    return getFilteredData(anonymized, messageArraySchema);
  }

  async getItemsMemberShips(actor: Actor, { itemMembershipRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const itemMemberShips = await itemMembershipRepository.getForMemberExport(actor.id);
    return getFilteredData(itemMemberShips, itemMembershipArraySchema);
  }

  getOwnItemIds(memberItemsOwner: Item[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getItems(actor: Actor, { itemRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const results = await itemRepository.getForMemberExport(actor.id);
    return getFilteredData(results, itemArraySchema);
  }

  async getItemCategories(actor: Actor, { itemCategoryRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const results = await itemCategoryRepository.getForMemberExport(actor.id);
    return getFilteredData(results, itemCategoryArraySchema);
  }

  async getItemFavorites(actor: Actor, { itemFavoriteRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const results = await itemFavoriteRepository.getForMemberExport(actor.id);
    return getFilteredData(results, itemFavoriteArraySchema);
  }

  async getItemLikes(actor: Actor, { itemLikeRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    // TODO: check if we should also export the likes created by another actor on its items
    // In this case, don't forget to anonymize the id of the other actor ?
    // Or should we put the username of the other actor who liked the item ?
    const results = await itemLikeRepository.getForMemberExport(actor.id);
    return getFilteredData(results, itemLikeArraySchema);
  }
}
