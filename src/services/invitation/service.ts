import { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { DEFAULT_LANG, PermissionLevel } from '@graasp/sdk';
import { MAIL } from '@graasp/translations';

import { Repositories } from '../../util/repositories';
import { validatePermission } from '../authorization';
import ItemService from '../item/service';
import { Member } from '../member/entities/member';
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

  async sendInvitationEmail({ actor, invitation }: { actor: Member; invitation: Invitation }) {
    const { item, email } = invitation;

    // factor out
    const lang = actor.extra.lang ?? DEFAULT_LANG;
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

  async get(actor: Member, repositories: Repositories, invitationId: string) {
    return repositories.invitationRepository.get(invitationId, actor);
  }

  async getForItem(actor: Member, repositories: Repositories, itemId: string) {
    const { invitationRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);
    return invitationRepository.getForItem(item.path);
  }

  async postManyForItem(
    actor: Member,
    repositories: Repositories,
    itemId: string,
    invitations: Partial<Invitation>[],
  ) {
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
    actor: Member,
    repositories: Repositories,
    invitationId: string,
    body: Partial<Invitation>,
  ) {
    const { invitationRepository } = repositories;
    const invitation = await invitationRepository.get(invitationId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, invitation.item);

    return invitationRepository.patch(invitationId, body);
  }

  async delete(actor: Member, repositories: Repositories, invitationId: string) {
    const { invitationRepository } = repositories;
    const invitation = await invitationRepository.get(invitationId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, invitation.item);

    return invitationRepository.deleteOne(invitationId);
  }

  async resend(actor: Member, repositories: Repositories, invitationId: string) {
    const { invitationRepository } = repositories;
    const invitation = await invitationRepository.get(invitationId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, invitation.item);

    this.sendInvitationEmail({ invitation, actor });
  }

  async createToMemberships(actor: Member, repositories: Repositories, member: Member) {
    const { invitationRepository, itemMembershipRepository } = repositories;
    const invitations = await invitationRepository.find({
      where: { email: member.email },
      relations: { item: true },
    });
    const memberships = invitations.map(({ permission, item }) => ({ item, member, permission }));
    await itemMembershipRepository.createMany(memberships);
  }
}
