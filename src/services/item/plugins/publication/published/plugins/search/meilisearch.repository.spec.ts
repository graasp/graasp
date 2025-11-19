import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';

import { seedFromJson } from '../../../../../../../../test/mocks/seed';
import { db } from '../../../../../../../drizzle/db';
import { ItemType } from '../../../../../../../drizzle/types';
import { assertIsDefined } from '../../../../../../../utils/assertions';
import { TagCategory } from '../../../../../../tag/tag.schemas';
import { MeilisearchRepository } from './meilisearch.repository';

const meilisearchRepository = new MeilisearchRepository();

describe('Meilisearch Repository', () => {
  describe('getIndexedTree', () => {
    it('return correct items', async () => {
      const { items, members, publishedItems, tags } = await seedFromJson({
        actor: null,
        items: [
          {
            isPublic: true,
            isPublished: true,
            creator: { name: 'cedric' },
            name: 'parent',
            description: 'parent description',
            tags: [{ category: TagCategory.Level, name: faker.word.words(5) }],
            children: [
              {
                name: 'document',
                type: ItemType.DOCUMENT,
                description: 'document description with some <div>html</div>',
                extra: { document: { content: 'document content with some <div>html</div>' } },
              },
              {
                name: 'file',
                description: null,
                type: ItemType.FILE,
                extra: { file: { content: 'pdf content' } },
              },
              { extra: { folder: {} }, type: 'folder', likes: [{ name: 'bob' }, { name: 'anna' }] },
              {
                extra: { folder: {} },
                type: 'folder',
                tags: [
                  { category: TagCategory.Discipline, name: faker.word.words(5) },
                  { category: TagCategory.Discipline, name: faker.word.words(5) },
                ],
              },
            ],
          },
        ],
      });
      assertIsDefined(publishedItems);

      const results = await meilisearchRepository.getIndexedTree(db, items[0].path);

      // parent item
      const parent = results.find(({ id }) => id === items[0].id);
      expect(parent).toEqual({
        id: items[0].id,
        name: 'parent',
        description: 'parent description',
        type: ItemType.FOLDER,
        lang: items[0].lang,
        content: '',
        level: [tags[0].name],
        discipline: [],
        'resource-type': [],
        creator: { id: members[2].id, name: members[2].name },
        updatedAt: items[0].updatedAt,
        createdAt: items[0].createdAt,
        isPublishedRoot: true,
        publicationUpdatedAt: publishedItems[0].updatedAt,
        isHidden: false,
        likes: 0,
      });

      // document with content, remove html
      const document = results.find(({ id }) => id === items[1].id);
      expect(document).toEqual({
        id: items[1].id,
        name: 'document',
        description: 'document description with some html',
        type: ItemType.DOCUMENT,
        content: 'document content with some html',
        lang: items[1].lang,
        level: [],
        discipline: [],
        'resource-type': [],
        creator: { id: '', name: '' },
        updatedAt: items[1].updatedAt,
        createdAt: items[1].createdAt,
        isPublishedRoot: false,
        publicationUpdatedAt: publishedItems[0].updatedAt,
        isHidden: false,
        likes: 0,
      });

      // file with content
      const file = results.find(({ id }) => id === items[2].id);
      expect(file).toEqual({
        id: items[2].id,
        name: 'file',
        description: '',
        type: ItemType.FILE,
        content: 'pdf content',
        lang: items[2].lang,
        level: [],
        discipline: [],
        'resource-type': [],
        creator: { id: '', name: '' },
        updatedAt: items[2].updatedAt,
        createdAt: items[2].createdAt,
        isPublishedRoot: false,
        publicationUpdatedAt: publishedItems[0].updatedAt,
        isHidden: false,
        likes: 0,
      });

      // item with likes
      const likedItem = results.find(({ id }) => id === items[3].id);
      expect(likedItem).toEqual({
        id: items[3].id,
        name: items[3].name,
        description: items[3].description,
        type: items[3].type,
        content: '',
        lang: items[3].lang,
        level: [],
        discipline: [],
        'resource-type': [],
        creator: { id: '', name: '' },
        updatedAt: items[3].updatedAt,
        createdAt: items[3].createdAt,
        isPublishedRoot: false,
        publicationUpdatedAt: publishedItems[0].updatedAt,
        isHidden: false,
        likes: 2,
      });

      // item with 2 tags
      const itemWith2Tags = results.find(({ id }) => id === items[4].id);
      expect(itemWith2Tags).toEqual({
        id: items[4].id,
        name: items[4].name,
        description: items[4].description,
        type: items[4].type,
        content: '',
        lang: items[4].lang,
        level: [],
        discipline: expect.arrayContaining([tags[1].name, tags[2].name]),
        'resource-type': [],
        creator: { id: '', name: '' },
        updatedAt: items[4].updatedAt,
        createdAt: items[4].createdAt,
        isPublishedRoot: false,
        publicationUpdatedAt: publishedItems[0].updatedAt,
        isHidden: false,
        likes: 0,
      });
    });
    it('return nothing for non published item', async () => {
      const { items } = await seedFromJson({
        actor: null,
        items: [
          {
            children: [{}],
          },
        ],
      });

      const result = await meilisearchRepository.getIndexedTree(db, items[0].path);

      expect(result).toHaveLength(0);
    });
    it('return nothing for deleted item', async () => {
      const { items } = await seedFromJson({
        actor: null,
        items: [
          {
            isPublic: true,
            isPublished: true,
            isDeleted: true,
            children: [
              {
                isDeleted: true,
              },
            ],
          },
        ],
      });

      const result = await meilisearchRepository.getIndexedTree(db, items[0].path);

      expect(result).toHaveLength(0);
    });
    it('return nothing for hidden item', async () => {
      const { items } = await seedFromJson({
        actor: null,
        items: [
          {
            isPublic: true,
            isPublished: true,
            isHidden: true,
            children: [{}],
          },
        ],
      });

      const result = await meilisearchRepository.getIndexedTree(db, items[0].path);

      expect(result).toHaveLength(0);
    });
    it('return only parent if child item is hidden', async () => {
      const { items } = await seedFromJson({
        actor: null,
        items: [
          {
            isPublic: true,
            isPublished: true,
            children: [
              {
                isHidden: true,
              },
            ],
          },
        ],
      });

      const result = await meilisearchRepository.getIndexedTree(db, items[0].path);

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(items[0].id);
    });
  });
});
