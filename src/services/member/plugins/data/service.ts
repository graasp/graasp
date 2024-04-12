import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Item } from '../../../item/entities/Item';
import { Actor } from '../../entities/member';
import { anonymizeMessage, anonymizeResults } from './data.utils';

export class DataMemberService {
  async getActions(member: Actor, { actionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    return await actionRepository.getForMemberExport(member.id);
  }

  async getAppActions(member: Actor, { appActionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    return appActionRepository.getForMemberExport(member.id);
  }

  async getAppData(member: Actor, { appDataRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const appData = await appDataRepository.getForMemberExport(member.id);
    return anonymizeResults({
      results: appData,
      exportingActorId: member.id,
      memberIdKey: ['memberId', 'creatorId'],
    });
  }

  async getAppSettings(member: Actor, { appSettingRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    return appSettingRepository.getForMemberExport(member.id);
  }

  async getChatMentions(member: Actor, { mentionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    return mentionRepository.getForMemberExport(member.id);
  }

  async getChatMessages(member: Actor, { chatMessageRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const results = await chatMessageRepository.getForMemberExport(member.id);
    return anonymizeMessage({ results, exportingActorId: member.id });
  }

  async getItemsMemberShips(member: Actor, { itemMembershipRepository }: Repositories) {
    // TODO: check if items are required in memberships

    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const itemMemberShips = await itemMembershipRepository.getForMemberExport(member.id);
    // TODO: anonymize none member data !
    const filtered = itemMemberShips.map((im) => im);
    return filtered;
  }

  getOwnItemIds(memberItemsOwner: Item[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getItems(member: Actor, { itemRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }
    return itemRepository.getForMemberExport(member.id);
  }

  async getItemCategories(member: Actor, { itemCategoryRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }
    return itemCategoryRepository.getForMemberExport(member.id);
  }

  async getItemFavorites(member: Actor, { itemFavoriteRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    return await itemFavoriteRepository.getForMemberExport(member.id);
  }

  async getItemLikes(member: Actor, { itemLikeRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    // TODO: check if we should also export the likes created by another member on its items
    // In this case, don't forget to anonymize the id of the other member ?
    // Or should we put the username of the other member who liked the item ?
    return itemLikeRepository.getForMemberExport(member.id);
  }
}
