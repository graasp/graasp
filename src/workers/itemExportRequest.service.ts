import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { singleton } from 'tsyringe';
import { ZipFile } from 'yazl';

import { type UnionOfConst } from '@graasp/sdk';

import { type DBConnection } from '../drizzle/db';
import { type ItemRaw, MinimalAccount } from '../drizzle/types';
import { TRANSLATIONS } from '../langs/constants';
import { BaseLogger } from '../logger';
import { MailBuilder } from '../plugins/mailer/builder';
import { MailerService } from '../plugins/mailer/mailer.service';
import { AuthorizedItemService } from '../services/authorizedItem.service';
import FileService from '../services/file/file.service';
import { isItemType } from '../services/item/discrimination';
import { ItemService } from '../services/item/item.service';
import { DESCRIPTION_EXTENSION } from '../services/item/plugins/importExport/constants';
import { UnexpectedExportError } from '../services/item/plugins/importExport/errors';
import { ItemExportService } from '../services/item/plugins/importExport/itemExport.service';
import { MemberService } from '../services/member/member.service';
import { MaybeUser, MinimalMember } from '../types';
import { TMP_FOLDER } from '../utils/config';
import { ItemExportRequestRepository } from './itemExportRequest.repository';

const EXPORT_ITEM_EXPIRATION_DAYS = 7;
const EXPORT_ITEM_EXPIRATION = 3600 * 24 * EXPORT_ITEM_EXPIRATION_DAYS; // max value: one week

export const ItemExportRequestType = {
  Raw: 'raw',
  Graasp: 'graasp',
} as const;
type ItemExportRequestTypeOptions = UnionOfConst<typeof ItemExportRequestType>;

@singleton()
export class ItemExportRequestService {
  private readonly fileService: FileService;
  private readonly itemExportRequestRepository: ItemExportRequestRepository;
  private readonly mailerService: MailerService;
  private readonly memberService: MemberService;
  private readonly itemService: ItemService;
  private readonly authorizedItemService: AuthorizedItemService;

  private readonly logger: BaseLogger;
  private readonly itemExportService: ItemExportService;

  constructor(
    fileService: FileService,
    itemExportRequestRepository: ItemExportRequestRepository,
    mailerService: MailerService,
    memberService: MemberService,
    itemService: ItemService,
    authorizedItemService: AuthorizedItemService,
    itemExportService: ItemExportService,
    logger: BaseLogger,
  ) {
    this.fileService = fileService;
    this.itemExportRequestRepository = itemExportRequestRepository;
    this.mailerService = mailerService;
    this.itemService = itemService;
    this.authorizedItemService = authorizedItemService;
    this.memberService = memberService;
    this.itemExportService = itemExportService;
    this.logger = logger;
  }

  /**
   *  Check the member can access the item, then create an archive from the given item and send a download link to the member.
   * @param db database connection
   * @param itemId item to be exported
   * @param memberId member that requested the export
   */
  async exportFolderZipAndSendByEmail(db: DBConnection, itemId: string, memberId: string) {
    const item = await this.authorizedItemService.getItemById(db, {
      itemId,
      accountId: memberId,
    });

    // generate archive stream and send by email
    const member = await this.memberService.get(db, memberId);
    const memberInfo = member.toMemberInfo();
    const archive = await this.exportRaw(db, memberInfo, item);
    await this.uploadAndSendDownloadLink(db, memberInfo, item, archive, ItemExportRequestType.Raw);
  }

  /**
   * path where an export request is saved on the file storage
   * @param requestId
   * @returns
   */
  private buildExportPath(requestId: string) {
    return `item-export/${requestId}.zip`;
  }

  /**
   * Upload archive and send email with the download link
   * @param dbConnection
   * @param actor
   * @param item
   * @param archive zip content of the item to be uploaded
   */
  private async uploadAndSendDownloadLink(
    dbConnection: DBConnection,
    actor: MinimalAccount,
    item: ItemRaw,
    archive: ZipFile,
    type: ItemExportRequestTypeOptions,
  ) {
    // upload zip
    const filepath = await this.uploadZip(dbConnection, actor, item, archive, type);

    // send email
    const fullMember = await this.memberService.get(dbConnection, actor.id);
    const memberWithEmail = fullMember.toMemberInfo();
    await this.sendExportRawLinkInMail(memberWithEmail.email, memberWithEmail.lang, filepath, item);
  }

