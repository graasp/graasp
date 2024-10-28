import { customType } from '../../../../plugins/typebox';

export const createEtherpad = {
  operationId: 'createEtherpad',
  tags: ['item', 'etherpad'],
  summary: 'Create etherpad',
  description: 'Create an etherpad item.',

  querystring: customType.StrictObject({
    parentId: customType.UUID(),
  }),
  body: customType.StrictObject({
    name: customType.ItemName(),
  }),
};

export const getEtherpadFromItem = {
  operationId: 'getEtherpadFromItem',
  tags: ['item', 'etherpad'],
  summary: 'Get etherpad information',
  description: 'Get etherpad information from item id',

  querystring: customType.StrictObject({
    mode: customType.EnumString(['read', 'write']),
  }),
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
};
