export const itemValidationReviews = {
  params: {},
  additionalProperties: false,
};

export const status = {
  params: {},
  additionalProperties: false,
};

export const itemValidation = {
  params: {
    itemId: {
      $ref: 'https://graasp.org/#/definitions/uuid',
    },
  },
  required: ['itemId'],
  additionalProperties: false,
};

// export const itemValidationReview = {
//   params: {
//     id: {
//       $ref: 'https://graasp.org/#/definitions/uuid',
//     },
//   },
//   body: {
//     status: {
//       type: 'string',
//     },
//     reason: {
//       type: 'string',
//     },
//   },
//   required: ['id'],
//   additionalProperties: false,
// };

export const itemValidationGroup = {
  params: {
    itemId: {
      $ref: 'https://graasp.org/#/definitions/uuid',
    },
    itemValidationGroupId: {
      $ref: 'https://graasp.org/#/definitions/uuid',
    },
  },
  required: ['itemValidationId'],
  additionalProperties: false,
};
