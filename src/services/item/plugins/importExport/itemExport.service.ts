import fetch from 'node-fetch';
import { Readable } from 'stream';
import { singleton } from 'tsyringe';

import { FileItemExtra, getMimetype } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { MaybeUser } from '../../../../types';
import {
  type ItemRaw,
  isAppItem,
  isDocumentItem,
  isEmbeddedLinkItem,
  isEtherpadItem,
  isFileItem,
  isH5PItem,
} from '../../item';
import { EtherpadItemService } from '../etherpad/etherpad.service';
import FileItemService from '../file/itemFile.service';
import { H5PService } from '../html/h5p/h5p.service';
import { buildTextContent, getFilenameFromItem } from './utils';

@singleton()
export class ItemExportService {
  private readonly h5pService: H5PService;
  private readonly etherpadService: EtherpadItemService;
  private readonly fileItemService: FileItemService;

  constructor(
    fileItemService: FileItemService,
    etherpadService: EtherpadItemService,
    h5pService: H5PService,
  ) {
    this.fileItemService = fileItemService;
    this.etherpadService = etherpadService;
    this.h5pService = h5pService;
  }

  public async fetchItemData(
    dbConnection: DBConnection,
    actor: MaybeUser,
    item: ItemRaw,
  ): Promise<{ name: string; stream: NodeJS.ReadableStream; mimetype: string }> {
    switch (true) {
      case isFileItem(item): {
        // bug: we need to cast because of mismatch with sdk
        const mimetype = getMimetype(item.extra as FileItemExtra) || 'application/octet-stream';
        const url = await this.fileItemService.getUrl(dbConnection, actor, {
          itemId: item.id,
        });
        const res = await fetch(url);

        const filename = getFilenameFromItem(item);
        return {
          name: filename,
          mimetype,
          stream: res.body,
        };
      }
      case isH5PItem(item): {
        const h5pUrl = await this.h5pService.getUrl(item);
        const res = await fetch(h5pUrl);

        const filename = getFilenameFromItem(item);
        return { mimetype: 'application/octet-stream', name: filename, stream: res.body };
      }
      case isDocumentItem(item): {
        return {
          stream: Readable.from([item.extra.document?.content]),
          name: getFilenameFromItem(item),
          mimetype: 'text/html',
        };
      }
      case isEmbeddedLinkItem(item): {
        return {
          stream: Readable.from(buildTextContent(item.extra.embeddedLink?.url, 'embeddedLink')),
          name: getFilenameFromItem(item),
          mimetype: 'text/plain',
        };
      }
      case isAppItem(item): {
        return {
          stream: Readable.from(buildTextContent(item.extra.app?.url, 'app')),
          name: getFilenameFromItem(item),
          mimetype: 'text/plain',
        };
      }
      case isEtherpadItem(item): {
        return {
          stream: Readable.from(
            await this.etherpadService.getEtherpadContentFromItem(dbConnection, actor, item.id),
          ),
          name: getFilenameFromItem(item),
          mimetype: 'text/html',
        };
      }
    }
    throw new Error(`cannot fetch data for item ${item.id}`);
  }
}
