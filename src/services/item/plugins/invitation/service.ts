import groupby from 'lodash.groupby';

import { MultipartFile } from '@fastify/multipart';
import { FastifyBaseLogger } from 'fastify';

import { ItemType, PermissionLevel } from '@graasp/sdk';

import type { MailerDecoration } from '../../../../plugins/mailer';
import { MAIL } from '../../../../plugins/mailer/langs/constants';
import { GRAASP_LANDING_PAGE_ORIGIN } from '../../../../utils/constants';
import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { Item, isItemType } from '../../../item/entities/Item';
import ItemService from '../../../item/service';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import ItemMembershipService from '../../../itemMembership/service';
import { Actor, Member } from '../../../member/entities/member';
import { MemberService } from '../../../member/service';
import { EMAIL_COLUMN_NAME, GROUP_COL_NAME, buildInvitationLink } from './constants';
import { Invitation } from './entity';
import {
  CantCreateStructureInNoFolderItem,
  MissingEmailColumnInCSVError,
  MissingEmailInRowError,
  MissingGroupColumnInCSVError,
  MissingGroupInRowError,
  NoDataInFile,
  TemplateItemDoesNotExist,
} from './errors';
import { CSVInvite, parseCSV, verifyCSVFileFormat } from './utils';

export class InvitationService {
  log: FastifyBaseLogger;
  mailer: MailerDecoration;
  itemService: ItemService;
  memberService: MemberService;
  itemMembershipService: ItemMembershipService;

  constructor(
    log,
    mailer,
    itemService: ItemService,
    memberService: MemberService,
    itemMembershipService: ItemMembershipService,
  ) {
    this.log = log;
    this.mailer = mailer;
    this.itemService = itemService;
    this.memberService = memberService;
    this.itemMembershipService = itemMembershipService;
  }

  async sendInvitationEmail({ actor, invitation }: { actor: Actor; invitation: Invitation }) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { item, email } = invitation;

    // factor out
    const lang = actor.lang;
    const link = buildInvitationLink(invitation);

    const t = this.mailer.translate(lang);

    const text = t(MAIL.INVITATION_TEXT, {
      itemName: item.name,
      creatorName: actor.name,
    });
    const html = `
      ${this.mailer.buildText(text)}
      ${this.mailer.buildButton(link, t(MAIL.SIGN_UP_BUTTON_TEXT))}
      ${this.mailer.buildText(
        t(MAIL.USER_AGREEMENTS_MAIL_TEXT, {
          signUpButtonText: t(MAIL.SIGN_UP_BUTTON_TEXT),
          graaspLandingPageOrigin: GRAASP_LANDING_PAGE_ORIGIN,
        }),
        // Add margin top of -15px to remove 15px margin bottom of the button.
        { 'text-align': 'center', 'font-size': '10px', 'margin-top': '-15px' },
      )}
    `;
    const title = t(MAIL.INVITATION_TITLE, {
      itemName: item.name,
    });

    const footer = this.mailer.buildFooter(lang);

