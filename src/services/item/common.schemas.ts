import { Type } from '@sinclair/typebox';

import { Alignment, CCLicenseAdaptions, DescriptionPlacement, MaxWidth } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { itemTypeSchemaRef } from '../../schemas/global';
import { nullableMemberSchemaRef } from '../member/member.schemas';

export const settingsSchema = Type.Partial(
  customType.StrictObject(
    {
      lang: Type.String({ deprecated: true }),
      isPinned: Type.Boolean(),
      /**
       * @deprecated use entities tags and item tags instead
       */
      tags: Type.Array(Type.String(), { deprecated: true }),
      showChatbox: Type.Boolean(),
      isResizable: Type.Boolean(),
      hasThumbnail: Type.Boolean(),
      ccLicenseAdaption: Type.Union([
        customType.EnumString(Object.values(CCLicenseAdaptions)),
        Type.Null(),
      ]),
      displayCoEditors: Type.Boolean(),
      descriptionPlacement: customType.EnumString(Object.values(DescriptionPlacement)),
      isCollapsible: Type.Boolean(),
      enableSaveActions: Type.Boolean(),
      // link settings
      showLinkIframe: Type.Boolean(),
      showLinkButton: Type.Boolean(),
      // file settings
      maxWidth: Type.Enum(MaxWidth),
      alignment: Type.Enum(Alignment),
    },
    {
      title: 'Item settings',
      description: 'Parameters, mostly visual, common to all types of items.',
    },
  ),
);

export const itemCommonSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    name: customType.ItemName(),
    description: customType.Nullable(Type.String()),
    path: Type.String(),
    lang: Type.String(),
    settings: settingsSchema,
    creator: Type.Optional(nullableMemberSchemaRef),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
  },
  {
    title: 'Item',
    description: 'Generic item unit of a learning collection',
  },
);

export const genericItemSchema = Type.Intersect([
  itemCommonSchema,
  Type.Object({
    type: itemTypeSchemaRef,
    extra: Type.Object({}),
  }),
]);

export const genericItemSchemaRef = registerSchemaAsRef(
  'genericItem',
  'Generic Item',
  genericItemSchema,
);
