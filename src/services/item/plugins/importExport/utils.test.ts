import archiver from 'archiver';
import fs, { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';

import { ItemType } from '@graasp/sdk';

import { Item } from '../../entities/Item';
import { DESCRIPTION_EXTENSION } from './constants';
import { handleItemDescription } from './utils';

const DEFAULT_FOLDER_NAME = 'parentFolder';

describe('Utils', () => {
  describe('handleItemDescription', () => {
    it('Parent description', async () => {
      const updateParentDescriptionMock = jest.fn();

      const folderName = DEFAULT_FOLDER_NAME;
      const filename = `${folderName}${DESCRIPTION_EXTENSION}`;
      const items: Partial<Item>[] = [{ name: folderName, type: ItemType.FOLDER }];

      await handleItemDescription({
        filename,
        filepath: path.resolve(__dirname, './test/fixtures', filename),
        folderName,
        items,
        updateParentDescription: updateParentDescriptionMock,
      });

      expect(updateParentDescriptionMock).toHaveBeenCalledTimes(1);
    });
    it('Image', async () => {
      const name = 'img.png';
      const filename = `${name}${DESCRIPTION_EXTENSION}`;
      const items: Partial<Item>[] = [{ name, type: ItemType.LOCAL_FILE }];

      await handleItemDescription({
        filename,
        filepath: path.resolve(__dirname, './test/fixtures', filename),
        folderName: DEFAULT_FOLDER_NAME,
        items,
        updateParentDescription: jest.fn(),
      });

      // description content mocked with file name
      // contain instead of equal because of break lines
      expect(items[0].description).toContain(name);
    });
    it('Graasp Document', async () => {
      const name = 'document.graasp';
      const filename = `${name}${DESCRIPTION_EXTENSION}`;
      const items: Partial<Item>[] = [{ name: 'document', type: ItemType.DOCUMENT }];

      await handleItemDescription({
        filename,
        filepath: path.resolve(__dirname, './test/fixtures', filename),
        folderName: DEFAULT_FOLDER_NAME,
        items,
        updateParentDescription: jest.fn(),
      });

      // description content mocked with file name
      // contain instead of equal because of break lines
      expect(items[0].description).toContain(name);
    });
    it('Link', async () => {
      const name = 'link.url';
      const filename = `${name}${DESCRIPTION_EXTENSION}`;
      const items: Partial<Item>[] = [{ name: 'link', type: ItemType.LINK }];

      await handleItemDescription({
        filename,
        filepath: path.resolve(__dirname, './test/fixtures', filename),
        folderName: DEFAULT_FOLDER_NAME,
        items,
        updateParentDescription: jest.fn(),
      });

      // description content mocked with file name
      // contain instead of equal because of break lines
      expect(items[0].description).toContain(name);
    });
    it('App', async () => {
      const name = 'app.url';
      const filename = `${name}${DESCRIPTION_EXTENSION}`;
      const items: Partial<Item>[] = [{ name: 'app', type: ItemType.APP }];

      await handleItemDescription({
        filename,
        filepath: path.resolve(__dirname, './test/fixtures', filename),
        folderName: DEFAULT_FOLDER_NAME,
        items,
        updateParentDescription: jest.fn(),
      });

      // description content mocked with file name
      // contain instead of equal because of break lines
      expect(items[0].description).toContain(name);
    });
  });
});
