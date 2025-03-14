import 'reflect-metadata';

import { FASTIFY_LOGGER_DI_KEY } from '../src/di/constants.js';
import { registerValue } from '../src/di/utils.js';

registerValue(FASTIFY_LOGGER_DI_KEY, console);

jest.mock('../src/services/item/plugins/publication/published/plugins/search/meilisearch');
