import { singleton } from 'tsyringe';

import { ClientManager, Context, PermissionLevel, UUID } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import {
  Item,
  ItemMembershipRaw,
  ItemMembershipWithItem,
  ItemMembershipWithItemAndAccount,
  ItemRaw,
} from '../../drizzle/types';
import { TRANSLATIONS } from '../../langs/constants';
import { MailBuilder } from '../../plugins/mailer/builder';
import { MailerService } from '../../plugins/mailer/mailer.service';
import { AccountType, AuthenticatedUser, MaybeUser, MemberInfo } from '../../types';
import {
  CannotDeleteOnlyAdmin,
  CannotModifyGuestItemMembership,
  ItemMembershipNotFound,
} from '../../utils/errors';
import HookManager from '../../utils/hook';
import { AuthorizationService } from '../authorization';
import { ItemService } from '../item/service';
import { MemberRepository } from '../member/repository';
import { MembershipRequestRepository } from './plugins/MembershipRequest/repository';
import { ItemMembershipRepository } from './repository';

@singleton()
export class ItemMembershipService {
  private readonly itemService: ItemService;
  private readonly mailerService: MailerService;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly authorizationService: AuthorizationService;
  private readonly memberRepository: MemberRepository;
  private readonly membershipRequestRepository: MembershipRequestRepository;

  hooks = new HookManager<{
    create: { pre: Partial<ItemMembershipRaw>; post: ItemMembershipRaw };
    update: {
      pre: ItemMembershipWithItemAndAccount;
      post: ItemMembershipWithItem;
    };
    delete: { pre: ItemMembershipWithItemAndAccount; post: ItemMembershipRaw };
  }>();

  constructor(
    itemService: ItemService,
    mailerService: MailerService,
    itemMembershipRepository: ItemMembershipRepository,
    authorizationService: AuthorizationService,
    memberRepository: MemberRepository,
    membershipRequestRepository: MembershipRequestRepository,
  ) {
    this.itemService = itemService;
    this.mailerService = mailerService;
    this.itemMembershipRepository = itemMembershipRepository;
    this.memberRepository = memberRepository;
    this.authorizationService = authorizationService;
    this.membershipRequestRepository = membershipRequestRepository;
  }

  async _notifyMember(account: { name: string }, member: MemberInfo, item: Item): Promise<void> {
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

  async hasMembershipOnItem(db: DBConnection, accountId: UUID, itemId: UUID) {
    return await this.itemMembershipRepository.hasMembershipOnItem(db, accountId, itemId);
  }

  async getForManyItems(db: DBConnection, maybeUser: MaybeUser, itemIds: string[]) {
    // get memberships, containing item

    const items = await this.itemService.getMany(db, maybeUser, itemIds);
    const result = await this.itemMembershipRepository.getForManyItems(
      db,
      Object.values(items.data),
    );

    return { data: result.data, errors: [...items.errors, ...result.errors] };
  }

  private async _create(
    db: DBConnection,
    account: AuthenticatedUser,
    item: ItemRaw,
    memberId: string,
    permission: PermissionLevel,
    // membership: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
  ) {
    const member = await this.memberRepository.get(db, memberId);

    // TODO: ensure there are not hooks setup and remove it!
    await this.hooks.runPreHooks('create', account, db, {});

    const result = await this.itemMembershipRepository.addOne(db, {
      itemPath: item.path,
      accountId: member.id,
      creatorId: account?.id,
      permission,
    });

    // Delete corresponding membership request if it exists. If there is not a membership request, it will do nothing.
    await this.membershipRequestRepository.deleteOne(db, memberId, item.id);

    await this.hooks.runPostHooks('create', account, db, result);

    await this._notifyMember(account, member.toMemberInfo(), item);

    return result;
  }

  async create(
    db: DBConnection,
    actor: AuthenticatedUser,
    membership: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
  ) {
    // check memberships
    const item = await this.itemService.get(db, actor, membership.itemId, PermissionLevel.Admin);

    return this._create(db, actor, item, membership.memberId, membership.permission);
  }

  async createMany(
    db: DBConnection,
    authenticatedUser: AuthenticatedUser,
    memberships: { permission: PermissionLevel; accountId: UUID }[],
    itemId: UUID,
  ) {
    // check memberships
    const item = await this.itemService.get(db, authenticatedUser, itemId, PermissionLevel.Admin);

    return Promise.all(
      memberships.map(async ({ accountId, permission }) => {
        return this._create(db, authenticatedUser, item, accountId, permission);
      }),
    );
  }

  async patch(
    db: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemMembershipId: string,
    data: { permission: PermissionLevel },
  ) {
    // check memberships
    const membership = await this.itemMembershipRepository.get(db, itemMembershipId);
    if (membership.account.type === AccountType.Guest) {
      throw new CannotModifyGuestItemMembership();
    }
    await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Admin,
      authenticatedUser,
      membership.item,
    );

    await this.hooks.runPreHooks('update', authenticatedUser, db, membership);

    const result = await this.itemMembershipRepository.updateOne(db, itemMembershipId, data);

    await this.hooks.runPostHooks('update', authenticatedUser, db, result);

    return result;
  }

  async deleteOne(
    db: DBConnection,
    actor: AuthenticatedUser,
    itemMembershipId: string,
    args: { purgeBelow?: boolean } = { purgeBelow: false },
  ) {
    // check memberships
    const membership = await this.itemMembershipRepository.get(db, itemMembershipId);
    const { item } = membership;
    await this.authorizationService.validatePermission(db, PermissionLevel.Admin, actor, item);

    // check if last admin, in which case prevent deletion
    const { data: itemIdToMemberships } = await this.itemMembershipRepository.getForManyItems(db, [
      item,
    ]);
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

    await this.hooks.runPreHooks('delete', actor, db, membership);

    const result = await this.itemMembershipRepository.deleteOne(db, itemMembershipId, {
      purgeBelow: args.purgeBelow,
    });

    await this.hooks.runPostHooks('delete', actor, db, result);

    return result;
  }
}
