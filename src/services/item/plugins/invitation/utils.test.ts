import fs from 'node:fs';
import path from 'node:path';

import { parseCSV } from './utils';

describe('Test utils', () => {
  describe('parseCSV', () => {
    it('parse correct input', async () => {
      const fileStream = fs.createReadStream(path.join(__dirname, './test/fixtures/users.csv'));
      const { rows } = await parseCSV(fileStream);
      console.log('in test', rows);
      expect(rows).toEqual([{ name: 'Alice', email: 'alice@graasp.org', permission: 'read' }]);
    });
  });
});
