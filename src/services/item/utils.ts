import type { ValidateFunction } from 'ajv';
import { Readable } from 'node:stream';
import { readPdfText } from 'pdf-text-reader';

import type { MultipartFields, MultipartFile } from '@fastify/multipart';

import { type ItemGeolocation, isChildOf } from '@graasp/sdk';

import type { ItemRaw } from '../../drizzle/types';
import { ITEM_TYPES, ItemType } from '../../schemas/global';
import { NoFileProvided } from '../../utils/errors';
import { type FolderItem, isItemType } from './discrimination';
import { validateGeolocation, validateSettings } from './validation';

const itemOrderFn = (a: ItemRaw, b: ItemRaw) => {
  return (a.order ?? 0) - (b.order ?? 0);
};
// cannot use sdk sort because of createdAt type
export const sortChildrenForTreeWith = <T extends ItemRaw>(
  descendants: T[],
  parentItem: FolderItem,
): T[] => {
  const directChildren = descendants.filter((child) => isChildOf(child.path, parentItem.path));

  // order
  directChildren.sort(itemOrderFn);

  const tree = directChildren.map((directChild) => {
    if (!isItemType(directChild, 'folder')) {
      return [directChild];
    }
    return [directChild, ...sortChildrenForTreeWith(descendants, directChild)];
  });
  return tree.flat();
};

export const readPdfContent = async (source: string | URL) => {
  try {
    const pages = await readPdfText({ url: source, useSystemFonts: true });
    //limit indexing to first pages
    const maxPage = Math.min(pages.length, 10);
    return pages
      .slice(0, maxPage)
      .flatMap((p) => p.lines)
      .join(' ')
      .replace(/\0/g, ' '); // Replace the null unicode character because Postgres can't parse it as JSON
  } catch {
    return '';
  }
};

export const getFieldFromMultipartForm = (
  fields: MultipartFields,
  key: string,
): string | undefined => {
  const field = fields[key];
  if (field && !Array.isArray(field) && field.type === 'field') {
    return field.value as string;
  }
};

export const parseAndValidateField = <T>(
  content: string | undefined,
  validate: ValidateFunction<T>,
): T | undefined => {
  if (content) {
    const parsedData = JSON.parse(content);
    const isValid = validate(parsedData);
    if (!isValid) {
      throw new Error(validate.errors?.toString());
    }
    return parsedData;
  }
  return undefined;
};

export const getPostItemPayloadFromFormData = (
  formData: MultipartFile | undefined,
): {
  item: Partial<ItemRaw> & Pick<ItemRaw, 'name' | 'type'>;
  geolocation: Pick<ItemGeolocation, 'lat' | 'lng'> | undefined;
  thumbnail: Readable;
} => {
  // if there is no formData in the request throw an error
  if (!formData) {
    throw new Error('Missing formData');
  }

  /**
   * Parsing the input data from within the FormData
   */
  const name = getFieldFromMultipartForm(formData.fields, 'name');
  // name should be present
  if (!name) {
    throw new Error('missing required name');
  }
  const maybeType = getFieldFromMultipartForm(formData.fields, 'type');
  // type should be present and should be one of the available types

  if (!maybeType || !ITEM_TYPES.includes(maybeType)) {
    throw new Error('missing type or invalid type provided');
  }

  // here we cast as we have checked previously that it was valid
  const type = maybeType as ItemType;

  // non-mandatory fields
  const description = getFieldFromMultipartForm(formData.fields, 'description');

  // nested objects that we need to deeply validate
  const settingsRaw = getFieldFromMultipartForm(formData.fields, 'settings');
  const geolocationRaw = getFieldFromMultipartForm(formData.fields, 'geolocation');
  const extraRaw = getFieldFromMultipartForm(formData.fields, 'extra');

  // validate nested objects
  const settings = parseAndValidateField<ItemRaw['settings']>(settingsRaw, validateSettings);
  // const extra = parseAndValidateField<Item['extra']>(extraRaw);
  // TODO: extra is not validated
  const extra = extraRaw ? JSON.parse(extraRaw) : undefined;
  const geolocation = parseAndValidateField<Pick<ItemGeolocation, 'lat' | 'lng'>>(
    geolocationRaw,
    validateGeolocation,
  );

  if (!formData.file) {
    throw new NoFileProvided();
  }

  return {
    item: {
      name,
      type,
      description,
      settings,
      extra,
    },
    geolocation,
    thumbnail: formData.file,
  };
};
