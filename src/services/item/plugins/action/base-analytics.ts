import { Ajv } from 'ajv';

import { UUID } from '@graasp/sdk';

import { Action } from '../../../action/entities/action';
import { ChatMessage } from '../../../chat/chatMessage';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { AppAction } from '../app/appAction/appAction';
import { AppData } from '../app/appData/appData';
import { AppSetting } from '../app/appSetting/appSettings';
import { memberSchema, memberSchemaForAnalytics } from './schemas';

export class BaseAnalytics {
  readonly actions: Action[];
  readonly members: Member[];
  readonly itemMemberships: ItemMembership[];
  readonly descendants: Item[];
  readonly item: Item;
  readonly apps: {
    [key: UUID]: {
      data: AppData[];
      settings: AppSetting[];
      actions: AppAction[];
    };
  };
  readonly chatMessages: ChatMessage[];
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
    chatMessages: ChatMessage[];
    apps: {
      [key: UUID]: {
        data: AppData[];
        settings: AppSetting[];
        actions: AppAction[];
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
    const validateMembers = ajv.compile(memberSchemaForAnalytics);
    validateMembers(args.members);

    validateMember(args.item.creator);

    args.descendants.forEach((i) => validateMember(i.creator));

    args.itemMemberships.forEach((im) => validateMember(im.member));

    args.actions.forEach((a) => validateMember(a.member));

    args.chatMessages.forEach((m) => validateMember(m.creator));

    Object.values(args.apps).forEach(({ actions, data, settings }) => {
      settings.forEach(({ creator }) => {
        validateMember(creator);
      });

      data.forEach(({ member, creator }) => validateMember(member) && validateMember(creator));
      actions.forEach(({ member }) => validateMember(member));
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
