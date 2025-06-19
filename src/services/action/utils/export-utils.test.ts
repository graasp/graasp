import { ExportActionsFormatting } from '@graasp/sdk';

import { formatData } from '../../item/plugins/action/requestExport/utils';

describe('formatData', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  describe('CSV format', () => {
    it('Empty array should not write anything', () => {
      const result = formatData(ExportActionsFormatting.CSV, []);
      expect(result).toEqual('');
    });

    it('Empty object should not write anything', () => {
      const result = formatData(ExportActionsFormatting.CSV, {});
      expect(result).toEqual('');
    });

    it('Array should be written', () => {
      const result = formatData(ExportActionsFormatting.CSV, [{ name: 'hello' }, { name: 'test' }]);
      expect(result).toEqual('name\r\nhello\r\ntest');
    });

    it('Nested properties will be flattened', () => {
      const result = formatData(ExportActionsFormatting.CSV, [
        { name: 'hello', nest: { prop: 'value' } },
        { name: 'test', nest: { prop: 'other value' } },
      ]);
      expect(result).toEqual('name,nest.prop\r\nhello,value\r\ntest,other value');
    });
  });

  describe('JSON format', () => {
    it('Empty array should not write anything', () => {
      const result = formatData(ExportActionsFormatting.JSON, []);
      expect(result).toEqual('{}');
    });

    it('Empty object should not write anything', () => {
      const result = formatData(ExportActionsFormatting.JSON, {});
      expect(result).toEqual('{}');
    });

    it('Array should be written', () => {
      const data = [
        { name: 'hello', nest: { prop: 'value' } },
        { name: 'test', nest: { prop: 'other value' } },
      ];
      const result = formatData(ExportActionsFormatting.JSON, data);
      expect(result).toEqual(JSON.stringify(data));
    });

    it('Object should be written', () => {
      const data = { name: 'hello', nest: { prop: 'value' } };
      const result = formatData(ExportActionsFormatting.JSON, data);
      expect(result).toEqual(JSON.stringify(data));
    });
  });
});
