import { Type } from '@sinclair/typebox';

import { customType } from '../../../../../plugins/typebox';

export const itemValidationReviews = {
  params: {},
  additionalProperties: false,
};

export const status = {
  params: {},
  additionalProperties: false,
};

export const itemValidation = {
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
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
  additionalProperties: false,
};
