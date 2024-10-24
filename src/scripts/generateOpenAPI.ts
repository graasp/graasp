import { writeFile } from 'node:fs/promises';

import registerAppPlugins from '../app';
import { instance } from '../fastify';

const output = '.openapi.json';

(async () => {
  await registerAppPlugins(instance);
  await instance.ready();

  if (instance.swagger === null || instance.swagger === undefined) {
    throw new Error('@fastify/swagger plugin is not loaded');
  }

  const schema = JSON.stringify(instance.swagger());
  await writeFile(output, schema, { flag: 'w+' });

  instance.close(() => {
    console.log(`OpenAPI schema generated at ${output}`);
    process.exit(1);
  });
})();
