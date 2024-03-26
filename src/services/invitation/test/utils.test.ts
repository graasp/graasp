import * as crypto from 'crypto';
import Papa from 'papaparse';

import { BusboyFileStream } from '@fastify/busboy';
import { MultipartFile } from '@fastify/multipart';

import { PermissionLevel } from '@graasp/sdk';

import { CSV_MIMETYPE } from '../constants';
import { getCSV, regexGenFirstLevelItems, verifyCSVFileFormat } from '../utils';

interface MockData {
  email?: string;
  name?: string;
  permission?: PermissionLevel;
  group_name?: string;
}

describe('parsingCSV', () => {
  it('Parse CSV correctly', async () => {
    const CSV_SIZE_TEST = 3;
    let mockData: MockData[] = [];
    const allowedPermissions = [PermissionLevel.Read, PermissionLevel.Write];
    for (let i = 0; i < CSV_SIZE_TEST; i++) {
      const name = crypto.randomBytes(5).toString('hex');
      const permission = allowedPermissions[Math.floor(Math.random() * allowedPermissions.length)];
      mockData.push({
        email: name,
        name: name + '@org.com',
        permission: permission,
      });
    }
    const csvFields = Object.keys(mockData[0]);
    const parseSpy = jest.spyOn(Papa, 'parse').mockImplementation((_stream, options) => {
      options.complete({ data: mockData, meta: { fields: csvFields } });
    });

    //empty stream to call function
    const stream = {} as BusboyFileStream;
    const { rows, header } = await getCSV(stream);
    expect(rows).toEqual(mockData);
    expect(header).toEqual(csvFields);
  });

  it('Parse CSV incorrectly', async () => {
    const DUMMY_ERR_MSG = 'CSV dummy error';
    const parseSpy = jest.spyOn(Papa, 'parse').mockImplementation((_stream, options) => {
      options.error(new Error(DUMMY_ERR_MSG));
    });

    //empty stream to call function
    const stream = {} as BusboyFileStream;
    await expect(getCSV(stream)).rejects.toThrow(DUMMY_ERR_MSG);
  });
});

describe('Verify CSV format', () => {
  it('send correct CSV format', async () => {
    const uploadPayload = { mimetype: CSV_MIMETYPE } as MultipartFile;
    expect(() => {
      verifyCSVFileFormat(uploadPayload);
    }).not.toThrow();
  });

  it('send incorrect CSV format', async () => {
    const uploadPayload = { mimetype: crypto.randomBytes(5).toString('hex') } as MultipartFile;
    expect(() => {
      verifyCSVFileFormat(uploadPayload);
    }).toThrow();
  });
});

describe('Verify regex to', () => {
  const itemId = '1e901df0-d246-4672-bb01-34269f4c0fed';
  const childItemId = '1e901df0-d246-4672-bb01-11111f4c0fed';
  it('filter with first level items', async () => {
    const itemPath = itemId.replace(/-/g, '_');
    const childItemIdPath = childItemId.replace(/-/g, '_');
    const regex = regexGenFirstLevelItems(itemPath);
    const bagOfItems = [childItemIdPath, itemPath + '.' + childItemIdPath];
    const expectedPaths = [itemPath + '.' + childItemIdPath];
    const res = bagOfItems.filter((tmpItem) => {
      return regex.test(tmpItem);
    });

    expect(res).toEqual(expectedPaths);
  });
});
