import { Type } from '@sinclair/typebox';

import { customType } from '../../../../../plugins/typebox';
import { itemIdSchemaRef } from '../../../schema';

export const itemValidationReviews = {
  params: {},
  additionalProperties: false,
};

export const status = {
  params: {},
  additionalProperties: false,
};

export const itemValidation = {
  params: itemIdSchemaRef,
  required: ['itemId'],
  additionalProperties: false,
};

export const itemValidationGroup = {
  params: Type.Object(
    {
      itemId: customType.UUID(),
      itemValidationGroupId: customType.UUID(),
    },
    { additionalProperties: false },
  ),
  required: ['itemValidationId'],
  additionalProperties: false,
};
