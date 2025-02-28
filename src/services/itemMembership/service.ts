import { singleton } from 'tsyringe';

import { ClientManager, Context, PermissionLevel, UUID } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { Account, Item, ItemMembership, Member } from '../../drizzle/schema';
import { TRANSLATIONS } from '../../langs/constants';
import { MailBuilder } from '../../plugins/mailer/builder';
import { MailerService } from '../../plugins/mailer/mailer.service';
import {
  CannotDeleteOnlyAdmin,
  CannotModifyGuestItemMembership,
  ItemMembershipNotFound,
} from '../../utils/errors';
import HookManager from '../../utils/hook';
import { AuthorizationService } from '../authorization';
import { ItemService } from '../item/service';
import { isGuest } from '../itemLogin/entities/guest';
import { Actor } from '../member/entities/member';
import { MemberRepository } from '../member/repository';
import { ItemMembershipRepository } from './repository';

@singleton()
export class ItemMembershipService {
  private readonly itemService: ItemService;
  private readonly mailerService: MailerService;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly authorizationService: AuthorizationService;
  private readonly memberRepository: MemberRepository;

  hooks = new HookManager<{
    create: { pre: Partial<ItemMembership>; post: ItemMembership };
    update: { pre: ItemMembership; post: ItemMembership };
    delete: { pre: ItemMembership; post: ItemMembership };
  }>();

  constructor(
    itemService: ItemService,
    mailerService: MailerService,
    itemMembershipRepository: ItemMembershipRepository,
    authorizationService: AuthorizationService,
    memberRepository: MemberRepository,
  ) {
    this.itemService = itemService;
    this.mailerService = mailerService;
    this.itemMembershipRepository = itemMembershipRepository;
    this.memberRepository = memberRepository;
    this.authorizationService = authorizationService;
  }

  async _notifyMember(account: Account, member: Member, item: Item): Promise<void> {
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

  async getForManyItems(db: DBConnection, actor: Actor, itemIds: string[]) {
    // get memberships, containing item

    const items = await this.itemService.getMany(db, actor, itemIds);
    const result = await this.itemMembershipRepository.getForManyItems(
      db,
      Object.values(items.data),
    );

    return { data: result.data, errors: [...items.errors, ...result.errors] };
  }

  private async _create(
    db: DBConnection,
    account: Account,
    item: Item,
    memberId: Member['id'],
    permission: PermissionLevel,
    // membership: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
  ) {
    const member = await this.memberRepository.get(db, memberId);

    await this.hooks.runPreHooks('create', account, db, {
      item,
      account: member,
    });

    const result = await this.itemMembershipRepository.addOne(db, {
      itemPath: item.path,
      accountId: member.id,
      creatorId: account.id,
      permission,
    });

    // Delete corresponding membership request if it exists. If there is not a membership request, it will do nothing.
    await this.membershipRequestRepository.deleteOne(db, memberId, item.id);

    await this.hooks.runPostHooks('create', account, db, result);

    await this._notifyMember(account, member, item);

    return result;
  }

  async create(
    db: DBConnection,
    actor: Account,
    membership: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
  ) {
    // check memberships
    const item = await this.itemService.get(db, actor, membership.itemId, PermissionLevel.Admin);

    return this._create(db, actor, item, membership.memberId, membership.permission);
  }

  async createMany(
    db: DBConnection,
    actor: Account,
    memberships: { permission: PermissionLevel; accountId: UUID }[],
    itemId: UUID,
  ) {
    // check memberships
    const item = await this.itemService.get(db, actor, itemId, PermissionLevel.Admin);

    return Promise.all(
      memberships.map(async ({ accountId, permission }) => {
        return this._create(db, actor, item, accountId, permission);
      }),
    );
  }

  async patch(
    db: DBConnection,
    actor: Account,
    itemMembershipId: string,
    data: { permission: PermissionLevel },
  ) {
    // check memberships
    const membership = await this.itemMembershipRepository.get(db, itemMembershipId);
    if (isGuest(membership.account)) {
      throw new CannotModifyGuestItemMembership();
    }
    await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Admin,
      actor,
      membership.item,
    );

    await this.hooks.runPreHooks('update', actor, db, membership);

    const result = await this.itemMembershipRepository.updateOne(db, itemMembershipId, data);

    await this.hooks.runPostHooks('update', actor, db, result);

    return result;
  }

  async deleteOne(
    db: DBConnection,
    actor: Account,
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
