import fs from 'fs';
import path from 'path';

import { TMP_FOLDER } from '../../../../utils/config';
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
import { ArchiveDataExporter } from './utils/export.utils';

export class DataMemberService {
  private fileService: FileService;

  constructor(fileService: FileService) {
    this.fileService = fileService;
  }

  // TODO: check if it not in another service ?
  async requestExport(member: Actor, repositories: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    // TODO: get last export entry within interval,
    // check if a previous request already created the file and send it back
    // ...

    // create tmp folder to temporaly save files
    const rootExportFolder = 'export';
    const tmpFolder = path.join(TMP_FOLDER, rootExportFolder, member.id);
    fs.mkdirSync(tmpFolder, { recursive: true });

    // get the data to export
    const dataToExport = await this.getAllData(member, repositories);

    // archives the data and upload it.
    await new ArchiveDataExporter().createAndUploadArchive({
      fileService: this.fileService,
      member,
      exportId: member.id,
      dataToExport,
      storageFolder: tmpFolder,
      uploadedRootFolder: rootExportFolder,
    });

    // TODO: save the request in the database
    const requestExport = 'Done !';

    // delete tmp folder
    if (fs.existsSync(tmpFolder)) {
      try {
        fs.rmSync(tmpFolder, { recursive: true });
      } catch (e) {
        console.error(e);
      }
    } else {
      console.error(`${tmpFolder} was not found, and was not deleted`);
    }

    // TODO: _sendExportLinkInMail(member, item, requestExport.createdAt);
    return requestExport;
  }

  async getAllData(member: Actor, repositories: Repositories) {
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
