import { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { DEFAULT_LANG, PermissionLevel } from '@graasp/sdk';
import { MAIL } from '@graasp/translations';

import { UnauthorizedMember } from '../../util/graasp-error';
import { Repositories } from '../../util/repositories';
import { validatePermission } from '../authorization';
import ItemService from '../item/service';
import { Actor, Member } from '../member/entities/member';
import { Invitation } from './invitation';

export class InvitationService {
  log: FastifyBaseLogger;
  fastify: FastifyInstance; // TODO
  buildInvitationLink: any; // TODO
  itemService: ItemService;
  // TODO

  constructor(log, fastify, itemService: ItemService, buildInvitationLink) {
    this.log = log;
    this.fastify = fastify;
    this.itemService = itemService;
    this.buildInvitationLink = buildInvitationLink;
  }

  async sendInvitationEmail({ actor, invitation }: { actor: Actor; invitation: Invitation }) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { item, email } = invitation;

    // factor out
    const lang = actor.lang;
    const link = this.buildInvitationLink(invitation);

    const t = this.fastify.mailer.translate(lang);

    const text = t(MAIL.INVITATION_TEXT, {
      itemName: item.name,
      creatorName: actor.name,
    });
    const html = `
      ${this.fastify.mailer.buildText(text)}
      ${this.fastify.mailer.buildButton(link, t(MAIL.SIGN_UP_BUTTON_TEXT))}
    `;
    const title = t(MAIL.INVITATION_TITLE, { itemName: item.name });
    this.fastify.mailer.sendEmail(title, email, link, html).catch((err) => {
      this.log.warn(err, `mailer failed. invitation link: ${link}`);
    });
  }

  async get(actor: Actor, repositories: Repositories, invitationId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    return repositories.invitationRepository.get(invitationId, actor);
  }

  async getForItem(actor: Actor, repositories: Repositories, itemId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { invitationRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);
    return invitationRepository.getForItem(item.path);
  }

  async postManyForItem(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    invitations: Partial<Invitation>[],
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { invitationRepository } = repositories;
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    const completeInvitations = await invitationRepository.postMany(invitations, itemId, actor);

    // this.log.debug('send invitation mails');
    Object.values(completeInvitations.data).forEach((invitation: Invitation) => {
      // send mail without awaiting

      this.sendInvitationEmail({ actor, invitation });
    });

    return completeInvitations;
  }

  async patch(
    actor: Actor,
    repositories: Repositories,
    invitationId: string,
    body: Partial<Invitation>,
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { invitationRepository } = repositories;
    const invitation = await invitationRepository.get(invitationId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, invitation.item);

    return invitationRepository.patch(invitationId, body);
  }

  async delete(actor: Actor, repositories: Repositories, invitationId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { invitationRepository } = repositories;
    const invitation = await invitationRepository.get(invitationId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, invitation.item);

    return invitationRepository.deleteOne(invitationId);
  }

  async resend(actor: Actor, repositories: Repositories, invitationId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { invitationRepository } = repositories;
    const invitation = await invitationRepository.get(invitationId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, invitation.item);

    this.sendInvitationEmail({ invitation, actor });
  }

  async createToMemberships(actor: Actor, repositories: Repositories, member: Member) {
    // invitations to memberships is triggered on register: no actor available
    const { invitationRepository, itemMembershipRepository } = repositories;
    const invitations = await invitationRepository.find({
      where: { email: member.email },
      relations: { item: true },
    });
    const memberships = invitations.map(({ permission, item }) => ({ item, member, permission }));
    await itemMembershipRepository.createMany(memberships);
  }
}
