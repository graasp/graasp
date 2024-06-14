import { DataSource } from 'typeorm';

import { ItemType } from '@graasp/sdk';

import { FolderService } from './folderService';
import { AppService } from './plugins/app/service';
import { H5PService } from './plugins/html/h5p/service';
import { ItemService } from './service';

export class ItemServiceManager {
  // get from injection
  private db: DataSource;
  private h5pService: H5PService;
  private appService: AppService;
  private folderService: FolderService;

  static async getServiceForTypeFromId(repositories, id: string): Promise<ItemService> {
    // TODO: check permission

    // not really cool
    const item = await repositories.itemRepository.get(id);

    // question: would be best to get the service given the item
    // like item.getService() but not sure it's feasible
    switch (item.type) {
      case ItemType.FOLDER:
        return this.folderService;
      case ItemType.APP:
        return this.appService;
      case ItemType.H5P:
      default:
        return this.h5pService;
    }
  }
}
