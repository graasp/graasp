import { unparse } from 'papaparse';

import { ExportActionsFormatting } from '@graasp/sdk';

type RecursiveObject = { [key: string]: string | number | RecursiveObject };
type ReturnObject = { [key: string]: string | number };
// flatten object nested keys to have as item.id, member.id to be used for export csv header
const flattenObject = (obj: RecursiveObject, prefix: string = ''): ReturnObject => {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k] as RecursiveObject, pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
};

export const formatData = <T extends object>(
  format: ExportActionsFormatting,
  data: T[] | T,
): string => {
  switch (format) {
    case ExportActionsFormatting.CSV: {
      if (Array.isArray(data)) {
        const newData = data.map((obj) => flattenObject(obj as RecursiveObject));
        const csv = unparse(newData, {
          header: true,
          delimiter: ',',
        });

        return csv;
      }
      // default value, the data is empty or is not an array
      return '';
    }
    case ExportActionsFormatting.JSON:
    default: {
      // data can be an object or an array of objects
      if (
        (Array.isArray(data) && data.length) ||
        (!Array.isArray(data) && Object.keys(data).length)
      ) {
        return JSON.stringify(data);
      }
      // default value, the data is empty
      return JSON.stringify({});
    }
  }
};
