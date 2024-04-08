import fs from 'node:fs';
import path from 'node:path';

import { parseCSV } from './utils';

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
