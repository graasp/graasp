import groupby from 'lodash.groupby';
import { singleton } from 'tsyringe';

import { MultipartFile } from '@fastify/multipart';

import { ItemType, PermissionLevel } from '@graasp/sdk';

import { BaseLogger } from '../../../../logger';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MAIL } from '../../../../plugins/mailer/langs/constants';
import { MailerService } from '../../../../plugins/mailer/service';
import { NonEmptyArray } from '../../../../types';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { Item, isItemType } from '../../../item/entities/Item';
import { ItemService } from '../../../item/service';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import { ItemMembershipService } from '../../../itemMembership/service';
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

@singleton()
export class InvitationService {
  private readonly log: BaseLogger;
  private readonly mailerService: MailerService;
  private readonly itemService: ItemService;
  private readonly memberService: MemberService;
  private readonly itemMembershipService: ItemMembershipService;

  constructor(
    log: BaseLogger,
    mailerService: MailerService,
    itemService: ItemService,
    memberService: MemberService,
    itemMembershipService: ItemMembershipService,
  ) {
    this.log = log;
    this.mailerService = mailerService;
    this.itemService = itemService;
    this.memberService = memberService;
    this.itemMembershipService = itemMembershipService;
  }

  async sendInvitationEmail({ member, invitation }: { member: Member; invitation: Invitation }) {
    const { item } = invitation;

    // factor out
    const link = buildInvitationLink(invitation);
    const mail = new MailBuilder({
      subject: {
        text: MAIL.INVITATION_TITLE,
        translationVariables: { itemName: item.name },
      },
      lang: member.lang,
    })
      .addText(MAIL.INVITATION_TEXT, {
        itemName: item.name,
        creatorName: member.name,
      })
      .addButton(MAIL.SIGN_UP_BUTTON_TEXT, link)
      .addUserAgreement(MAIL.SIGN_UP_BUTTON_TEXT)
      .build();

    this.mailerService.send(mail, member.email).catch((err) => {
      this.log.warn(err, `mailerService failed. invitation link: ${link}`);
    });
  }

  async get(actor: Actor, repositories: Repositories, invitationId: string) {
    if (actor) {
      return repositories.invitationRepository.getOneByIdAndByCreatorOrThrow(
        invitationId,
        actor.id,
      );
    } else {
      return repositories.invitationRepository.getOneOrThrow(invitationId);
    }
  }

  async getForItem(member: Member, repositories: Repositories, itemId: string) {
    const { invitationRepository } = repositories;
    const item = await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);
    return invitationRepository.getManyByItem(item.path);
  }

  async postManyForItem(
    member: Member,
    repositories: Repositories,
    itemId: string,
    invitations: Partial<Invitation>[],
  ): Promise<Invitation[]> {
    const { invitationRepository } = repositories;
    const item = await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    const completeInvitations = await invitationRepository.addMany(invitations, item.path, member);

    this.log.debug('send invitation mails');
    completeInvitations.forEach((invitation: Invitation) => {
      // send mail without awaiting
      this.sendInvitationEmail({ member, invitation });
    });

    return completeInvitations;
  }

  async patch(
    member: Member,
    repositories: Repositories,
    invitationId: string,
    body: Partial<Invitation>,
  ) {
    const { invitationRepository } = repositories;
    const invitation = await invitationRepository.getOneOrThrow(invitationId);
    await validatePermission(repositories, PermissionLevel.Admin, member, invitation.item);

    return invitationRepository.updateOne(invitationId, body);
  }

  async delete(member: Member, repositories: Repositories, invitationId: string) {
    const { invitationRepository } = repositories;
    const invitation = await invitationRepository.getOneOrThrow(invitationId);
    await validatePermission(repositories, PermissionLevel.Admin, member, invitation.item);

    await invitationRepository.delete(invitationId);
  }

  async resend(member: Member, repositories: Repositories, invitationId: string) {
    const { invitationRepository } = repositories;
    const invitation = await invitationRepository.getOneOrThrow(invitationId);
    await validatePermission(repositories, PermissionLevel.Admin, member, invitation.item);

    this.sendInvitationEmail({ invitation, member });
  }

  async createToMemberships(
    actor: Actor,
    { invitationRepository, itemMembershipRepository }: Repositories,
    member: Member,
  ) {
    // invitations to memberships is triggered on register: no actor available
    const invitations = await invitationRepository.getManyByEmail(member.email);
    const memberships = invitations.map(({ permission, item }) => ({
      itemPath: item.path,
      accountId: member.id,
      permission,
    }));
    await itemMembershipRepository.addMany(memberships);
  }

  async _partitionExistingUsersAndNewUsers(
    actor: Actor,
    repositories: Repositories,
    emailList: string[],
  ): Promise<{ existingAccounts: Member[]; newAccounts: string[] }> {
    const { data: accounts } = await this.memberService.getManyByEmail(repositories, emailList);
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
      return { permission, accountId: account.id };
    });
    this.log.debug(`${JSON.stringify(membershipsToCreate)} memberships to create`);

    // create memberships for accounts that already exist
    const memberships = await this.itemMembershipService.createMany(
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
    this.log.debug(`${JSON.stringify(invitationsToCreate)} invitations to create`);

    // create invitations for accounts that do not exist yet
    const invitations = await this.postManyForItem(
      actor,
      repositories,
      itemId,
      invitationsToCreate,
    );

    return { memberships, invitations };
  }

  /**
   * Create memberships and invitations given invitation list
   * @param actor user creating the access rights
   * @param repositories Object with the repositories needed to interact with the database.
   * @param itemId item the user wants to give access to
   * @param invitations emails and permissions defining the access rights
   * @returns array of created memberships and invitations
   */
  async shareItem(
    actor: Member,
    repositories: Repositories,
    itemId: Item['id'],
    invitations: NonEmptyArray<Pick<Invitation, 'email' | 'permission'>>,
  ): Promise<{ memberships: ItemMembership[]; invitations: Invitation[] }> {
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return this._createMembershipsAndInvitationsForUserList(
      actor,
      repositories,
      invitations,
      itemId,
    );
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
      const { copy: newItem } = await this.itemService.copy(
        actor,
        repositories,
        templateId,
        parentItem,
      );
      // edit name of parent element to match the name of the group
      await this.itemService.patch(actor, repositories, newItem.id, {
        name: groupName,
      });
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
