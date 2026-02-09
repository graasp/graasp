import fetch from 'node-fetch';
import { Readable } from 'stream';
import { singleton } from 'tsyringe';

import { getMimetype } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import {
  type ItemRaw,
  isAppItemDTO,
  isDocumentItemDTO,
  isEmbeddedLinkItemDTO,
  isEtherpadItemDTO,
  isFileItemDTO,
  isH5PItemDTO,
} from '../../../../drizzle/item.dto';
import { MaybeUser } from '../../../../types';
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
      case isFileItemDTO(item): {
        const mimetype = getMimetype(item.extra) || 'application/octet-stream';
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
      case isH5PItemDTO(item): {
        const h5pUrl = await this.h5pService.getUrl(item);
        const res = await fetch(h5pUrl);

        const filename = getFilenameFromItem(item);
        return { mimetype: 'application/octet-stream', name: filename, stream: res.body };
      }
      case isDocumentItemDTO(item): {
        return {
          stream: Readable.from([item.extra.document?.content]),
          name: getFilenameFromItem(item),
          mimetype: 'text/html',
        };
      }
      case isEmbeddedLinkItemDTO(item): {
        return {
          stream: Readable.from(buildTextContent(item.extra.embeddedLink?.url, 'embeddedLink')),
          name: getFilenameFromItem(item),
          mimetype: 'text/plain',
        };
      }
      case isAppItemDTO(item): {
        return {
          stream: Readable.from(buildTextContent(item.extra.app?.url, 'app')),
          name: getFilenameFromItem(item),
          mimetype: 'text/plain',
        };
      }
      case isEtherpadItemDTO(item): {
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
