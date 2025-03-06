import groupby from 'lodash.groupby';
import { singleton } from 'tsyringe';

import { MultipartFile } from '@fastify/multipart';

import { ItemType, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import {
  InvitationInsertDTO,
  InvitationRaw,
  InvitationWithItem,
  Item,
  ItemMembershipRaw,
} from '../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../langs/constants';
import { BaseLogger } from '../../../../logger';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { AuthenticatedUser, MaybeUser, MinimalMember, NonEmptyArray } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
import { ItemService } from '../../../item/service';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { ItemMembershipService } from '../../../itemMembership/service';
import { MemberService } from '../../../member/member.service';
import { MemberDTO } from '../../../member/types';
import { isItemType } from '../../discrimination';
import { EMAIL_COLUMN_NAME, GROUP_COL_NAME, buildInvitationLink } from './constants';
import {
  CantCreateStructureInNoFolderItem,
  InvitationNotFound,
  MissingEmailColumnInCSVError,
  MissingEmailInRowError,
  MissingGroupColumnInCSVError,
  MissingGroupInRowError,
  NoDataInFile,
  TemplateItemDoesNotExist,
} from './errors';
import { InvitationRepository } from './repository';
import { CSVInvite, parseCSV, verifyCSVFileFormat } from './utils';

@singleton()
export class InvitationService {
  private readonly log: BaseLogger;
  private readonly mailerService: MailerService;
  private readonly itemService: ItemService;
  private readonly memberService: MemberService;
  private readonly itemMembershipService: ItemMembershipService;
  private readonly authorizationService: AuthorizationService;
  private readonly invitationRepository: InvitationRepository;

  constructor(
    log: BaseLogger,
    mailerService: MailerService,
    itemService: ItemService,
    memberService: MemberService,
    itemMembershipService: ItemMembershipService,
    authorizationService: AuthorizationService,
    invitationRepository: InvitationRepository,
  ) {
    this.log = log;
    this.mailerService = mailerService;
    this.itemService = itemService;
    this.memberService = memberService;
    this.itemMembershipService = itemMembershipService;
    this.authorizationService = authorizationService;
    this.invitationRepository = invitationRepository;
  }

  async sendInvitationEmail({
    member,
    invitation,
  }: {
    member: AuthenticatedUser;
    invitation: InvitationWithItem;
  }) {
    const { item } = invitation;

    // factor out
    const link = buildInvitationLink(invitation);
    const mail = new MailBuilder({
      subject: {
        text: TRANSLATIONS.INVITATION_TITLE,
        translationVariables: { itemName: item.name },
      },
      // CHECK: Does this have to be the lang of the user that created the invitations ?
      lang: member.lang,
    })
      .addText(TRANSLATIONS.INVITATION_TEXT, {
        itemName: item.name,
        creatorName: member.name,
      })
      .addButton(TRANSLATIONS.SIGN_UP_BUTTON_TEXT, link)
      .addUserAgreement()
      .build();

    this.mailerService.send(mail, invitation.email).catch((err) => {
      this.log.warn(err, `mailerService failed. invitation link: ${link}`);
    });
  }

  async get(db: DBConnection, actor: MaybeUser, invitationId: string) {
    if (actor) {
      return this.invitationRepository.getOneByIdAndByCreatorOrThrow(db, invitationId, actor.id);
    } else {
      const invitation = this.invitationRepository.getOne(db, invitationId);
      if (!invitation) {
        throw new InvitationNotFound({ invitationId });
      }
    }
  }

  async getForItem(db: DBConnection, authenticatedUser: AuthenticatedUser, itemId: string) {
    const item = await this.itemService.basicItemService.get(
      db,
      authenticatedUser,
      itemId,
      PermissionLevel.Admin,
    );
    return this.invitationRepository.getManyByItem(db, item.path);
  }

  async postManyForItem(
    db: DBConnection,
    member: AuthenticatedUser,
    itemId: string,
    invitations: Pick<InvitationInsertDTO, 'permission' | 'email'>[],
  ) {
    const item = await this.itemService.basicItemService.get(
      db,
      member,
      itemId,
      PermissionLevel.Admin,
    );

    await this.invitationRepository.addMany(db, invitations, item.path, member);

    const completeInvitations = await this.invitationRepository.getManyByItem(db, item.path);

    this.log.debug('send invitation mails');
    completeInvitations.forEach((invitation) => {
      // send mail without awaiting
      this.sendInvitationEmail({ member, invitation });
    });

    return completeInvitations;
  }

  async patch(
    db: DBConnection,
    authenticatedUser: AuthenticatedUser,
    invitationId: string,
    body: Partial<InvitationInsertDTO>,
  ) {
    const invitation = await this.invitationRepository.getOne(db, invitationId);
    if (!invitation) {
      throw new InvitationNotFound({ invitationId });
    }
    await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Admin,
      authenticatedUser,
      invitation.item,
    );

    return this.invitationRepository.updateOne(db, invitationId, body);
  }

  async delete(db: DBConnection, authenticatedUser: AuthenticatedUser, invitationId: string) {
    const invitation = await this.invitationRepository.getOne(db, invitationId);
    if (!invitation) {
      throw new Error('missing invitation');
    }
    await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Admin,
      authenticatedUser,
      invitation.item,
    );

    await this.invitationRepository.delete(db, invitationId);
  }

  async resend(db: DBConnection, member: MinimalMember, invitationId: string) {
    const invitation = await this.invitationRepository.getOne(db, invitationId);

    if (!invitation) {
      throw new InvitationNotFound(invitationId);
    }

    await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Admin,
      member,
      invitation.item,
    );

    this.sendInvitationEmail({ invitation, member });
  }

  async createToMemberships(db: DBConnection, member: MemberDTO) {
    // invitations to memberships is triggered on register: no actor available
    const invitations = await this.invitationRepository.getManyByEmail(db, member.email);
    const memberships = invitations.map(({ permission, item }) => ({
      itemPath: item.path,
      accountId: member.id,
      permission,
    }));
    await new ItemMembershipRepository().addMany(db, memberships);
    await this.invitationRepository.deleteManyByEmail(db, member.email);
  }

  async _partitionExistingUsersAndNewUsers(
    db: DBConnection,
    emailList: string[],
  ): Promise<{ existingAccounts: MemberDTO[]; newAccounts: string[] }> {
    const { data: accounts } = await this.memberService.getManyByEmails(db, emailList);
    const existingAccounts = Object.values(accounts);
    const existingAccountsEmails = Object.keys(accounts);
    const newAccounts = emailList.filter((email) => !existingAccountsEmails.includes(email));
    return { existingAccounts, newAccounts };
  }

  async _createMembershipsAndInvitationsForUserList(
    db: DBConnection,
    actor: AuthenticatedUser,
    rows: CSVInvite[],
    itemId: Item['id'],
  ) {
    // partition between emails that are already accounts and emails without accounts
    const { existingAccounts, newAccounts } = await this._partitionExistingUsersAndNewUsers(
      db,
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
      db,
      actor,
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
    const invitations = await this.postManyForItem(db, actor, itemId, invitationsToCreate);

    return { memberships, invitations };
  }

  /**
   * Create memberships and invitations given invitation list
   * @param actor user creating the access rights
   * @param itemId item the user wants to give access to
   * @param invitations emails and permissions defining the access rights
   * @returns array of created memberships and invitations
   */
  async shareItem(
    db: DBConnection,
    actor: AuthenticatedUser,
    itemId: Item['id'],
    invitations: NonEmptyArray<Pick<InvitationRaw, 'email' | 'permission'>>,
  ): Promise<{
    memberships: ItemMembershipRaw[];
    invitations: InvitationWithItem[];
  }> {
    await this.itemService.basicItemService.get(db, actor, itemId, PermissionLevel.Admin);

    return this._createMembershipsAndInvitationsForUserList(db, actor, invitations, itemId);
  }

  async importUsersWithCSV(
    db: DBConnection,
    actor: MinimalMember,
    itemId: Item['id'],
    file: MultipartFile,
  ): Promise<{ memberships: ItemMembershipRaw[]; invitations: InvitationRaw[] }> {
    // verify file is CSV
    verifyCSVFileFormat(file);

    // get the item, verify user has Admin access
    await this.itemService.basicItemService.get(db, actor, itemId, PermissionLevel.Admin);

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

    return this._createMembershipsAndInvitationsForUserList(db, actor, rows, itemId);
  }

  async createStructureForCSVAndTemplate(
    db: DBConnection,
    actor: MinimalMember,
    parentId: string,
    templateId: string,
    file: MultipartFile,
  ): Promise<
    {
      groupName: string;
      memberships: ItemMembershipRaw[];
      invitations: InvitationRaw[];
    }[]
  > {
    // verify file is CSV
    verifyCSVFileFormat(file);

    // get parentItem
    const parentItem = await this.itemService.basicItemService.get(
      db,
      actor,
      parentId,
      PermissionLevel.Admin,
    );

    // check that the template exists
    const templateItem = await this.itemService.basicItemService.get(db, actor, templateId);
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
      memberships: ItemMembershipRaw[];
      invitations: InvitationRaw[];
    }>();
    for await (const [groupName, users] of Object.entries(dataByGroupName)) {
      // Copy the template to the new location
      const { copy: newItem } = await this.itemService.copy(db, actor, templateId, parentItem);
      // edit name of parent element to match the name of the group
      await this.itemService.patch(db, actor, newItem.id, {
        name: groupName,
      });
      const { memberships, invitations } = await this._createMembershipsAndInvitationsForUserList(
        db,
        actor,
        users,
        newItem.id,
      );
      res.push({ groupName, memberships, invitations });
    }
    return res;
  }
}