  /**
   * Upload zip on file storage service
   * @param dbConnection
   * @param actor
   * @param item
   * @param archive
   * @returns file path where the file is saved on the server
   */
  private async uploadZip(
    dbConnection,
    actor,
    item,
    archive: ZipFile,
    type: ItemExportRequestTypeOptions,
  ) {
    const request = await this.itemExportRequestRepository.create(dbConnection, {
      memberId: actor.id,
      itemId: item.id,
      type,
    });

    const filepath = this.buildExportPath(request.id);
    const tmpFolder = path.join(TMP_FOLDER, 'item-export');
    // make sure tmp folder exists
    fs.mkdirSync(tmpFolder, { recursive: true });
    const tmpFilepath = path.join(tmpFolder, request.id);

    try {
      // save temporary zip because archive.outputStream is NodeJS.ReadableStream
      await pipeline(archive.outputStream, fs.createWriteStream(tmpFilepath));
      const readFile = fs.createReadStream(tmpFilepath);

      await this.fileService.upload(actor, {
        file: readFile,
        filepath,
        mimetype: 'application/zip',
      });
      return filepath;
    } catch (e) {
      this.logger.error(e);
      throw e;
    } finally {
      // remove tmp file
      fs.unlink(tmpFilepath, (err) => {
        if (err) {
          this.logger.error(err);
        }
      });
    }
  }

  /**
   * Add item in archive, recursively add children in folder
   * @param actor
   * @param args
   */
  private async addItemToZip(
    dbConnection: DBConnection,
    actor: MaybeUser,
    args: {
      item: ItemRaw;
      archiveRootPath: string;
      archive: ZipFile;
    },
  ) {
    const { item, archiveRootPath, archive } = args;

    // save description in file
    if (item.description) {
      archive.addBuffer(
        Buffer.from(item.description),
        path.join(archiveRootPath, `${item.name}${DESCRIPTION_EXTENSION}`),
      );
    }

    if (isItemType(item, 'folder')) {
      // append description
      const folderPath = path.join(archiveRootPath, item.name);
      const children = await this.itemService.getChildren(dbConnection, actor, item.id);
      const result = await Promise.all(
        children.map((child) =>
          this.addItemToZip(dbConnection, actor, {
            item: child,
            archiveRootPath: folderPath,
            archive,
          }),
        ),
      );
      // add empty folder
      if (!result.length) {
        return archive.addEmptyDirectory(folderPath);
      }
      return;
    }

    // save single item
    const { stream, name } = await this.itemExportService.fetchItemData(dbConnection, actor, item);
    return archive.addReadStream(stream, path.join(archiveRootPath, name));
  }

  /**
   * Export the items recursively
   * @param item The root item
   * @returns A zip file promise
   */
  private async exportRaw(dbConnection: DBConnection, actor: MinimalMember, item: ItemRaw) {
    // init archive
    const archive = new ZipFile();
    archive.outputStream.on('error', function (err) {
      throw new UnexpectedExportError(err);
    });
    // path used to index files in archive
    const rootPath = path.dirname('./');

    // import items in zip recursively
    await this.addItemToZip(dbConnection, actor, {
      item,
      archiveRootPath: rootPath,
      archive,
    }).catch((error) => {
      this.logger.error(error);
      throw new UnexpectedExportError(error);
    });
    archive.end();

    return archive;
  }

  /**
   * send email with link to download the item zip exported content
   * @param email receiver email
   * @param lang language of the email
   * @param filepath where the zip file is saved
   * @param item item whose content has been exported
   */
  private async sendExportRawLinkInMail(
    email: string,
    lang: string,
    filepath: string,
    item: ItemRaw,
  ) {
    const link = await this.fileService.getUrl({
      path: filepath,
      expiration: EXPORT_ITEM_EXPIRATION,
      downloadName: `${item.name}.zip`,
    });
    const message = new MailBuilder({
      subject: {
        text: TRANSLATIONS.EXPORT_RAW_ITEM_TITLE,
        translationVariables: {
          itemName: item.name,
        },
      },
      lang,
    })
      .addText(TRANSLATIONS.EXPORT_RAW_ITEM_TEXT, {
        itemName: item.name,
        days: EXPORT_ITEM_EXPIRATION_DAYS.toString(),
        exportFormat: ItemExportRequestType.Raw,
      })
      .addButton(TRANSLATIONS.EXPORT_RAW_ITEM_BUTTON_TEXT, link)
      .build();

    this.mailerService.send(message, email).catch((err) => {
      console.debug(err, `mailer failed. export zip link: ${link}`);
    });
  }
}
