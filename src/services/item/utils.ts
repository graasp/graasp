import { ValidateFunction } from 'ajv';
import { Readable } from 'node:stream';
import { readPdfText } from 'pdf-text-reader';
import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { MultipartFields, MultipartFile } from '@fastify/multipart';

import { ItemGeolocation, ItemType, ItemTypeUnion, isChildOf } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { ALLOWED_SEARCH_LANGS } from '../../utils/config';
import { NoFileProvided } from '../../utils/errors';
import { Account } from '../account/entities/account';
import { isMember } from '../member/entities/member';
import { FolderItem, Item, isItemType } from './entities/Item';
import { ItemSearchParams, Ordering, SortBy, orderingToUpperCase } from './types';
import { validateGeolocation, validateSettings } from './validation';

const itemOrderFn = (a: Item, b: Item) => {
  return (a.order ?? 0) - (b.order ?? 0);
};
// cannot use sdk sort because of createdAt type
export const sortChildrenForTreeWith = (descendants: Item[], parentItem: FolderItem): Item[] => {
  const directChildren = descendants.filter((child) => isChildOf(child.path, parentItem.path));

  // order
  directChildren.sort(itemOrderFn);

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

/**
 * Apply item search criteria on given select query
 * @param query current select query builder
 * @param account member requesting the data
 * @param ItemSearchParams search parameters
 * @param entityNames string name of the table defined in select query builder
 */
export const applySearchParamsToQuery = (
  query: SelectQueryBuilder<ObjectLiteral>,
  account: Account,
  {
    creatorId,
    keywords,
    sortBy = SortBy.ItemUpdatedAt,
    ordering = Ordering.DESC,
    permissions,
    types,
  }: ItemSearchParams,
  { item = 'item', creator = 'creator' }: { item?: string; creator?: string } = {},
): void => {
  if (creatorId) {
    query.andWhere('item.creator = :creatorId', { creatorId });
  }

  if (permissions) {
    query.andWhere('im.permission IN (:...permissions)', { permissions });
  }

  const allKeywords = keywords?.filter((s) => s && s.length);
  if (allKeywords?.length) {
    const keywordsString = allKeywords.join(' ');
    query.andWhere(
      new Brackets((q) => {
        // search in english by default
        q.where(`${item}.search_document @@ plainto_tsquery('english', :keywords)`, {
          keywords: keywordsString,
        });

        // no dictionary
        q.orWhere(`${item}.search_document @@ plainto_tsquery('simple', :keywords)`, {
          keywords: keywordsString,
        });

        // raw words search
        allKeywords.forEach((k, idx) => {
          q.orWhere(`${item}.name ILIKE :k_${idx}`, {
            [`k_${idx}`]: `%${k}%`,
          });
        });

        // search by member lang
        const memberLang = isMember(account) ? account.lang : DEFAULT_LANG;
        if (memberLang != DEFAULT_LANG && ALLOWED_SEARCH_LANGS[memberLang]) {
          q.orWhere(`${item}.search_document @@ plainto_tsquery(:lang, :keywords)`, {
            keywords: keywordsString,
            lang: ALLOWED_SEARCH_LANGS[memberLang],
          });
        }
      }),
    );
  }

  if (types) {
    query.andWhere(`${item}.type IN (:...types)`, { types });
  }

  if (sortBy) {
    // map strings to correct sort by column
    let mappedSortBy;
    switch (sortBy) {
      case SortBy.ItemType:
        mappedSortBy = `${item}.type`;
        break;
      case SortBy.ItemUpdatedAt:
        mappedSortBy = `${item}.updated_at`;
        break;
      case SortBy.ItemCreatedAt:
        mappedSortBy = `${item}.created_at`;
        break;
      case SortBy.ItemCreatorName:
        mappedSortBy = `${creator}.name`;
        break;
      case SortBy.ItemName:
        mappedSortBy = `${item}.name`;
        break;
    }
    if (mappedSortBy) {
      query.orderBy(mappedSortBy, orderingToUpperCase(ordering));
    }
  }
};
