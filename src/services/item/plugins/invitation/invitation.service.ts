import groupby from 'lodash.groupby';
import { singleton } from 'tsyringe';

import type { MultipartFile } from '@fastify/multipart';

import { type DBConnection } from '../../../../drizzle/db';
import type {
  InvitationInsertDTO,
  InvitationRaw,
  InvitationWithItem,
  ItemMembershipRaw,
  ItemRaw,
} from '../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../langs/constants';
import { BaseLogger } from '../../../../logger';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import type { AuthenticatedUser, MaybeUser, MinimalMember, NonEmptyArray } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ItemMembershipService } from '../../../itemMembership/membership.service';
import { MemberService } from '../../../member/member.service';
import { MemberDTO } from '../../../member/types';
import { isItemType } from '../../discrimination';
import { ItemService } from '../../item.service';
import { InvitationRepository } from './invitation.repository';
import { EMAIL_COLUMN_NAME, GROUP_COL_NAME, buildInvitationLink } from './utils/constants';
import {
  CantCreateStructureInNoFolderItem,
  InvitationNotFound,
  MissingEmailColumnInCSVError,
  MissingEmailInRowError,
  MissingGroupColumnInCSVError,
  MissingGroupInRowError,
  NoDataInFile,
  TemplateItemDoesNotExist,
} from './utils/errors';
import { type CSVInvite, parseCSV, verifyCSVFileFormat } from './utils/utils';

@singleton()
export class InvitationService {
  private readonly log: BaseLogger;
  private readonly mailerService: MailerService;
  private readonly itemService: ItemService;
  private readonly memberService: MemberService;
  private readonly itemMembershipService: ItemMembershipService;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly invitationRepository: InvitationRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;

