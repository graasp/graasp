import 'reflect-metadata';

import { FASTIFY_LOGGER_DI_KEY } from '../src/di/constants';
import { registerValue } from '../src/di/utils';

registerValue(FASTIFY_LOGGER_DI_KEY, console);

jest.mock('../src/services/item/plugins/publication/published/plugins/search/meilisearch');

jest.retryTimes(5, { logErrorsBeforeRetry: true });
