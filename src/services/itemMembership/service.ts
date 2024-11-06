import { singleton } from 'tsyringe';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { MailBuilder } from '../../plugins/mailer/builder';
import { MAIL } from '../../plugins/mailer/langs/constants';
import { MailerService } from '../../plugins/mailer/service';
import { PLAYER_HOST } from '../../utils/config';
import {
  CannotDeleteOnlyAdmin,
  CannotModifyGuestItemMembership,
  ItemMembershipNotFound,
} from '../../utils/errors';
import HookManager from '../../utils/hook';
import { Repositories } from '../../utils/repositories';
import { Account } from '../account/entities/account';
import { validatePermission } from '../authorization';
import { Item } from '../item/entities/Item';
import { ItemService } from '../item/service';
import { isGuest } from '../itemLogin/entities/guest';
import { Actor, Member } from '../member/entities/member';
import { ItemMembership } from './entities/ItemMembership';

@singleton()
export class ItemMembershipService {
  private readonly itemService: ItemService;
  private readonly mailerService: MailerService;
  hooks = new HookManager<{
    create: { pre: Partial<ItemMembership>; post: ItemMembership };
    update: { pre: ItemMembership; post: ItemMembership };
    delete: { pre: ItemMembership; post: ItemMembership };
  }>();

  constructor(itemService: ItemService, mailerService: MailerService) {
    this.itemService = itemService;
    this.mailerService = mailerService;
  }

  async _notifyMember(account: Account, member: Member, item: Item): Promise<void> {
    const link = new URL(item.id, PLAYER_HOST.url).toString();

    const mail = new MailBuilder({
      subject: {
        text: MAIL.SHARE_ITEM_TITLE,
        translationVariables: {
          creatorName: account.name,
          itemName: item.name,
        },
      },
      lang: member.lang,
    })
      .addText(MAIL.SHARE_ITEM_TEXT, { itemName: item.name })
      .addButton(MAIL.SHARE_ITEM_BUTTON, link)
      .build();

    await this.mailerService
      .send(mail, member.email)
      .then(() => {
        console.debug('send email on membership creation');
      })
      .catch((err) => {
        console.error(err, `mailerService failed. shared link: ${link}`);
      });
  }

  async getByAccountAndItem(
    { itemMembershipRepository }: Repositories,
    accountId: UUID,
    itemId: UUID,
  ) {
    return await itemMembershipRepository.getByAccountAndItem(accountId, itemId);
  }

  /**
   * Get inherited item memberships for item
   * @param actor user requesting memberships
   * @param repositories
   * @param itemId item to get memberships for
   * @returns item memberships
   */
  async getForItem(actor: Actor, repositories: Repositories, itemId: UUID) {
    const { itemMembershipRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId);
    return await itemMembershipRepository.getForItem(item);
  }

  private async _create(
    account: Account,
    repositories: Repositories,
    item: Item,
    memberId: Member['id'],
    permission: PermissionLevel,
    // membership: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
  ) {
    const { memberRepository, itemMembershipRepository, membershipRequestRepository } =
      repositories;
    const member = await memberRepository.get(memberId);

    await this.hooks.runPreHooks('create', account, repositories, {
      item,
      account: member,
    });

    const result = await itemMembershipRepository.addOne({
      itemPath: item.path,
      accountId: member.id,
      creatorId: account.id,
      permission,
    });

    // Delete corresponding membership request if it exists. If there is not a membership request, it will do nothing.
    await membershipRequestRepository.deleteOne(memberId, item.id);

    await this.hooks.runPostHooks('create', account, repositories, result);

    await this._notifyMember(account, member, item);

    return result;
  }

  async create(
    actor: Account,
    repositories: Repositories,
    membership: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
    throwOnForbiddenPermission?: boolean,
  ) {
    // check memberships
    const item = await this.itemService.get(
      actor,
      repositories,
      membership.itemId,
      PermissionLevel.Admin,
      throwOnForbiddenPermission,
    );

    return this._create(actor, repositories, item, membership.memberId, membership.permission);
  }

  async createMany(
    actor: Account,
    repositories: Repositories,
    memberships: { permission: PermissionLevel; accountId: UUID }[],
    itemId: UUID,
  ) {
    // check memberships
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return Promise.all(
      memberships.map(async ({ accountId, permission }) => {
        return this._create(actor, repositories, item, accountId, permission);
      }),
    );
  }

  async patch(
    actor: Account,
    repositories: Repositories,
    itemMembershipId: string,
    data: { permission: PermissionLevel },
  ) {
    const { itemMembershipRepository } = repositories;
    // check memberships
    const membership = await itemMembershipRepository.get(itemMembershipId);
    if (isGuest(membership.account)) {
      throw new CannotModifyGuestItemMembership();
    }
    await validatePermission(repositories, PermissionLevel.Admin, actor, membership.item);

    await this.hooks.runPreHooks('update', actor, repositories, membership);

    const result = await itemMembershipRepository.updateOne(itemMembershipId, data);

    await this.hooks.runPostHooks('update', actor, repositories, result);

    return result;
  }

  async deleteOne(
    actor: Account,
    repositories: Repositories,
    itemMembershipId: string,
    args: { purgeBelow?: boolean } = { purgeBelow: false },
  ) {
    const { itemMembershipRepository } = repositories;
    // check memberships
    const membership = await itemMembershipRepository.get(itemMembershipId);
    const { item } = membership;
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    // check if last admin, in which case prevent deletion
    const { data: itemIdToMemberships } = await itemMembershipRepository.getForManyItems([item]);
    if (!(item.id in itemIdToMemberships)) {
      throw new ItemMembershipNotFound({ id: itemMembershipId });
    }

    const memberships = itemIdToMemberships[item.id];
    const otherAdminMemberships = memberships.filter(
      (m) => m.id !== itemMembershipId && m.permission === PermissionLevel.Admin,
    );
    if (otherAdminMemberships.length === 0) {
      throw new CannotDeleteOnlyAdmin({ id: item.id });
    }

    await this.hooks.runPreHooks('delete', actor, repositories, membership);

    const result = await itemMembershipRepository.deleteOne(itemMembershipId, {
      purgeBelow: args.purgeBelow,
    });

    await this.hooks.runPostHooks('delete', actor, repositories, result);

    return result;
  }
}
