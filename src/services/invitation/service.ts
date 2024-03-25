import { MultipartFile } from '@fastify/multipart';
import { FastifyBaseLogger } from 'fastify';

import { PermissionLevel, partitionArray } from '@graasp/sdk';
import { ItemType } from '@graasp/sdk';

import type { MailerDecoration } from '../../plugins/mailer';
import { MAIL } from '../../plugins/mailer/langs/constants';
import { IdParam } from '../../types';
import { UnauthorizedMember } from '../../utils/errors';
import { Repositories } from '../../utils/repositories';
import { validatePermission } from '../authorization';
import { Item } from '../item/entities/Item';
import ItemService from '../item/service';
import { ItemMembership } from '../itemMembership/entities/ItemMembership';
import ItemMembershipService from '../itemMembership/service';
import { Actor, Member } from '../member/entities/member';
import { MemberService } from '../member/service';
import { GRP_COL_NAME, buildInvitationLink } from './constants';
import {
  NoDataFoundForInvitations,
  NoEmailFoundForInvitations,
  NoGroupFoundForInvitations,
  NoGroupNamesFoundForInvitations,
} from './errors';
import { Invitation } from './invitation';
import { CSVInvite, getCSV, regexGenFirstLevelItems, verifyCSVFileFormat } from './utils';

export class InvitationService {
  log: FastifyBaseLogger;
  mailer: MailerDecoration;
  itemService: ItemService;
  memberService: MemberService;
  // itemMembershipService: ItemMembershipService;

