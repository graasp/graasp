import { TagCategory } from '@graasp/sdk';

import { client } from '../../../drizzle/db';
import { saveTag } from './utils';

describe('saveTag util', () => {
  beforeAll(async () => {
    await client.connect();
  });
  it('duplicate', async () => {
    const tagModel = { name: 'name', category: TagCategory.Level };
    const tag1 = await saveTag(tagModel);
    const tag2 = await saveTag(tagModel);
    expect(tag1.id).toEqual(tag2.id);
  });
});
