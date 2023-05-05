import { Hostname, PermissionLevel, UUID } from '@graasp/sdk';
import { MAIL } from '@graasp/translations';

import { MailerDecoration } from '../../plugins/mailer';
import { UnauthorizedMember } from '../../utils/errors';
import { Repositories } from '../../utils/repositories';
import { validatePermission } from '../authorization';
import { Item } from '../item/entities/Item';
import ItemService from '../item/service';
import { Actor, Member } from '../member/entities/member';
import { buildItemLink } from '../utils';

export class ItemMembershipService {
  itemService: ItemService;
  hosts: Hostname[];
  mailer: MailerDecoration;

  constructor(itemService: ItemService, hosts: Hostname[], mailer: MailerDecoration) {
    this.itemService = itemService;
    this.hosts = hosts;
    this.mailer = mailer;
  }

  async _notifyMember(
    actor: Member,
    repositories: Repositories,
    member: Member,
    item: Item,
  ): Promise<void> {
    const link = buildItemLink(this.hosts, item);

    const lang = member.lang;
    const t = this.mailer.translate(lang);

    const text = t(MAIL.SHARE_ITEM_TEXT, { itemName: item.name });
    const html = `
        ${this.mailer.buildText(text)}
        ${this.mailer.buildButton(link, t(MAIL.SHARE_ITEM_BUTTON))}
      `;

    const title = t(MAIL.SHARE_ITEM_TITLE, { itemName: item.name });
    await this.mailer.sendEmail(title, member.email, link, html).catch((err) => {
      console.error(err, `mailer failed. shared link: ${link}`);
    });
  }

  async create(
    actor: Actor,
    repositories: Repositories,
    im: { permission: PermissionLevel; itemId: string; memberId: string },
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { memberRepository, itemMembershipRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, im.itemId, PermissionLevel.Admin);
    const member = await memberRepository.findOneByOrFail({ id: im.memberId });

    const result = await itemMembershipRepository.post({
      item,
      member,
      permission: im.permission,
      creator: actor,
    });

    await this._notifyMember(actor, repositories, member, item);

    return result;
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
          delete data.data[id];
          errors.push(e);
        }
      }),
    );

    return { data, errors };
  }

  async getForManyItems(actor: Actor, repositories: Repositories, itemIds: string[]) {
    // get memberships, containing item

    const { itemMembershipRepository } = repositories;

    const items = await this.itemService.getMany(actor, repositories, itemIds);

    const result=await itemMembershipRepository.getForManyItems(Object.values(items.data));
  return {data:result.data, errors:[...items.errors, ...result.errors]};
  }

  async post(
    actor: Actor,
    repositories: Repositories,
    { permission, itemId, memberId }: { permission: PermissionLevel; itemId: UUID; memberId: UUID },
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { memberRepository, itemMembershipRepository, itemRepository } = repositories;
    // check memberships
    const member = await memberRepository.get(memberId);
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return itemMembershipRepository.post({ item, member, creator: actor, permission });
  }

  async postMany(
    actor: Actor,
    repositories: Repositories,
    memberships: { permission: PermissionLevel; memberId: UUID }[],
    itemId: UUID,
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { memberRepository, itemMembershipRepository, itemRepository } = repositories;
    // check memberships
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return Promise.all(
      memberships.map(async ({ memberId, permission }) => {
        const member = await memberRepository.get(memberId);
        return itemMembershipRepository.post({ item, member, creator: actor, permission });
      }),
    );
  }

  async patch(
    actor: Actor,
    repositories: Repositories,
    itemMembershipId: string,
    data: { permission: PermissionLevel },
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemMembershipRepository } = repositories;
    // check memberships
    const iM = await itemMembershipRepository.get(itemMembershipId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, iM.item);

    return itemMembershipRepository.patch(itemMembershipId, data);
  }

  async deleteOne(
    actor: Actor,
    repositories: Repositories,
    itemMembershipId: string,
    args: { purgeBelow?: boolean } = { purgeBelow: false },
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemMembershipRepository } = repositories;
    // check memberships
    const { item } = await itemMembershipRepository.get(itemMembershipId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return itemMembershipRepository.deleteOne(itemMembershipId, { purgeBelow: args.purgeBelow });
  }
}

export default ItemMembershipService;
