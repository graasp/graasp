import fastJson from 'fast-json-stringify';

import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Item } from '../../../item/entities/Item';
import { Actor } from '../../entities/member';
import { anonymizeMentionsMessage, anonymizeMessages, anonymizeResults } from './data.utils';
import {
  actionArraySchema,
  appActionArraySchema,
  appDataArraySchema,
  appSettingArraySchema,
  itemArraySchema,
  itemCategoryArraySchema,
  itemFavoriteArraySchema,
  itemLikeArraySchema,
  itemMembershipArraySchema,
  messageArraySchema,
  messageMentionArraySchema,
} from './schemas/schemas';

const getFilteredData = <T>(data: T[], schema: object) => {
  const stringify = fastJson(schema);
  return JSON.parse(stringify(data));
};

export class DataMemberService {
  async getActions(member: Actor, { actionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await actionRepository.getForMemberExport(member.id);
    return getFilteredData(results, actionArraySchema);
  }

  async getAppActions(member: Actor, { appActionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await appActionRepository.getForMemberExport(member.id);
    return getFilteredData(results, appActionArraySchema);
  }

  async getAppData(member: Actor, { appDataRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const appData = await appDataRepository.getForMemberExport(member.id);
    const anonymized = anonymizeResults({
      results: appData,
      exportingActorId: member.id,
      memberIdKey: ['memberId', 'creatorId'],
    });
    return getFilteredData(anonymized, appDataArraySchema);
  }

  async getAppSettings(member: Actor, { appSettingRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await appSettingRepository.getForMemberExport(member.id);
    return getFilteredData(results, appSettingArraySchema);
  }

  async getChatMentions(member: Actor, { mentionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await mentionRepository.getForMemberExport(member.id);
    const anonymized = anonymizeMentionsMessage({ results, exportingActorId: member.id });
    return getFilteredData(anonymized, messageMentionArraySchema);
  }

  async getChatMessages(member: Actor, { chatMessageRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await chatMessageRepository.getForMemberExport(member.id);
    const anonymized = anonymizeMessages({ results, exportingActorId: member.id });
    return getFilteredData(anonymized, messageArraySchema);
  }

  async getItemsMemberShips(member: Actor, { itemMembershipRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const itemMemberShips = await itemMembershipRepository.getForMemberExport(member.id);
    return getFilteredData(itemMemberShips, itemMembershipArraySchema);
  }

  getOwnItemIds(memberItemsOwner: Item[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getItems(member: Actor, { itemRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }
    const results = await itemRepository.getForMemberExport(member.id);
    return getFilteredData(results, itemArraySchema);
  }

  async getItemCategories(member: Actor, { itemCategoryRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }
    const results = await itemCategoryRepository.getForMemberExport(member.id);
    return getFilteredData(results, itemCategoryArraySchema);
  }

  async getItemFavorites(member: Actor, { itemFavoriteRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await itemFavoriteRepository.getForMemberExport(member.id);
    return getFilteredData(results, itemFavoriteArraySchema);
  }

  async getItemLikes(member: Actor, { itemLikeRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    // TODO: check if we should also export the likes created by another member on its items
    // In this case, don't forget to anonymize the id of the other member ?
    // Or should we put the username of the other member who liked the item ?
    const results = await itemLikeRepository.getForMemberExport(member.id);
    return getFilteredData(results, itemLikeArraySchema);
  }
}
