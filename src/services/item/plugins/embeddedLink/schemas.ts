import S from 'fluent-json-schema';

import { ItemType } from '@graasp/sdk';

const embeddedLinkItemExtraCreate = S.object()
  .additionalProperties(false)
  .prop(
    ItemType.LINK,
    S.object().additionalProperties(false).prop('url', S.string().format('url')).required(['url']),
  )
  .required([ItemType.LINK]);

export const createSchema = S.object()
  .prop('type', S.const(ItemType.LINK))
  .prop('extra', embeddedLinkItemExtraCreate)
  .required(['type', 'extra']);

// equivalent in a static JSON Schema
// {
//   type: 'object',
//   properties: {
//     type: { const: 'embeddedLink' },
//     extra: {
//       type: 'object',
//       additionalProperties: false,
//       properties: {
//         embeddedLink: {
//           type: 'object',
//           additionalProperties: false,
//           properties: {
//             url: { type: 'string', format: 'url' }
//           },
//           required: ['url']
//         }
//       },
//       required: ['embeddedLink']
//     }
//   }
// }
