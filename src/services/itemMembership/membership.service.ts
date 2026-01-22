import { singleton } from 'tsyringe';

import { ClientManager, Context, type UUID } from '@graasp/sdk';

import type { DBConnection } from '../../drizzle/db';
import type {
  ItemMembershipRaw,
  ItemMembershipWithItem,
  ItemMembershipWithItemAndAccount,
  ItemRaw,
} from '../../drizzle/types';
import { TRANSLATIONS } from '../../langs/constants';
import { MailBuilder } from '../../plugins/mailer/builder';
import { MailerService } from '../../plugins/mailer/mailer.service';
import {
  AccountType,
  type AuthenticatedUser,
  type MaybeUser,
  type MemberInfo,
  PermissionLevel,
} from '../../types';
import { CannotDeleteOnlyAdmin, CannotModifyGuestItemMembership } from '../../utils/errors';
import HookManager from '../../utils/hook';
import { AuthorizedItemService } from '../authorizedItem.service';
import { MemberRepository } from '../member/member.repository';
import { ItemMembershipRepository } from './membership.repository';
import { MembershipRequestRepository } from './plugins/MembershipRequest/membershipRequest.repository';

@singleton()
export class ItemMembershipService {
  private readonly mailerService: MailerService;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly memberRepository: MemberRepository;
  private readonly membershipRequestRepository: MembershipRequestRepository;

  hooks = new HookManager<{
    create: { pre: Partial<ItemMembershipRaw>; post: ItemMembershipRaw };
    update: {
      pre: ItemMembershipWithItemAndAccount;
      post: ItemMembershipWithItem;
    };
    delete: { pre: ItemMembershipWithItemAndAccount; post: ItemMembershipWithItem };
  }>();

  constructor(
    mailerService: MailerService,
    itemMembershipRepository: ItemMembershipRepository,
    authorizedItemService: AuthorizedItemService,
    memberRepository: MemberRepository,
    membershipRequestRepository: MembershipRequestRepository,
  ) {
    this.mailerService = mailerService;
    this.itemMembershipRepository = itemMembershipRepository;
    this.memberRepository = memberRepository;
    this.authorizedItemService = authorizedItemService;
    this.membershipRequestRepository = membershipRequestRepository;
  }

  async _notifyMember(account: { name: string }, member: MemberInfo, item: ItemRaw): Promise<void> {
    const link = ClientManager.getInstance().getItemLink(Context.Player, item.id);

    const mail = new MailBuilder({
      subject: {
        text: TRANSLATIONS.SHARE_ITEM_TITLE,
        translationVariables: {
          creatorName: account.name,
          itemName: item.name,
        },
      },
      lang: member.lang,
    })
      .addText(TRANSLATIONS.SHARE_ITEM_TEXT, { itemName: item.name })
      .addButton(TRANSLATIONS.SHARE_ITEM_BUTTON, link)
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

  async hasMembershipOnItem(dbConnection: DBConnection, accountId: UUID, itemId: UUID) {
    return await this.itemMembershipRepository.hasMembershipOnItem(dbConnection, accountId, itemId);
  }

  async getForItem(dbConnection: DBConnection, maybeUser: MaybeUser, itemId: ItemRaw['id']) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });
    const result = await this.itemMembershipRepository.getForItem(dbConnection, item);

    return result;
  }

  private async _create(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    item: ItemRaw,
    memberId: string,
    permission: PermissionLevel,
  ) {
    const member = await this.memberRepository.get(dbConnection, memberId);

    const result = await this.itemMembershipRepository.addOne(dbConnection, {
      itemPath: item.path,
      accountId: member.id,
      creatorId: account?.id,
      permission,
    });

    // Delete corresponding membership request if it exists. If there is not a membership request, it will do nothing.
    await this.membershipRequestRepository.deleteOne(dbConnection, memberId, item.id);

    await this.hooks.runPostHooks('create', account, dbConnection, result);

    await this._notifyMember(account, member.toMemberInfo(), item);

    return result;
  }

  async create(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    membership: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
  ) {
    // check memberships
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: authenticatedUser.id,
      itemId: membership.itemId,
      permission: 'admin',
    });

    return this._create(
      dbConnection,
      authenticatedUser,
      item,
      membership.memberId,
      membership.permission,
    );
  }

  async createMany(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    memberships: { permission: PermissionLevel; accountId: UUID }[],
    itemId: UUID,
  ) {
    // check memberships
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: authenticatedUser.id,
      itemId,
      permission: 'admin',
    });

    return Promise.all(
      memberships.map(async ({ accountId, permission }) => {
        return this._create(dbConnection, authenticatedUser, item, accountId, permission);
      }),
    );
  }

  async patch(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemMembershipId: string,
    data: { permission: PermissionLevel },
  ) {
    // check memberships
    const membership = await this.itemMembershipRepository.get(dbConnection, itemMembershipId);
    if (membership.account.type === AccountType.Guest) {
      throw new CannotModifyGuestItemMembership();
    }
    await this.authorizedItemService.assertAccess(dbConnection, {
      permission: 'admin',
      accountId: authenticatedUser.id,
      item: membership.item,
    });

    await this.hooks.runPreHooks('update', authenticatedUser, dbConnection, membership);

    const result = await this.itemMembershipRepository.updateOne(
      dbConnection,
      itemMembershipId,
      data,
    );

    await this.hooks.runPostHooks('update', authenticatedUser, dbConnection, result);

    return result;
  }

  async deleteOne(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemMembershipId: string,
    args: { purgeBelow?: boolean } = { purgeBelow: false },
  ) {
    // check memberships
    const membership = await this.itemMembershipRepository.get(dbConnection, itemMembershipId);
    const { item } = membership;
    await this.authorizedItemService.assertAccess(dbConnection, {
      permission: 'admin',
      accountId: account.id,
      item,
    });

    // check if last admin, in which case prevent deletion
    const memberships = await this.itemMembershipRepository.getForItem(dbConnection, item);

    const otherAdminMemberships = memberships.filter(
      (m) => m.id !== itemMembershipId && m.permission === 'admin',
    );
    if (otherAdminMemberships.length === 0) {
      throw new CannotDeleteOnlyAdmin({ id: item.id });
    }

    await this.hooks.runPreHooks('delete', account, dbConnection, membership);

    await this.itemMembershipRepository.deleteOne(dbConnection, itemMembershipId, {
      purgeBelow: args.purgeBelow,
    });

    await this.hooks.runPostHooks('delete', account, dbConnection, membership);
  }
}
