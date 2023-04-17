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
      $ref: 'http://graasp.org/#/definitions/uuid',
    },
  },
  required: ['itemId'],
  additionalProperties: false,
};

// export const itemValidationReview = {
//   params: {
//     id: {
//       $ref: 'http://graasp.org/#/definitions/uuid',
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
    itemValidationId: {
      $ref: 'http://graasp.org/#/definitions/uuid',
    },
  },
  required: ['itemValidationId'],
  additionalProperties: false,
};
