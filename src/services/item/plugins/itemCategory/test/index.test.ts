import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { CategoryType, HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../util/config';
import { MemberCannotAccess } from '../../../util/graasp-error';
import { Item } from '../../item/entities/Item';
import { saveItemAndMembership } from '../../itemMembership/test/fixtures/memberships';
import { Member } from '../../member/entities/member';
import { BOB, saveMember } from '../../member/test/fixtures/members';
import { Category } from '../entities/Category';
import { ItemCategory } from '../entities/ItemCategory';
import { DuplicateItemCategoryError } from '../errors';
import { CategoryRepository } from '../repositories/category';
import { ItemCategoryRepository } from '../repositories/itemCategory';

// mock datasource
jest.mock('../../../plugins/datasource');

export const expectItemCategory = (newItemCategory, correctItemCategory) => {
  expect(newItemCategory.category).toEqual(correctItemCategory.category);
};

export const expectItemCategories = (newItemCategories, correctItemCategories) => {
  expect(newItemCategories).toHaveLength(correctItemCategories.length);
  for (const iC of newItemCategories) {
    const correctIC = correctItemCategories.find(({ id }) => id === iC.id);
    if (!correctIC) {
      throw new Error('correct item category does not exist!');
    }
    expectItemCategory(iC.category, correctIC.category);
  }
};

export const saveCategories = async () => {
  const categories: Category[] = [];
  categories.push(await CategoryRepository.save({ name: 'level-1', type: CategoryType.LEVEL }));
  categories.push(await CategoryRepository.save({ name: 'level-2', type: CategoryType.LEVEL }));
  categories.push(await CategoryRepository.save({ name: 'level-3', type: CategoryType.LEVEL }));
  categories.push(
    await CategoryRepository.save({ name: 'discipline-1', type: CategoryType.DISCIPLINE }),
  );
  categories.push(
    await CategoryRepository.save({ name: 'discipline-2', type: CategoryType.DISCIPLINE }),
  );
  return categories;
};

export const saveItemCategories = async ({ item, categories }) => {
  const itemCategories: ItemCategory[] = [];
  for (const category of categories) {
    itemCategories.push(await ItemCategoryRepository.save({ item, category }));
  }
  return itemCategories;
};

export const setUp = async ({ actor, item }: { actor: Member; item?: Item }) => {
  const categories = await saveCategories();
  const returnValues: { itemCategories?: ItemCategory[]; categories: Category[] } = {
    categories,
  };
  if (item) {
    const itemCategories = await saveItemCategories({ item, categories });
    returnValues.itemCategories = itemCategories;
  }
  return returnValues;
};

describe('Categories', () => {
  let app;
  let actor;
  let member;
  let categories;
  let itemCategories;
  let item;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    member = null;
    categories = null;
    itemCategories = null;
    item = null;
    app.close();
  });

  describe('GET /categories', () => {
    describe('Signed out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
        ({ itemCategories, categories } = await setUp({ actor: member, item }));
      });

      it('Get categories', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/categories`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toEqual(categories);
      });
      // it('Get categories by type', async () => {

      //   const typeId = CATEGORY_TYPES[0];

      //   const res = await app.inject({
      //     method: 'GET',
      //     url: `/categories${qs.stringify(
      //       { typeId },
      //       { addQueryPrefix: true, arrayFormat: 'repeat' },
      //     )}`,
      //   });
      //   expect(res.statusCode).toBe(StatusCodes.OK);
      //   expect(res.json()).toEqual([CATEGORIES[0]]);
      // });
      // it('Throw if type id is invalid', async () => {

      //   const res = await app.inject({
      //     method: 'GET',
      //     url: `/categories${qs.stringify(
      //       { typeId: 'invalid-id' },
      //       { addQueryPrefix: true, arrayFormat: 'repeat' },
      //     )}`,
      //   });
      //   expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      // });
    });
  });

  // describe('GET /category-types', () => {
  //   it('Get category types', async () => {

  //     const res = await app.inject({
  //       method: 'GET',
  //       url: '/category-types',
  //     });
  //     expect(res.statusCode).toBe(StatusCodes.OK);
  //     expect(res.json()).toEqual(CATEGORY_TYPES);
  //   });
  // });

  // describe('GET /categories/:categoryId', () => {
  //   it('Get category', async () => {
  //     const result = CATEGORIES[0];

  //     const res = await app.inject({
  //       method: 'GET',
  //       url: `/categories/${v4()}`,
  //     });
  //     expect(res.statusCode).toBe(StatusCodes.OK);
  //     expect(res.json()).toEqual(result);
  //   });
  //   it('Throw if category id is invalid', async () => {

  //     const res = await app.inject({
  //       method: 'GET',
  //       url: '/categories/invalid-id',
  //     });
  //     expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
  //   });
  // });

  describe('GET /:itemId/categories', () => {
    describe('Signed out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
        ({ itemCategories, categories } = await setUp({ actor: member, item }));
      });

      it('Throws for private item', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/categories`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      // TODO: public
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemAndMembership({ member: actor }));
        ({ itemCategories, categories } = await setUp({ actor, item }));
      });

      it('Get categories of an item', async () => {
        const result = itemCategories;

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/categories`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemCategories(res.json(), result);
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/categories`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('POST /:id/categories', () => {
    describe('Signed out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        ({ categories } = await setUp({ actor: member }));
      });

      it('Throws if does not have membership', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/categories`,
          payload: {
            categoryId: categories[0].id,
          },
        });
        expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ categories } = await setUp({ actor }));
      });

      it('Post category for an item', async () => {
        ({ item } = await saveItemAndMembership({ member: actor }));
        const itemCategory = ItemCategoryRepository.create({ item, category: categories[0] });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/categories`,
          payload: {
            categoryId: itemCategory.category.id,
          },
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemCategory(res.json(), itemCategory);

        const [savedValues] = await ItemCategoryRepository.find({ relations: { category: true } });
        expectItemCategory(savedValues, itemCategory);
      });

      it('Post same category for an item throws', async () => {
        ({ item } = await saveItemAndMembership({ member: actor }));
        const itemCategory = ItemCategoryRepository.create({ item, category: categories[0] });
        // pre save item category
        await ItemCategoryRepository.save(itemCategory);

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/categories`,
          payload: {
            categoryId: itemCategory.category.id,
          },
        });
        expect(res.json()).toMatchObject(new DuplicateItemCategoryError(expect.anything()));

        const savedValues = await ItemCategoryRepository.find({ relations: { category: true } });
        expect(savedValues).toHaveLength(1);
      });
      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/categories`,
          payload: {
            categoryId: categories[0].id,
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Bad request if body is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/categories`,
          payload: {
            categoryId: 'invalid-id',
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('DELETE /:itemId/categories/:categoryId', () => {
    describe('Signed out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
        ({ itemCategories, categories } = await setUp({ actor: member, item }));
      });

      it('Throws if does not have membership', async () => {
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/categories/${itemCategories[0].id}`,
        });

        expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemAndMembership({ member: actor }));
        ({ itemCategories, categories } = await setUp({ actor, item }));
      });

      it('Delete item category', async () => {
        const iC = itemCategories[0];
        expect(await ItemCategoryRepository.findOneBy({ id: iC.id })).toBeTruthy();

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/categories/${iC.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).toEqual(iC.id);

        expect(await ItemCategoryRepository.findOneBy({ id: iC.id })).toBeFalsy();
      });
      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/categories/${v4()}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Bad request if item category id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/categories/invalid-id`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      // question: wanted behavior?
      it('Does not throw if item category id does not exist', async () => {
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/categories/${v4()}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
      });
    });
  });
});
