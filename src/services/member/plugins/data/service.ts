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

    return await actionRepository.getForMember(member.id);
  }

  async getAppActions(member: Actor, { appActionRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    return appActionRepository.getForMember(member.id);
  }

  async getAppData(member: Actor, { appDataRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const appData = await appDataRepository.getForMember(member.id);
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

    return appSettingRepository.getForMember(member.id);
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

  async getBookMarks(member: Actor, { itemFavoriteRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }
    // TODO: limit by foreign key id ?
    return await itemFavoriteRepository.getFavoriteForMember(member.id);
  }

  async getItemLikes(member: Actor, { itemLikeRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    // only own items
    // TODO: allow to get other's like?
    // TODO: remove joins !
    return itemLikeRepository.getForMember(member.id);
  }

  async getItemsMemberShips(member: Actor, { itemMembershipRepository }: Repositories) {
    // TODO: check if items are required in memberships

    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const itemMemberShips = await itemMembershipRepository.getForMember(member.id);
    // TODO: anonymize none member data !
    const filtered = itemMemberShips.map((im) => im);
    return filtered;
  }

  getOwnItemIds(memberItemsOwner: Item[]) {
    return memberItemsOwner.map((item) => item.id);
  }

  async getOwnItems(member: Actor, { itemRepository }: Repositories) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }
    return itemRepository.getCreatedBy(member.id);
  }
}
