import { singleton } from 'tsyringe';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { MAIL } from '../../plugins/mailer/langs/constants';
import { MailerService } from '../../plugins/mailer/service';
import { PLAYER_HOST } from '../../utils/config';
import { CannotDeleteOnlyAdmin, ItemMembershipNotFound } from '../../utils/errors';
import HookManager from '../../utils/hook';
import { Repositories } from '../../utils/repositories';
import { validatePermission } from '../authorization';
import { Item } from '../item/entities/Item';
import { ItemService } from '../item/service';
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

  async _notifyMember(
    actor: Member,
    repositories: Repositories,
    member: Member,
    item: Item,
  ): Promise<void> {
    const link = new URL(item.id, PLAYER_HOST.url).toString();

    const lang = member.lang;
    const t = this.mailerService.translate(lang);

    const text = t(MAIL.SHARE_ITEM_TEXT, { itemName: item.name });
    const html = `
        ${this.mailerService.buildText(text)}
        ${this.mailerService.buildButton(link, t(MAIL.SHARE_ITEM_BUTTON))}
      `;

    const title = t(MAIL.SHARE_ITEM_TITLE, { creatorName: actor.name, itemName: item.name });

    const footer = this.mailerService.buildFooter(lang);

    await this.mailerService
      .sendEmail(title, member.email, link, html, footer)
      .then(() => {
        console.debug('send email on membership creation');
      })
      .catch((err) => {
        console.error(err, `mailerService failed. shared link: ${link}`);
      });
  }

  async get(actor: Actor, repositories: Repositories, id: string) {
    const { itemMembershipRepository } = repositories;

    const membership = await itemMembershipRepository.get(id);

    // check rights
    await validatePermission(repositories, PermissionLevel.Read, actor, membership.item);
    return membership;
  }

  async getMany(actor: Actor, repositories: Repositories, ids: string[]) {
    const { itemMembershipRepository } = repositories;
    // TODO: optimize? groupby item?
    // check memberships for all diff items
    const { data, errors } = await itemMembershipRepository.getMany(ids);
    await Promise.all(
      Object.values(data).map(async ({ id, item }) => {
        try {
          await validatePermission(repositories, PermissionLevel.Read, actor, item);
        } catch (e) {
          // if does not have permission, remove data and add error
          delete data[id];
          errors.push(e as Error);
        }
      }),
    );

    return { data, errors };
  }

  async getForManyItems(actor: Actor, repositories: Repositories, itemIds: string[]) {
    // get memberships, containing item

    const { itemMembershipRepository } = repositories;

    const items = await this.itemService.getMany(actor, repositories, itemIds);
    const result = await itemMembershipRepository.getForManyItems(Object.values(items.data));

    return { data: result.data, errors: [...items.errors, ...result.errors] };
  }

  async _post(
    actor: Member,
    repositories: Repositories,
    item: Item,
    memberId: Member['id'],
    permission: PermissionLevel,
    // membership: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
  ) {
    const { memberRepository, itemMembershipRepository } = repositories;
    const member = await memberRepository.get(memberId);

    await this.hooks.runPreHooks('create', actor, repositories, { item, member });

    const result = await itemMembershipRepository.post({
      item,
      member,
      creator: actor,
      permission,
    });

    await this.hooks.runPostHooks('create', actor, repositories, result);

    await this._notifyMember(actor, repositories, member, item);

    return result;
  }

  async post(
    actor: Member,
    repositories: Repositories,
    membership: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
  ) {
    // check memberships
    const item = await this.itemService.get(
      actor,
      repositories,
      membership.itemId,
      PermissionLevel.Admin,
    );

    return this._post(actor, repositories, item, membership.memberId, membership.permission);
  }

  async postMany(
    actor: Member,
    repositories: Repositories,
    memberships: { permission: PermissionLevel; memberId: UUID }[],
    itemId: UUID,
  ) {
    // check memberships
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return Promise.all(
      memberships.map(async ({ memberId, permission }) => {
        return this._post(actor, repositories, item, memberId, permission);
      }),
    );
  }

  async patch(
    actor: Member,
    repositories: Repositories,
    itemMembershipId: string,
    data: { permission: PermissionLevel },
  ) {
    const { itemMembershipRepository } = repositories;
    // check memberships
    const membership = await itemMembershipRepository.get(itemMembershipId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, membership.item);

    await this.hooks.runPreHooks('update', actor, repositories, membership);

    const result = await itemMembershipRepository.patch(itemMembershipId, data);

    await this.hooks.runPostHooks('update', actor, repositories, result);

    return result;
  }

  async deleteOne(
    actor: Member,
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
      throw new CannotDeleteOnlyAdmin(item.id);
    }

    await this.hooks.runPreHooks('delete', actor, repositories, membership);

    const result = await itemMembershipRepository.deleteOne(itemMembershipId, {
      purgeBelow: args.purgeBelow,
    });

    await this.hooks.runPostHooks('delete', actor, repositories, result);

    return result;
  }
}