  constructor(
    log,
    mailer,
    itemService: ItemService,
    // itemMembershipService: ItemMembershipService,
    memberService: MemberService,
  ) {
    this.log = log;
    this.mailer = mailer;
    this.itemService = itemService;
    this.memberService = memberService;
    // this.itemMembershipService = itemMembershipService;
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
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { invitationRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    const completeInvitations = await invitationRepository.postMany(invitations, item.path, actor);

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
      where: { email: member.email.toLowerCase() },
      relations: { item: true },
    });
    const memberships = invitations.map(({ permission, item }) => ({ item, member, permission }));
    await itemMembershipRepository.createMany(memberships);
  }

  async handleCSVInvitations(
    actor: Actor,
    repositories: Repositories,
    parentId: string,
    templateId: string,
    file: MultipartFile,
    itemMembershipService: ItemMembershipService,
  ): Promise<{
    data: (Invitation | ItemMembership)[];
    errors: Error[];
  }> {
    // verify file is CSV
    verifyCSVFileFormat(file);

    // get parentItem
    const parentItem = await repositories.itemRepository.get(parentId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, parentItem);

    // parse CSV file
    const { rows, header } = await getCSV(file.file);

    // if the csv file includes a Group column we will create a structure, so the parent item needs to be a folder
    const hasGrpCol = header.includes(GRP_COL_NAME);
    if (parentItem.type !== ItemType.FOLDER && hasGrpCol) {
      throw new Error(`Group folder service can only be used with
        folder items
        `);
    }

    // Check the rows in CSV contain email or there is some rows
    // with missing email
    const [rowsWithEmail, rowsWithoutEmail] = partitionArray(rows, (d) => Boolean(d.email));
    if (!rowsWithEmail.length) {
      throw new NoDataFoundForInvitations();
    }
    if (rowsWithoutEmail.length) {
      throw new NoEmailFoundForInvitations(rowsWithoutEmail);
    }
    let selRows = rowsWithEmail;
    let groupNameToItem = new Map<string, Item>();

    if (hasGrpCol) {
      // If detecting group column defined, check if there exists rows with
      // group names defined
      const [rowsWithGroups, rowsWithoutGroup] = partitionArray(rowsWithEmail, (d) =>
        Boolean(d.group_name),
      );

      if (rowsWithoutGroup.length) {
        throw new NoGroupFoundForInvitations(rowsWithoutGroup);
      }

      selRows = rowsWithGroups;
      if (!rowsWithGroups.length) {
        throw new NoGroupNamesFoundForInvitations();
      }

      // group unique names from the group column,
      // and then create the group folders
      const groupNames = [
        ...new Set(
          rowsWithGroups.map((row) => {
            return row.group_name;
          }),
        ),
      ] as string[];

      const createdItems = await Promise.all(
        groupNames.map(async (groupName) => {
          const itemCreated = await this.itemService.post(actor, repositories, {
            item: {
              name: groupName,
              type: ItemType.FOLDER,
            },
            parentId: parentId,
          });
          return itemCreated;
        }),
      );

      // Get selected folder from items itemService.copyMany
      let itemsAtFirstLevel: string[] = [];
      if (templateId) {
        // Get all items from folder_id and copy its content to group folders
        const itemsInTemplate = await this.itemService.getDescendants(
          actor,
          repositories,
          templateId,
        );

        // Because the function itemService.copyMany need only items at the first level
        // of the folder to execute a deep copy, it is necessary to exclude all
        // non first level items from the itemService.getDescendants call
        const regex = regexGenFirstLevelItems(
          (await this.itemService.get(actor, repositories, templateId)).path,
        );

        itemsAtFirstLevel = itemsInTemplate
          .filter((tmpItem) => {
            return regex.test(tmpItem.path);
          })
          .map((tmpItem) => {
            return tmpItem.id;
          });
      }

      //iterate through created group folders and copy folder content to them
      if (itemsAtFirstLevel.length > 1) {
        await Promise.all(
          createdItems.map(async (folderItem) => {
            await this.itemService.copyMany(actor, repositories, itemsAtFirstLevel, {
              parentId: folderItem.id,
            });
          }),
        );
      }

      groupNameToItem = createdItems.reduce((resMap, folderItem) => {
        resMap.set(folderItem.name, folderItem);
        return resMap;
      }, new Map<string, Item>());
    }
    // A map group where group and its invitation matches will
    // be generated below. In the case the function is not executing
    // the group creation folders, then this map will have an empty key
    // pointing to all invitations from the CSV.

    const invitesPerGroup = selRows.reduce((result, rowInvite: CSVInvite) => {
      const group_name = rowInvite.group_name ?? '';

      const invite = new Invitation();
      invite.email = rowInvite['email'];
      invite.permission = PermissionLevel.Read;
      invite.item = parentItem;

      //modify according to missing properties
      if (rowInvite.permission) {
        invite.permission = rowInvite.permission;
      }

      if (!rowInvite.name) {
        invite.name = '';
      }

      if (groupNameToItem.size > 0 && groupNameToItem.has(group_name)) {
        const grpNamToIt = groupNameToItem.get(group_name);
        if (grpNamToIt) {
          invite.item = grpNamToIt;
        }
      }

      if (!result.has(group_name)) {
        result.set(group_name, [invite]);
      } else {
        result.get(group_name)?.push(invite);
      }
      return result;
    }, new Map<string, Invitation[]>());

    // Needs to split invitations between invitations for
    // non Graasp users and membership for Graasp users.
    const emails = selRows.map((inv) => inv.email.toLocaleLowerCase());
    const accounts = await this.memberService.getManyByEmail(actor, repositories, emails);

    const res: {
      data: (Invitation | ItemMembership)[];
      errors: Error[];
    } = { data: [], errors: [] };

    await Promise.all(
      Array.from(invitesPerGroup.values()).map(async (arrOfInvitations) => {
        const dataWithMemberId = arrOfInvitations.map((d) => ({
          ...d,
          memberId: accounts.data[d.email?.toLowerCase()]?.id,
        }));
        const [newMemberships, invitations] = partitionArray(dataWithMemberId, (d) =>
          Boolean(d.memberId),
        );
        if (newMemberships.length) {
          const mem = await itemMembershipService.postMany(
            actor,
            repositories,
            newMemberships,
            newMemberships[0].item.id,
          );
          res.data = [...res.data, ...mem];
        }
        if (invitations.length) {
          const inv = await this.postManyForItem(
            actor,
            repositories,
            invitations[0].item.id,
            invitations,
          );

          res.data = [...res.data, ...Object.values(inv.data)];
          res.errors = [...res.errors, ...inv.errors];
        }
      }),
    );
    // This function is returning "partial" data.
    // Help: Comments in PR recommend not returning this type. However, what about
    // the func postManyForItem? Is it better to return this type or throw an error
    // if postManyForItem has a size greater than 0 for its errors property?
    return res;
  }
}
