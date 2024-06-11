import { MeiliSearch } from 'meilisearch';
import { DataSource } from 'typeorm';

import { BaseLogger } from '../../../../../../logger';
import { MEILISEARCH_MASTER_KEY, MEILISEARCH_URL } from '../../../../../../utils/config';
import FileService from '../../../../../file/service';
import { MeiliSearchWrapper } from './meilisearch';

export const createMeiliSearchWrapper = (
  fileService: FileService,
  db: DataSource,
  log: BaseLogger,
) => {
  const meilisearchConnection = new MeiliSearch({
    host: MEILISEARCH_URL,
    apiKey: MEILISEARCH_MASTER_KEY,
  });
  return new MeiliSearchWrapper(db, meilisearchConnection, fileService, log);
};
