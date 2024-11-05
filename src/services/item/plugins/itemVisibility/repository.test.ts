import { FastifyInstance } from 'fastify';

import { ItemVisibilityType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { ItemTestUtils, expectItem } from '../../test/fixtures/items';
import { ItemVisibility } from './ItemVisibility';
import { ItemVisibilityRepository } from './repository';

const rawRepository = AppDataSource.getRepository(ItemVisibility);
const repository = new ItemVisibilityRepository();
const testUtils = new ItemTestUtils();

describe('getManyBelowAndSelf', () => {
  let app: FastifyInstance;
  let actor;

  beforeAll(async () => {
    ({ app, actor } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  it('get empty', async () => {
    const { item } = await testUtils.saveItemAndMembership({ member: actor });
    const visibilityTypes = [ItemVisibilityType.Hidden];
    // noise should not be returned
    await rawRepository.save({ type: ItemVisibilityType.Public, item });

    const tags = await repository.getManyBelowAndSelf(item, visibilityTypes);

    expect(tags).toHaveLength(0);
  });

  it("get self's tags", async () => {
    const { item } = await testUtils.saveItemAndMembership({ member: actor });
    const visibilityTypes = [ItemVisibilityType.Hidden, ItemVisibilityType.Public];
    const visibility = await rawRepository.save({ type: ItemVisibilityType.Public, item });

    const tags = await repository.getManyBelowAndSelf(item, visibilityTypes);

    expect(tags).toHaveLength(1);
    expect(tags[0].type).toEqual(visibility.type);
    expectItem(tags[0].item, visibility.item);
  });

  it('get self and parents', async () => {
    const { item } = await testUtils.saveItemAndMembership({ member: actor });
    const child = await testUtils.saveItem({ actor, parentItem: item });
    await testUtils.saveItem({ actor, parentItem: item });
    await testUtils.saveItem({ actor, parentItem: item });

    const visibilityTypes = [ItemVisibilityType.Hidden, ItemVisibilityType.Public];
    const tag1 = await rawRepository.save({ type: ItemVisibilityType.Public, item });
    const tag2 = await rawRepository.save({ type: ItemVisibilityType.Public, item: child });

    const tags = await repository.getManyBelowAndSelf(item, visibilityTypes);

    expect(tags).toHaveLength(2);
    tags.forEach((t) => {
      if (tag1.id === t.id) {
        expect(t.type).toEqual(tag1.type);
        expectItem(t.item, tag1.item);
      } else if (tag2.id === t.id) {
        expect(t.type).toEqual(tag2.type);
        expectItem(t.item, tag2.item);
      } else {
        throw new Error('error in visibility');
      }
    });
  });
});
