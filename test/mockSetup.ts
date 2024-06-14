import 'reflect-metadata';

import { registerValue } from '../src/dependencies';
import { FASTIFY_LOGGER_DI_KEY } from '../src/utils/dependencies.keys';

registerValue(FASTIFY_LOGGER_DI_KEY, console);

jest.mock('../src/services/item/plugins/published/plugins/search/meilisearch');
