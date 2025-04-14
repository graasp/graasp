import 'reflect-metadata';

import { client } from '../src/drizzle/db';

async function afterTests() {
  await client.end();
}
export default afterTests;