  constructor(
    log: BaseLogger,
    mailerService: MailerService,
    itemService: ItemService,
    memberService: MemberService,
    itemMembershipService: ItemMembershipService,
    authorizedItemService: AuthorizedItemService,
    invitationRepository: InvitationRepository,
    itemMembershipRepository: ItemMembershipRepository,
  ) {
    this.log = log;
    this.mailerService = mailerService;
    this.itemService = itemService;
    this.memberService = memberService;
    this.itemMembershipService = itemMembershipService;
    this.authorizedItemService = authorizedItemService;
    this.invitationRepository = invitationRepository;
    this.itemMembershipRepository = itemMembershipRepository;
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

  async get(dbConnection: DBConnection, actor: MaybeUser, invitationId: string) {
    const invitation = await this.invitationRepository.getOne(dbConnection, invitationId);

    if (!invitation) {
      throw new InvitationNotFound({ invitationId });
    }
    return invitation;
  }

  async getForItem(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: string,
  ) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: authenticatedUser.id,
      itemId,
      permission: 'admin',
    });
    return this.invitationRepository.getManyByItem(dbConnection, item.path);
  }

  async postManyForItem(
    dbConnection: DBConnection,
    member: AuthenticatedUser,
    itemId: string,
    invitations: Pick<InvitationInsertDTO, 'permission' | 'email'>[],
  ) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'admin',
    });

    await this.invitationRepository.addMany(dbConnection, invitations, item.path, member);

    const completeInvitations = await this.invitationRepository.getManyByItem(
      dbConnection,
      item.path,
    );

    this.log.debug('send invitation mails');
    completeInvitations.forEach((invitation) => {
      // send mail without awaiting
      this.sendInvitationEmail({ member, invitation });
    });

    return completeInvitations;
  }

  async patch(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    invitationId: string,
    body: Partial<InvitationInsertDTO>,
  ) {
    const invitation = await this.invitationRepository.getOne(dbConnection, invitationId);
    if (!invitation) {
      throw new InvitationNotFound({ invitationId });
    }
    await this.authorizedItemService.assertAccess(dbConnection, {
      permission: 'admin',
      accountId: authenticatedUser.id,
      item: invitation.item,
    });

    await this.invitationRepository.updateOne(dbConnection, invitationId, body);
  }

  async delete(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    invitationId: string,
  ) {
    const invitation = await this.invitationRepository.getOne(dbConnection, invitationId);
    if (!invitation) {
      throw new Error('missing invitation');
    }
    await this.authorizedItemService.assertAccess(dbConnection, {
      permission: 'admin',
      accountId: authenticatedUser.id,
      item: invitation.item,
    });

    await this.invitationRepository.delete(dbConnection, invitationId);
  }

  async resend(dbConnection: DBConnection, member: MinimalMember, invitationId: string) {
    const invitation = await this.invitationRepository.getOne(dbConnection, invitationId);

    if (!invitation) {
      throw new InvitationNotFound(invitationId);
    }

    await this.authorizedItemService.assertAccess(dbConnection, {
      permission: 'admin',
      accountId: member.id,
      item: invitation.item,
    });

    this.sendInvitationEmail({ invitation, member });
  }

  async createToMemberships(dbConnection: DBConnection, member: MemberDTO) {
    // invitations to memberships is triggered on register: no actor available
    const invitations = await this.invitationRepository.getManyByEmail(dbConnection, member.email);
    if (invitations.length) {
      const memberships = invitations.map(({ permission, item }) => ({
        itemPath: item.path,
        accountId: member.id,
        permission,
      }));
      await this.itemMembershipRepository.addMany(dbConnection, memberships);
      await this.invitationRepository.deleteManyByEmail(dbConnection, member.email);
    }
  }

  async _partitionExistingUsersAndNewUsers(
    dbConnection: DBConnection,
    emailList: string[],
  ): Promise<{ existingAccounts: MemberDTO[]; newAccounts: string[] }> {
    const { data: accounts } = await this.memberService.getManyByEmails(dbConnection, emailList);
    const existingAccounts = Object.values(accounts);
    const existingAccountsEmails = Object.keys(accounts);
    const newAccounts = emailList.filter((email) => !existingAccountsEmails.includes(email));
    return { existingAccounts, newAccounts };
  }

  async _createMembershipsAndInvitationsForUserList(
    dbConnection: DBConnection,
    actor: AuthenticatedUser,
    rows: CSVInvite[],
    itemId: ItemRaw['id'],
  ) {
    // partition between emails that are already accounts and emails without accounts
    const { existingAccounts, newAccounts } = await this._partitionExistingUsersAndNewUsers(
      dbConnection,
      rows.map((r) => r.email),
    );

    // generate memberships to create
    const membershipsToCreate = existingAccounts.map((account) => {
      const permission =
        // get the permission from the data, if it is not found or if it is an empty string, default to read
        rows.find((r) => r.email === account.email)?.permission ?? 'read';
      return { permission, accountId: account.id };
    });
    this.log.debug(`${JSON.stringify(membershipsToCreate)} memberships to create`);

    // create memberships for accounts that already exist
    let memberships: ItemMembershipRaw[] = [];
    if (membershipsToCreate.length) {
      memberships = await this.itemMembershipService.createMany(
        dbConnection,
        actor,
        membershipsToCreate,
        itemId,
      );
    }

    // generate invitations to create
    const invitationsToCreate = newAccounts.map((email) => {
      // get the permission from the data, if it is not found or if it is an empty string, default to read
      const permission = rows.find((r) => r.email === email)?.permission ?? 'read';
      return { email, permission };
    });
    this.log.debug(`${JSON.stringify(invitationsToCreate)} invitations to create`);

    // create invitations for accounts that do not exist yet
    let invitations: InvitationWithItem[] = [];
    if (invitationsToCreate.length) {
      invitations = await this.postManyForItem(dbConnection, actor, itemId, invitationsToCreate);
    }
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
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: ItemRaw['id'],
    invitations: NonEmptyArray<Pick<InvitationRaw, 'email' | 'permission'>>,
  ): Promise<{
    memberships: ItemMembershipRaw[];
    invitations: InvitationWithItem[];
  }> {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: authenticatedUser.id,
      itemId,
      permission: 'admin',
    });

    return this._createMembershipsAndInvitationsForUserList(
      dbConnection,
      authenticatedUser,
      invitations,
      itemId,
    );
  }

  async importUsersWithCSV(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: ItemRaw['id'],
    file: MultipartFile,
  ): Promise<{ memberships: ItemMembershipRaw[]; invitations: InvitationRaw[] }> {
    // verify file is CSV
    verifyCSVFileFormat(file);

    // get the item, verify user has Admin access
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'admin',
    });

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

    return this._createMembershipsAndInvitationsForUserList(dbConnection, member, rows, itemId);
  }

  async createStructureForCSVAndTemplate(
    dbConnection: DBConnection,
    member: MinimalMember,
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
    const parentItem = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: member.id,
      itemId: parentId,
      permission: 'admin',
    });

    // check that the template exists
    const templateItem = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: member.id,
      itemId: templateId,
    });
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
    if (!isItemType(parentItem, 'folder')) {
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
    for (const [groupName, users] of Object.entries(dataByGroupName)) {
      // Copy the template to the new location
      const { copy: newItem } = await this.itemService.copy(
        dbConnection,
        member,
        templateId,
        parentItem,
      );
      // edit name of parent element to match the name of the group
      await this.itemService.patch(dbConnection, member, newItem.id, {
        name: groupName,
      });
      const { memberships, invitations } = await this._createMembershipsAndInvitationsForUserList(
        dbConnection,
        member,
        users,
        newItem.id,
      );
      res.push({ groupName, memberships, invitations });
    }
    return res;
  }
}