    this.mailer.sendEmail(title, email, link, html, footer).catch((err) => {
      this.log.warn(err, `mailer failed. invitation link: ${link}`);
    });
  }

  async get(actor: Actor, repositories: Repositories, invitationId: string) {
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
  ): Promise<Invitation[]> {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { invitationRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    const completeInvitations = await invitationRepository.postMany(invitations, item.path, actor);

    this.log.debug('send invitation mails');
    completeInvitations.forEach((invitation: Invitation) => {
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
      where: { email: member.email.toLowerCase() },
      relations: { item: true },
    });
    const memberships = invitations.map(({ permission, item }) => ({ item, member, permission }));
    await itemMembershipRepository.createMany(memberships);
  }

  async _partitionExistingUsersAndNewUsers(
    actor: Actor,
    repositories: Repositories,
    emailList: string[],
  ): Promise<{ existingAccounts: Member[]; newAccounts: string[] }> {
    const { data: accounts } = await this.memberService.getManyByEmail(
      actor,
      repositories,
      emailList,
    );
    const existingAccounts = Object.values(accounts);
    const existingAccountsEmails = Object.keys(accounts);
    const newAccounts = emailList.filter((email) => !existingAccountsEmails.includes(email));
    return { existingAccounts, newAccounts };
  }

  async _createMembershipsAndInvitationsForUserList(
    actor: Member,
    repositories: Repositories,
    rows: CSVInvite[],
    itemId: Item['id'],
  ) {
    // partition between emails that are already accounts and emails without accounts
    const { existingAccounts, newAccounts } = await this._partitionExistingUsersAndNewUsers(
      actor,
      repositories,
      rows.map((r) => r.email),
    );

    // generate memberships to create
    const membershipsToCreate = existingAccounts.map((account) => {
      const permission =
        // get the permission from the data, if it is not found or if it is an empty string, default to read
        rows.find((r) => r.email === account.email)?.permission || PermissionLevel.Read;
      return { permission, memberId: account.id };
    });
    this.log.debug(membershipsToCreate, 'memberships to create');

    // create memberships for accounts that already exist
    const memberships = await this.itemMembershipService.postMany(
      actor,
      repositories,
      membershipsToCreate,
      itemId,
    );

    // generate invitations to create
    const invitationsToCreate = newAccounts.map((email) => {
      // get the permission from the data, if it is not found or if it is an empty string, default to read
      const permission = rows.find((r) => r.email === email)?.permission || PermissionLevel.Read;
      return { email, permission };
    });
    this.log.debug(invitationsToCreate, 'invitations to create');

    // create invitations for accounts that do not exist yet
    const invitations = await this.postManyForItem(
      actor,
      repositories,
      itemId,
      invitationsToCreate,
    );

    return { memberships, invitations };
  }

  async importUsersWithCSV(
    actor: Member,
    repositories: Repositories,
    itemId: Item['id'],
    file: MultipartFile,
  ): Promise<{ memberships: ItemMembership[]; invitations: Invitation[] }> {
    // verify file is CSV
    verifyCSVFileFormat(file);

    // get the item, verify user has Admin access
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    // parse CSV file
    const { rows, header } = await parseCSV(file.file);

    // check that file has data
    if (rows.length === 0) {
      throw new NoDataInFile();
    }

    // check that the email column has been detected
    if (!header.includes(EMAIL_COLUMN_NAME)) {
      throw new MissingEmailColumnInCSVError();
    }

    // check that all rows have an email set
    if (rows.some((r) => !r.email)) {
      throw new MissingEmailInRowError();
    }

    return this._createMembershipsAndInvitationsForUserList(actor, repositories, rows, itemId);
  }

  async createStructureForCSVAndTemplate(
    actor: Member,
    repositories: Repositories,
    parentId: string,
    templateId: string,
    file: MultipartFile,
  ): Promise<
    {
      groupName: string;
      memberships: ItemMembership[];
      invitations: Invitation[];
    }[]
  > {
    // verify file is CSV
    verifyCSVFileFormat(file);

    // get parentItem
    const parentItem = await this.itemService.get(
      actor,
      repositories,
      parentId,
      PermissionLevel.Admin,
    );

    // check that the template exists
    const templateItem = await this.itemService.get(actor, repositories, templateId);
    if (!templateItem.id) {
      throw new TemplateItemDoesNotExist();
    }

    // parse CSV file
    const { rows, header } = await parseCSV(file.file);

    // check file is not empty
    if (rows.length === 0) {
      throw new NoDataInFile();
    }

    // if the csv file includes a Group column we will create a structure, so the parent item needs to be a folder
    const hasGrpCol = header.includes(GROUP_COL_NAME);
    if (!hasGrpCol) {
      throw new MissingGroupColumnInCSVError();
    }
    if (!isItemType(parentItem, ItemType.FOLDER)) {
      throw new CantCreateStructureInNoFolderItem();
    }

    // check that all rows have an email set
    if (rows.some((r) => !r.email)) {
      throw new MissingEmailInRowError();
    }

    // check that all rows have a group set
    if (rows.some((r) => !r.group_name)) {
      throw new MissingGroupInRowError();
    }

    // group unique names from the group column,
    // and then create the group folders
    const dataByGroupName = groupby(rows, (r) => r.group_name);

    const res = Array<{
      groupName: string;
      memberships: ItemMembership[];
      invitations: Invitation[];
    }>();
    for await (const [groupName, users] of Object.entries(dataByGroupName)) {
      // Copy the template to the new location
      const { copy: newItem } = await this.itemService.copy(actor, repositories, templateId, {
        parentId,
      });
      // edit name of parent element to match the name of the group
      await this.itemService.patch(actor, repositories, newItem.id, { name: groupName });
      const { memberships, invitations } = await this._createMembershipsAndInvitationsForUserList(
        actor,
        repositories,
        users,
        newItem.id,
      );
      res.push({ groupName, memberships, invitations });
    }
    return res;
  }
}
