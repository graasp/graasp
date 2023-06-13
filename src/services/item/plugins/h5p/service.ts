import path from 'path';

import { H5PItemType } from '@graasp/sdk';

import FileService from '../../../file/service';
import { Actor } from '../../../member/entities/member';
import { H5P_FILE_MIME_TYPE } from './constants';

/**
 * Implementation for the H5P service
 */
export class H5PService {
  private readonly fileService: FileService;
  private readonly pathPrefix: string;

  constructor(fileService: FileService, pathPrefix: string) {
    this.fileService = fileService;
    this.pathPrefix = pathPrefix;
  }

  /**
   * Download the H5P file referenced by a given Item
   */
  downloadH5P(item: H5PItemType, member: Actor, destinationPath: string) {
    const h5pPath = item.extra.h5p.h5pFilePath;
    return this.fileService.download(member, {
      id: item.id,
      path: path.join(this.pathPrefix, h5pPath),
      mimetype: H5P_FILE_MIME_TYPE,
      fileStorage: destinationPath,
    });
  }
}
