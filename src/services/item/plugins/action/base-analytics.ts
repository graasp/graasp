import { Ajv } from 'ajv';

import { UUID } from '@graasp/sdk';

import {
  AccountRaw,
  ActionRaw,
  AppActionRaw,
  AppDataRaw,
  AppSettingRaw,
  ChatMessageRaw,
  Item,
  ItemMembershipRaw,
} from '../../../../drizzle/types';

// copy of member's schema
const memberSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
  },
};

export class BaseAnalytics {
  readonly actions: ActionRaw[];
  readonly members: { id: string; name: string }[];
  readonly itemMemberships: ItemMembershipRaw[];
  readonly descendants: Item[];
  readonly item: Item;
  readonly apps: {
    [key: UUID]: {
      data: AppData[];
      settings: AppSettingRaw[];
      actions: AppActionRaw[];
    };
  };
  readonly chatMessages: ChatMessageRaw[];
  readonly metadata: {
    numActionsRetrieved: number;
    requestedSampleSize: number;
  };

  constructor(args: {
    item: Item;
    descendants: Item[];
    actions: ActionRaw[];
    members: AccountRaw[];
    itemMemberships: ItemMembershipRaw[];
    chatMessages: ChatMessageRaw[];
    apps: {
      [key: UUID]: {
        data: AppDataRaw[];
        settings: AppSettingRaw[];
        actions: AppActionRaw[];
      };
    };
    metadata: {
      numActionsRetrieved: number;
      requestedSampleSize: number;
    };
  }) {
    // TODO: all other schemas

    // validate and remove additional properties from member
    const ajv = new Ajv({ removeAdditional: 'all' });

    const validateMember = ajv.compile(memberSchema);
    const validateMembers = ajv.compile({
      type: 'array',
      items: memberSchema,
    });

    validateMembers(args.members);

    validateMember(args.item.creator);

    args.descendants.forEach((i) => validateMember(i.creator));

    args.itemMemberships.forEach((im) => validateMember(im.account));

    args.actions.forEach((a) => validateMember(a.account));

    args.chatMessages.forEach((m) => validateMember(m.creator));

    Object.values(args.apps).forEach(({ actions, data, settings }) => {
      settings.forEach(({ creator }) => {
        validateMember(creator);
      });

      data.forEach(
        ({ account: member, creator }) => validateMember(member) && validateMember(creator),
      );
      actions.forEach(({ account: member }) => validateMember(member));
    });

    this.actions = args.actions;
    this.members = args.members;
    this.item = args.item;
    this.descendants = args.descendants;
    this.metadata = args.metadata;
    this.itemMemberships = args.itemMemberships;
    this.chatMessages = args.chatMessages;
    this.apps = args.apps;
  }
}
