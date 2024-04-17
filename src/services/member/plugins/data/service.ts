import fs from 'fs';
import path from 'path';

import { DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS } from '@graasp/sdk';

import { MailerDecoration } from '../../../../plugins/mailer';
import { MAIL } from '../../../../plugins/mailer/langs/constants';
import { TMP_FOLDER } from '../../../../utils/config';
import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { EXPORT_FILE_EXPIRATION } from '../../../action/constants/constants';
import FileService from '../../../file/service';
import { Item } from '../../../item/entities/Item';
import { Actor, Member } from '../../entities/member';
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
import { ArchiveDataExporter, buildUploadedExportFilePath } from './utils/export.utils';

export class DataMemberService {
  private fileService: FileService;
  private mailer: MailerDecoration;

  private readonly ROOT_EXPORT_FOLDER = 'export';

  constructor(fileService: FileService, mailer: MailerDecoration) {
    this.fileService = fileService;
    this.mailer = mailer;
  }

  private async _sendExportLinkInMail(actor: Member, exportId: string, archiveDate: Date) {
    const filepath = buildUploadedExportFilePath(this.ROOT_EXPORT_FOLDER, exportId, archiveDate);
    const link = await this.fileService.getUrl(actor, {
      id: exportId,
      path: filepath,
      expiration: EXPORT_FILE_EXPIRATION,
    });

    // factor out
    const lang = actor.lang;
    const t = this.mailer.translate(lang);

    const text = t(MAIL.EXPORT_DATA_TEXT, {
      days: DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
    });
    const html = `
      ${this.mailer.buildText(text)}
      ${this.mailer.buildButton(link, t(MAIL.EXPORT_DATA_BUTTON_TEXT))}
    `;
    const title = t(MAIL.EXPORT_DATA_TITLE);

    const footer = this.mailer.buildFooter(lang);

    this.mailer.sendEmail(title, actor.email, link, html, footer).catch((err) => {
      console.debug(err, `mailer failed. export zip link: ${link}`);
    });
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
    const tmpFolder = path.join(TMP_FOLDER, this.ROOT_EXPORT_FOLDER, member.id);
    fs.mkdirSync(tmpFolder, { recursive: true });

    // get the data to export
    const dataToExport = await this.getAllData(member, repositories);

    // archives the data and upload it.
    const { archiveCreationTime } = await new ArchiveDataExporter().createAndUploadArchive({
      fileService: this.fileService,
      member,
      exportId: member.id,
      dataToExport,
      storageFolder: tmpFolder,
      uploadedRootFolder: this.ROOT_EXPORT_FOLDER,
    });

    // TODO: save the request in the database
    const requestExport = { createdAt: archiveCreationTime };

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

    this._sendExportLinkInMail(member, member.id, requestExport.createdAt);
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
