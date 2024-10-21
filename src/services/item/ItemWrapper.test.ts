import { FastifyInstance } from 'fastify';

import { ItemTagType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app';
import { ItemWrapper } from './ItemWrapper';
import { createTag } from './plugins/itemTag/test/fixtures';
import { ItemTestUtils } from './test/fixtures/items';

const testUtils = new ItemTestUtils();

describe('ItemWrapper', () => {
  let app: FastifyInstance;

  // datasource needs to be set
  beforeAll(async () => {
    ({ app } = await build());
  });
  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('Return highest tags for child item', async () => {
    const parentItem = testUtils.createItem();
    const item = testUtils.createItem({ parentItem });

    const publicTag = await createTag({ item, type: ItemTagType.Public });
    const parentHiddenTag = await createTag({ item: parentItem, type: ItemTagType.Hidden });
    const hiddenTag = await createTag({ item, type: ItemTagType.Hidden });
    // unordered tags
    const tags = [hiddenTag, publicTag, parentHiddenTag];
    const itemWrapper = new ItemWrapper(item, undefined, tags);

    const packedItem = itemWrapper.packed();
    expect(packedItem.public!.id).toEqual(publicTag.id);
    // should return parent tag, not item tag
    expect(packedItem.hidden!.id).toEqual(parentHiddenTag.id);
  });
});
