import extract from 'extract-zip';
import fs from 'fs';
import { lstat, mkdir, readdir } from 'fs/promises';
import mime from 'mime';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { dir } from 'tmp-promise';
import { v4 } from 'uuid';

import type { FastifyBaseLogger } from 'fastify';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import type { MinimalMember } from '../../../../types';
import { TMP_FOLDER } from '../../../../utils/config';
import FileService, { type FileServiceConfig } from '../../../file/file.service';
import type { FileStorageType } from '../../../file/types';
import { fileRepositoryFactory } from '../../../file/utils/factory';
import { StorageService } from '../../../member/plugins/storage/memberStorage.service';
import { GraaspHtmlError, HtmlImportError } from './errors';
import { DEFAULT_MIME_TYPE } from './h5p/constants';
import type { HtmlValidator } from './validator';

/**
 * Implementation for the Html service
 */
export abstract class HtmlService {
  public readonly fileService: FileService;
  protected readonly storageService: StorageService;
  protected readonly validator: HtmlValidator;
  protected readonly mimetype: string;
  protected readonly extension: string;
  protected readonly pathPrefix: string;
  protected readonly logger: BaseLogger;
  protected readonly tempDir: string;
  private readonly config: FileServiceConfig;

  constructor(
    {
      config,
      fileStorageType,
    }: {
      config: FileServiceConfig;
      fileStorageType: FileStorageType;
    },
    storageService: StorageService,
    pathPrefix: string,
    mimetype: string,
    extension: string,
    validator: HtmlValidator,
    log: BaseLogger,
  ) {
    if (pathPrefix && pathPrefix.startsWith('/')) {
      throw new Error('path prefix should not start with a "/"!');
    }
    this.logger = log;
    this.extension = extension;
    this.fileService = new FileService(fileRepositoryFactory(fileStorageType, config), this.logger);
    this.storageService = storageService;
    this.mimetype = mimetype;
    this.pathPrefix = pathPrefix;
    this.validator = validator;

    this.tempDir = path.resolve(TMP_FOLDER, 'html-packages', this.pathPrefix);
    this.config = config;

    // create temp extraction dir if it does not exist
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  buildLocalStorageRoot() {
    if (!this.config.local) {
      throw new Error('file service local config is not defined');
    }
    return path.join(this.config.local?.storageRootPath, this.pathPrefix);
  }

  /**
   * Helper to build the root remote path for a specific package
   */
  buildRootPath = (pathPrefix: string, contentId: string) => path.join(pathPrefix, contentId);

  /**
   * Helper to build the local or remote path of the package file
   * // <contentId>/<filename>.<extension>
   */
  buildPackagePath = (rootPath: string, filename: string) => {
    // build a short filename without special characters
    const safeName = filename
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20);

    return path.join(rootPath, `${safeName}.${this.extension}`);
  };

  /**
   * Helper to build the local or remote path of the html content root
   * // <contentId>/content
   */
  buildContentPath = (rootPath: string) => path.join(rootPath, 'content');

  /**
   * Util function to get url of the package file given an item
   * This function should not be used outside html services
   */
  protected async _getUrl(id: ItemRaw['id'], packagePath: string) {
    return this.fileService.getUrl({
      path: path.join(this.pathPrefix, packagePath),
    });
  }

  /**
   * Uploads the package content into storage
   * Recursive function to traverse and upload the html folder
   * IMPORTANT: the top-down traversal must not wait for long (ensures that files
   * are uploaded in parallel as soon as possible). Results aggregation can however
   * await in parallel (note: await in a map fn does not block the map iteration).
   */
  async uploadPackage(
    member: MinimalMember,
    folder: string,
    uploadPath: string,
    log?: FastifyBaseLogger,
  ): Promise<Array<string>> {
    const children = await readdir(folder);

    // we will flatMap with promises: first map
    const uploads = children.map(async (child) => {
      const childPath = path.join(folder, child);
      const childUploadPath = path.join(uploadPath, child);
      const stats = await lstat(childPath);

      if (stats.isDirectory()) {
        // recursively upload child folder
        return await this.uploadPackage(member, childPath, childUploadPath, log);
      } else {
        // ignore this file if extension is not allowed
        const ext = path.extname(childPath);

        if (!this.validator.isExtensionAllowed(ext)) {
          log?.info(
            `HTML import: illegal file extension detected (${ext}), skipping file: ${childPath}`,
          );
          // we're using flatMap, represent none value with empty array
          return [];
        }

        const mimetype = mime.getType(ext) ?? DEFAULT_MIME_TYPE;
        await this.fileService.upload(member, {
          file: fs.createReadStream(childPath),
          filepath: childUploadPath,
          mimetype,
        });

        // we're using flatMap, wrap result in array
        return [childUploadPath];
      }
    });
    // then resolve promises array and flatten
    return (await Promise.all(uploads)).flat();
  }

  /**
   * Upload the HTML file and get the metadata of the file.
   */
  async uploadFile(
    dbConnection: DBConnection,
    actor: MinimalMember,
    filename: string,
    stream: Readable,
    log?: FastifyBaseLogger,
  ): Promise<{ remoteRootPath: string; baseName: string; contentId: string }> {
    // check member storage limit
    await this.storageService.checkRemainingStorage(dbConnection, actor);
    const contentId = v4();
    const tmpDir = await dir({ tmpdir: this.tempDir, unsafeCleanup: true });
    const targetFolder = path.join(tmpDir.path, contentId);
    const remoteRootPath = this.buildRootPath(this.pathPrefix, contentId);

    await mkdir(targetFolder, { recursive: true });
    const baseName = path.basename(filename, `.${this.extension}`);

    // try-catch block for local storage cleanup
    try {
      const savePath = this.buildPackagePath(targetFolder, baseName);
      const contentFolder = this.buildContentPath(targetFolder);

      // save html file
      await pipeline(stream, fs.createWriteStream(savePath));
      await extract(savePath, { dir: contentFolder });

      // validate package before saving it
      await this.validator.validatePackage(contentFolder);

      // try-catch block for remote storage cleanup
      try {
        // upload whole folder to public storage
        await this.uploadPackage(actor, targetFolder, remoteRootPath, log);
        return { remoteRootPath, baseName, contentId };
      } catch (error) {
        // delete storage folder of this html package if upload or creation fails
        await this.fileService.deleteFolder(remoteRootPath);
        // rethrow above
        log?.error(error);
        throw error;
      }
      // end of try-catch block for remote storage cleanup
    } catch (error) {
      // log and rethrow to let fastify handle the error response
      log?.error('graasp-plugin-html: unexpected error occured while importing Html:');
      log?.error(error);
      // wrap into plugin error type if not ours
      if (!(error instanceof GraaspHtmlError)) {
        error = new HtmlImportError();
      }
      throw error;
    } finally {
      // in all cases, remove local temp folder
      await tmpDir.cleanup();
    }
    // end of try-catch block for local storage cleanup
  }

  deletePackage(contentId: string) {
    const folderPath = this.buildRootPath(this.pathPrefix, contentId);
    return this.fileService.deleteFolder(folderPath);
  }
}
