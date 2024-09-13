import { writeFile } from 'node:fs/promises';
import 'reflect-metadata';

import fastify from 'fastify';

import registerAppPlugins from '../app';
import ajvFormats from '../schemas/ajvFormats';

(async () => {
  const app = fastify({
    disableRequestLogging: true,
    ajv: {
      customOptions: {
        coerceTypes: 'array',
        allowUnionTypes: true,
      },
      plugins: [ajvFormats],
    },
  });

  await registerAppPlugins(app);

  await app.ready();

  if (app.swagger === null || app.swagger === undefined) {
    throw new Error('@fastify/swagger plugin is not loaded');
  }

  const schema = JSON.stringify(app.swagger());
  // const schema = JSON.stringify(app.swagger(), undefined, 2); for pretty print
  await writeFile('./openapi.json', schema, { flag: 'w+' });

  await app.close();
})();
