import 'reflect-metadata';

import { client } from '../src/drizzle/db';

async function beforeTests() {
  await client.connect();
}
export default beforeTests;
