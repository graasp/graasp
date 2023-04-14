import Ajv from 'ajv';

import { Action } from '../../../action/entities/action';
import { actionsSchemaForAnalytics, descendantsSchemaForAnalytics, itemSchemaForAnalytics, memberSchemaForAnalytics } from '../../../action/schemas';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';

export class BaseAnalytics {
  readonly actions: Action[];
  readonly members: Member[];
  readonly itemMemberships: ItemMembership[];
  readonly descendants: Item[];
  readonly item: Item;
  readonly metadata: {
    numActionsRetrieved: number;
    requestedSampleSize: number;
  };

  constructor(args: {
    item: Item;
    descendants: Item[];
    actions: Action[];
    members: Member[];
    itemMemberships: ItemMembership[];
    metadata: {
      numActionsRetrieved: number;
      requestedSampleSize: number;
    };
  }) {
    // TODO: all other schemas
    
    // validate and remove additional properties
    const ajv = new Ajv({ removeAdditional: 'all' });

    const validateMembers = ajv.compile(memberSchemaForAnalytics);
    validateMembers(args.members);
    
    const validateItem = ajv.compile(itemSchemaForAnalytics);
    validateItem(args.item);
    
    const validateDescendants = ajv.compile(descendantsSchemaForAnalytics);
    validateDescendants(args.descendants);
    
    const validateActions = ajv.compile(actionsSchemaForAnalytics);
    validateActions(args.actions);

    this.actions = args.actions;
    this.members = args.members;
    this.item = args.item;
    this.descendants = args.descendants;
    this.metadata = args.metadata;
    this.itemMemberships = args.itemMemberships;
  }
}
