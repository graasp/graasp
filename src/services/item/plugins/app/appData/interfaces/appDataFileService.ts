import { MultipartFile } from '@fastify/multipart';

import { Account } from '../../../../../account/entities/account';
import { Item } from '../../../../entities/Item';
import { AppData } from '../appData';

export interface AppDataFileService {
  upload(
    account: Account,
    file: MultipartFile,
    item: Item,
  ): Promise<Pick<AppData, 'id' | 'data' | 'visibility' | 'type'>>;

  download(appData: AppData): Promise<string>;

  deleteOne(appData: AppData): Promise<void>;
}
