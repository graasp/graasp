import { StatusCodes } from 'http-status-codes';
import { Type } from '@sinclair/typebox';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { itemSchema } from '../../../schemas';
 
 export const itemValidationGroupSchemaRef = registerSchemaAsRef(
   'itemValidationGroup',
   'Item Validation Group',
   customType.StrictObject(
     {
       id: customType.UUID(),
       item: itemSchema,
       createdAt: customType.DateTime(),
       itemValidations: Type.Array(customType.StrictObject({
          id: customType.UUID(),
         
       item: itemSchema,
         
          process: Type.Enum(ItemValidationProcess),
         
          status: Type.Enum(ItemValidationStatus),
         
          result: Type.String(); 
        
          createdAt: customType.DateTime(),
        
          updatedAt: customType.DateTime(),
       })),
     },
     {
       description: 'Group of validations for an item',
     },
   ),
 );

export const getLatestItemValidationGroup = {
  operationId: 'getLatestItemValidationGroup',
  tags: ['collection','validation'],
  summary: 'Get latest validation information.',
  description: `Get latest validation information`,

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
    response: {
      [StatusCodes.OK]: itemValidationGroupSchemaRef,
    },
} as const satisfies FastifySchema;

export const getItemValidationGroup = {
  operationId: 'getItemValidationGroup',
  tags: ['collection','validation'],
  summary: 'Get item validation group given id',
  description: `Get item validation group given id.`,

  params: Type.Object(
    {
      itemId: customType.UUID(),
      itemValidationGroupId: customType.UUID(),
    },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;;
