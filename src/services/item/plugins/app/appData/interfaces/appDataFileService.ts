import type { MultipartFile } from '@fastify/multipart';

import { ItemRaw } from '../../../../../../drizzle/item.dto';
import type { AppDataRaw } from '../../../../../../drizzle/types';
import { AuthenticatedUser } from '../../../../../../types';

export interface AppDataFileService {
  upload(
    account: AuthenticatedUser,
    file: MultipartFile,
    item: ItemRaw,
  ): Promise<{ id: string; data: { [key: string]: unknown }; type: string }>;

  download(appData: AppDataRaw): Promise<string>;

  deleteOne(appData: AppDataRaw): Promise<void>;
}
