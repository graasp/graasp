import fs from 'node:fs';
import path from 'node:path';

import { MultipartFile } from '@fastify/multipart';

import { CSV_MIMETYPE } from './constants';
import { parseCSV, verifyCSVFileFormat } from './utils';

describe('Test utils', () => {
  describe('parseCSV', () => {
    it('parse correct input', async () => {
      const fileStream = fs.createReadStream(
        path.resolve(__dirname, './test/fixtures/single-user.csv'),
      );
      const { rows } = await parseCSV(fileStream);
      expect(rows).toEqual([{ name: 'Alice', email: 'alice@graasp.org', permission: 'read' }]);
    });
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
    const uploadPayload = { mimetype: 'wrong-mimetype' } as MultipartFile;
    expect(() => {
      verifyCSVFileFormat(uploadPayload);
    }).toThrow();
  });
});
