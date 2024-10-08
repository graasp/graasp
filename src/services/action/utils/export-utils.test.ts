import fs from 'fs';

import { ExportActionsFormatting } from '@graasp/sdk';

import { writeFileForFormat } from './export';

const writeFileSyncMock = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
describe('writeFileForFormat', () => {
  describe('CSV format', () => {
    it('Empty array should not write anything', () => {
      writeFileForFormat('./test.csv', ExportActionsFormatting.CSV, []);
      expect(writeFileSyncMock).not.toHaveBeenCalled();
    });

    it('Empty object should not write anything', () => {
      writeFileForFormat('./test.csv', ExportActionsFormatting.CSV, {});
      expect(writeFileSyncMock).not.toHaveBeenCalled();
    });

    it('Array should be written', () => {
      writeFileForFormat('./test.csv', ExportActionsFormatting.CSV, [
        { name: 'hello' },
        { name: 'test' },
      ]);
      expect(writeFileSyncMock).toHaveBeenCalledWith('./test.csv', 'name\r\nhello\r\ntest');
    });

    it('Nested properties will be flattened', () => {
      writeFileForFormat('./test.csv', ExportActionsFormatting.CSV, [
        { name: 'hello', nest: { prop: 'value' } },
        { name: 'test', nest: { prop: 'other value' } },
      ]);
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        './test.csv',
        'name,nest.prop\r\nhello,value\r\ntest,other value',
      );
    });
  });

  describe('JSON format', () => {
    it('Empty array should not write anything', () => {
      writeFileForFormat('./test.json', ExportActionsFormatting.JSON, []);
      expect(writeFileSyncMock).not.toHaveBeenCalled();
    });

    it('Empty object should not write anything', () => {
      writeFileForFormat('./test.json', ExportActionsFormatting.JSON, {});
      expect(writeFileSyncMock).not.toHaveBeenCalled();
    });

    it('Array should be written', () => {
      const data = [
        { name: 'hello', nest: { prop: 'value' } },
        { name: 'test', nest: { prop: 'other value' } },
      ];
      writeFileForFormat('./test.json', ExportActionsFormatting.JSON, data);
      expect(writeFileSyncMock).toHaveBeenCalledWith('./test.json', JSON.stringify(data));
    });

    it('Object should be written', () => {
      const data = { name: 'hello', nest: { prop: 'value' } };
      writeFileForFormat('./test.json', ExportActionsFormatting.JSON, data);
      expect(writeFileSyncMock).toHaveBeenCalledWith('./test.json', JSON.stringify(data));
    });
  });
});
