import { ValidateFunction } from 'ajv';
import { Readable } from 'node:stream';
import { readPdfText } from 'pdf-text-reader';

import { MultipartFields, MultipartFile } from '@fastify/multipart';

import {
  ItemGeolocation,
  ItemType,
  ItemTypeUnion,
  UUID,
  buildPathFromIds,
  isChildOf,
} from '@graasp/sdk';

import { NoFileProvided } from '../../utils/errors.js';
import { FolderItem, Item, isItemType } from './entities/Item.js';
import { validateGeolocation, validateSettings } from './validation.js';

// replace children order with new ids
export const _fixChildrenOrder = (itemsMap: Map<string, { copy: Item; original: Item }>) => {
  // get copied with original createdAt to later compare
  const copyItemsArray = Array.from(itemsMap.values()).map(({ copy, original }) => ({
    ...copy,
    createdAt: original.createdAt,
  }));
  itemsMap.forEach((value) => {
    const { copy, original } = value;
    // set order for all copied folder
    if (isItemType(original, ItemType.FOLDER) && isItemType(copy, ItemType.FOLDER)) {
      // init extra if necessary
      if (!copy.extra.folder) {
        copy.extra.folder = { childrenOrder: [] };
      }

      const childrenOrder = original.extra.folder?.childrenOrder || [];

      // change previous ids to copied item ids
      const copyOrder = childrenOrder
        .map((oldId) => itemsMap.get(oldId)?.copy.id)
        .filter(Boolean) as UUID[];

      // get direct children
      const children = copyItemsArray.filter(({ id, path }) => {
        return path === `${copy.path}.${buildPathFromIds(id)}`;
      });

      // sort children to get wanter order -> get order by mapping to id
      children.sort(sortChildrenWith(copyOrder));
      const completeOrder = children.map(({ id }) => id);

      copy.extra.folder.childrenOrder = completeOrder;
    }

    return value;
  });
};

// cannot use sdk sort because of createdAt type
export const sortChildrenWith = (idsOrder: string[]) => (stElem: Item, ndElem: Item) => {
  if (idsOrder.indexOf(stElem.id) >= 0 && idsOrder.indexOf(ndElem.id) >= 0) {
    return idsOrder.indexOf(stElem.id) - idsOrder.indexOf(ndElem.id);
  }
  if (idsOrder.indexOf(stElem.id) >= 0) {
    return -1;
  }

  if (idsOrder.indexOf(ndElem.id) >= 0) {
    return 1;
  }

  return stElem.createdAt.getTime() - ndElem.createdAt.getTime();
};

// cannot use sdk sort because of createdAt type
export const sortChildrenForTreeWith = (descendants: Item[], parentItem: FolderItem): Item[] => {
  const order = parentItem.extra?.folder?.childrenOrder ?? [];
  const directChildren = descendants.filter((child) => isChildOf(child.path, parentItem.path));

  // order
  const compareFn = sortChildrenWith(order);
  directChildren.sort(compareFn);

  const tree = directChildren.map((directChild) => {
    if (!isItemType(directChild, ItemType.FOLDER)) {
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
  item: Partial<Item> & Pick<Item, 'name' | 'type'>;
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
  if (!maybeType || !(Object.values(ItemType) as string[]).includes(maybeType)) {
    throw new Error('missing type or invlid type provided');
  }
  // here we cast as we have checked previously that it was valid
  const type = maybeType as ItemTypeUnion;

  // non-mandatory fields
  const description = getFieldFromMultipartForm(formData.fields, 'description');
  const displayName = getFieldFromMultipartForm(formData.fields, 'displayName');

  // nested objects that we need to deeply validate
  const settingsRaw = getFieldFromMultipartForm(formData.fields, 'settings');
  const geolocationRaw = getFieldFromMultipartForm(formData.fields, 'geolocation');
  const extraRaw = getFieldFromMultipartForm(formData.fields, 'extra');

  // validate nested objects
  const settings = parseAndValidateField<Item['settings']>(settingsRaw, validateSettings);
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
      displayName,
      settings,
      extra,
    },
    geolocation,
    thumbnail: formData.file,
  };
};
