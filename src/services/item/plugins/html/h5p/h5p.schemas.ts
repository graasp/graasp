import { Type } from '@sinclair/typebox';
import type { JSONSchemaType } from 'ajv';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import { itemCommonSchema } from '../../../common.schemas';
import { H5P } from './validation/h5p';

const h5pItemSchema = Type.Composite([
  itemCommonSchema,
  customType.StrictObject(
    {
      type: Type.Literal('h5p'),
      extra: customType.StrictObject({
        h5p: customType.StrictObject({
          contentId: Type.String(),
          h5pFilePath: Type.String(),
          contentFilePath: Type.String(),
        }),
      }),
    },
    {
      title: 'H5P Item',
      description: 'Item of type H5P.',
    },
  ),
]);

export const h5pExtendedItemSchema = Type.Composite([
  itemCommonSchema,
  customType.StrictObject(
    {
      type: Type.Literal('h5p'),
      extra: customType.StrictObject({
        h5p: customType.StrictObject({
          contentId: Type.String(),
          h5pFilePath: Type.String(),
          contentFilePath: Type.String(),
          integrationUrl: Type.String({ description: 'url of the h5p integration' }),
        }),
      }),
    },
    {
      title: 'H5P Extended Item',
      description: 'Extended item of type H5P.',
    },
  ),
]);

export const h5pItemSchemaRef = registerSchemaAsRef('h5pItem', 'H5P Item', h5pItemSchema);

export const h5pImport = {
  operationId: 'importH5p',
  tags: ['item', 'h5p'],
  summary: 'Import H5P file',
  description: 'Import H5P file and create corresponding item.',

  querystring: customType.StrictObject({
    parentId: Type.Optional(
      customType.UUID({
        description:
          'The H5P item will be created in this parent item. The current user should have write access to this item.',
      }),
    ),
    previousItemId: Type.Optional(
      customType.UUID({
        description: 'The new H5P item will be placed immediately after this item in the list.',
      }),
    ),
  }),
  response: {
    [StatusCodes.OK]: h5pItemSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * Describes an h5p.json manifest as a JSON schema
 * See {@link H5P.Manifest}
 */
export const h5pManifestSchema: JSONSchemaType<H5P.Manifest> = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    mainLibrary: { type: 'string' },
    language: {
      type: 'string',
      enum: [
        'aa',
        'ab',
        'ae',
        'af',
        'ak',
        'am',
        'an',
        'ar',
        'as',
        'av',
        'ay',
        'az',
        'ba',
        'be',
        'bg',
        'bh',
        'bi',
        'bm',
        'bn',
        'bo',
        'br',
        'bs',
        'ca',
        'ce',
        'ch',
        'co',
        'cr',
        'cs',
        'cu',
        'cv',
        'cy',
        'da',
        'de',
        'dv',
        'dz',
        'ee',
        'el',
        'en',
        'eo',
        'es',
        'et',
        'eu',
        'fa',
        'ff',
        'fi',
        'fj',
        'fo',
        'fr',
        'fy',
        'ga',
        'gd',
        'gl',
        'gn',
        'gu',
        'gv',
        'ha',
        'he',
        'hi',
        'ho',
        'hr',
        'ht',
        'hu',
        'hy',
        'hz',
        'ia',
        'id',
        'ie',
        'ig',
        'ii',
        'ik',
        'io',
        'is',
        'it',
        'iu',
        'ja',
        'jv',
        'ka',
        'kg',
        'ki',
        'kj',
        'kk',
        'kl',
        'km',
        'kn',
        'ko',
        'kr',
        'ks',
        'ku',
        'kv',
        'kw',
        'ky',
        'la',
        'lb',
        'lg',
        'li',
        'ln',
        'lo',
        'lt',
        'lu',
        'lv',
        'mg',
        'mh',
        'mi',
        'mk',
        'ml',
        'mn',
        'mr',
        'ms',
        'mt',
        'my',
        'na',
        'nb',
        'nd',
        'ne',
        'ng',
        'nl',
        'nn',
        'no',
        'nr',
        'nv',
        'ny',
        'oc',
        'oj',
        'om',
        'or',
        'os',
        'pa',
        'pi',
        'pl',
        'ps',
        'pt',
        'qu',
        'rm',
        'rn',
        'ro',
        'ru',
        'rw',
        'sa',
        'sc',
        'sd',
        'se',
        'sg',
        'si',
        'sk',
        'sl',
        'sm',
        'sn',
        'so',
        'sq',
        'sr',
        'ss',
        'st',
        'su',
        'sv',
        'sw',
        'ta',
        'te',
        'tg',
        'th',
        'ti',
        'tk',
        'tl',
        'tn',
        'to',
        'tr',
        'ts',
        'tt',
        'tw',
        'ty',
        'ug',
        'uk',
        'ur',
        'uz',
        've',
        'vi',
        'vo',
        'wa',
        'wo',
        'xh',
        'yi',
        'yo',
        'za',
        'zh',
        'zu',
        'und',
      ],
    },
    preloadedDependencies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          machineName: { type: 'string' },
          majorVersion: { anyOf: [{ type: 'integer' }, { type: 'string' }] },
          minorVersion: { anyOf: [{ type: 'integer' }, { type: 'string' }] },
        },
        required: ['machineName', 'majorVersion', 'minorVersion'],
      },
    },
    embedTypes: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: { type: 'string', enum: ['div', 'iframe'] },
      uniqueItems: true,
    },
    authors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string', enum: ['Author', 'Editor', 'Licensee', 'Originator'] },
        },
        required: ['name', 'role'],
      },
      nullable: true, // JSON schema treats undefined as nullable?
    },
    source: {
      type: 'string',
      nullable: true, // JSON schema treats undefined as nullable?
    },
    license: {
      type: 'string',
      // enum: [
      //   'CC-BY',
      //   'CC BY-SA',
      //   'CC BY-ND',
      //   'CC BY-NC',
      //   'CC BY-NC-SA',
      //   'CC CC-BY-NC-CD',
      //   'CC0 1.0',
      //   'GNU GPL',
      //   'PD',
      //   'ODC PDDL',
      //   'CC PDM',
      //   'C',
      //   'U',
      // ],
      nullable: true, // JSON schema treats undefined as nullable?
    },
    licenseVersion: {
      type: 'string',
      nullable: true, // JSON schema treats undefined as nullable?
    },
    licenseExtras: {
      type: 'string',
      nullable: true, // JSON schema treats undefined as nullable?
    },
    yearFrom: {
      type: ['string', 'integer'],
      nullable: true, // JSON schema treats undefined as nullable?
    },
    yearTo: {
      type: ['string', 'integer'],
      nullable: true, // JSON schema treats undefined as nullable?
    },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          author: { type: 'string' },
          log: { type: 'string' },
        },
        required: ['date', 'author', 'log'],
      },
      nullable: true, // JSON schema treats undefined as nullable?
    },
    authorComments: {
      type: 'string',
      nullable: true, // JSON schema treats undefined as nullable?
    },
  },
  required: ['title', 'mainLibrary', 'language', 'preloadedDependencies', 'embedTypes'],
  additionalProperties: true,
};
