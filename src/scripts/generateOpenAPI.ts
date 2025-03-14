import { writeFile } from 'node:fs/promises';

import registerAppPlugins from '../app.js';
import { instance } from '../fastify.js';

const output = 'openapi.json';

(async () => {
  await registerAppPlugins(instance);
  await instance.ready();

  if (instance.swagger === null || instance.swagger === undefined) {
    throw new Error('@fastify/swagger plugin is not loaded');
  }

  const schema = JSON.stringify(instance.swagger());
  await writeFile(output, schema, { flag: 'w+' });

  instance.close(() => {
    // eslint-disable-next-line no-console
    console.log(`OpenAPI schema generated at ${output}`);
    process.exit(1);
  });
})();
