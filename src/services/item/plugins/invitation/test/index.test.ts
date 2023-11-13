/* eslint-disable @typescript-eslint/no-non-null-assertion */
import FormData from 'form-data';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import * as Papa from 'papaparse';
import path from 'path';
import { In } from 'typeorm';
import waitForExpect from 'wait-for-expect';

import { MultipartFile } from '@fastify/multipart';
import fastify, { FastifyRequest } from 'fastify';

import {
  CompleteMember,
  DiscriminatedItem,
  FolderItemFactory,
  HttpMethod,
  ItemMembership,
  ItemType,
  MemberFactory,
  PermissionLevel,
  RecaptchaAction,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { MOCK_CAPTCHA } from '../../../../auth/plugins/captcha/test/utils';
import { generateRandomEmail } from '../../../../itemLogin/utils';
import { ItemMembershipRepository } from '../../../../itemMembership/repository';
import { Member } from '../../../../member/entities/member';
import { saveMember, saveMembers } from '../../../../member/test/fixtures/members';
import { FolderItem, Item } from '../../../entities/Item';
import { ItemRepository } from '../../../repository';
import { ItemTestUtils } from '../../../test/fixtures/items';
import { Invitation } from '../entity';
import { InvitationRepository } from '../repository';
import { CSVInvite, parseCSV } from '../utils';
import { MissingEmailColumnInCSVError, MissingEmailInRowError } from '../errors';

// mock datasource
jest.mock('../../../../../plugins/datasource');

const testUtils = new ItemTestUtils();

// mock captcha
// bug: cannot reuse mockCaptchaValidation
jest.mock('node-fetch');
(fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { json: async () => ({ success: true, action: RecaptchaAction.SignUp, score: 1 }) } as any;
});

const mockEmail = (app) => {
  return jest.spyOn(app.mailer, 'sendEmail').mockImplementation(async () => {
    // do nothing
    console.debug('SEND EMAIL');
  });
};

const expectInvitations = (invitations: Invitation[], correctInvitations: Invitation[]) => {
  expect(invitations).toHaveLength(correctInvitations.length);
  for (const inv of invitations) {
    const correctInv = correctInvitations.find(({ id }) => id === inv.id);
    expect(inv.name).toEqual(correctInv!.name);
    expect(inv.permission).toEqual(correctInv!.permission);
    expect(inv.email).toEqual(correctInv!.email);
  }
};

const createInvitations = async ({ member, parentItem }: { member: Member; parentItem?: Item }) => {
  const { item } = await testUtils.saveItemAndMembership({ member, parentItem });
  const invitations = Array.from({ length: 3 }, () =>
    InvitationRepository.create({
      item,
      creator: member,
      permission: PermissionLevel.Read,
      email: generateRandomEmail(),
    }),
  );
  return { item, invitations };
};

const saveInvitations = async ({ member }) => {
  const { item, invitations } = await createInvitations({ member });
  for (const inv of invitations) {
    await InvitationRepository.save(inv);
  }
  return { item, invitations };
};

describe('Invitation Plugin', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('POST /invite', () => {
    it('throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item, invitations } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
        payload: { invitations },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('create invitations successfully', async () => {
        const mockSendMail = mockEmail(app);

        const { item, invitations } = await createInvitations({ member: actor });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        const completeInvitations = await InvitationRepository.find({
          where: { email: In(invitations.map(({ email }) => email)) },
        });
        const result = await response.json();
        expectInvitations(result, completeInvitations);

        // check email got sent
        await new Promise((done) => {
          setTimeout(() => {
            expect(mockSendMail).toHaveBeenCalledTimes(invitations.length);
            done(true);
          }, 2000);
        });
      });

      it('normalise emails before saving', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const invitation = {
          email: 'TestCase@graap.org',
          permission: PermissionLevel.Read,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations: [invitation] },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        const completeInvitations = await InvitationRepository.find({
          where: { email: invitation.email.toLowerCase() },
        });
        const result = await response.json();
        expectInvitations(result, completeInvitations);
      });

      it('throws if one invitation is malformed', async () => {
        const { item, invitations } = await createInvitations({ member: actor });
        const faultyInvitation = { email: 'not-correct-email', permission: PermissionLevel.Read };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations: [...invitations, faultyInvitation] },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('throw if id is invalid', async () => {
        const { invitations } = await createInvitations({ member: actor });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/invite`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('GET /:itemId/invitations', () => {
    it('throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item, invitations;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, invitations } = await saveInvitations({ member: actor }));
      });
      it('get invitations for item successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations(await response.json(), invitations);
      });

      it('get invitations for parent item from child successfully', async () => {
        // child invitations
        const { item: child, invitations: childInvitations } = await createInvitations({
          member: actor,
          parentItem: item,
        });
        for (const inv of childInvitations) {
          await InvitationRepository.save(inv);
        }

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/invitations`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations(await response.json(), [...invitations, ...childInvitations]);
      });

      it('throw if item with invitations has been trashed', async () => {
        await testUtils.rawItemRepository.softDelete(item.id);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });

      it('throw if id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/invitations`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('GET /invitations/:id', () => {
    it('get invitation by id successfully if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();

      const { invitations } = await saveInvitations({ member });
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/invitations/${invitations[0].id}`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      expectInvitations([await response.json()], [invitations[0]]);
    });

    describe('Signed In', () => {
      let invitations;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ invitations } = await saveInvitations({ member: actor }));
      });

      it('get invitation by id successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invitations/${invitations[0].id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations([await response.json()], [invitations[0]]);
      });

      it("don't return an invitation for a trashed item", async () => {
        await testUtils.rawItemRepository.softDelete(invitations[0].item.id);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invitations/${invitations[0].id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });

      it('throw if id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invitations/invalid-id`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /:itemId/invitations/:id', () => {
    it('throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item, invitations } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
        payload: {
          permission: PermissionLevel.Admin,
          name: 'myname',
        },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item, invitations;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, invitations } = await saveInvitations({ member: actor }));
      });
      it('update invitation successfully', async () => {
        const payload = {
          permission: PermissionLevel.Admin,
          name: 'myname',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations([await response.json()], [{ ...invitations[0], ...payload }]);
      });

      it('throw if item id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/invitations/${invitations[0].id}`,
          payload: {
            permission: PermissionLevel.Admin,
            name: 'myname',
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('throw if invitation id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/invalid-id`,
          payload: {
            permission: PermissionLevel.Admin,
            name: 'myname',
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('throw if payload is empty', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
          payload: {},
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /:itemId/invitations/:id', () => {
    it('throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item, invitations } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item, invitations;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, invitations } = await saveInvitations({ member: actor }));
      });
      it('delete invitation successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.body).toEqual(invitations[0].id);
      });

      it('throw if item id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/invitations/${invitations[0].id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('throw if invitation id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/invalid-id`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('POST /:itemId/invitations/:id/send', () => {
    it('throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item, invitations } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}/send`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item, invitations;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, invitations } = await saveInvitations({ member: actor }));
      });
      it('resend invitation successfully', async () => {
        const mockSendMail = mockEmail(app);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}/send`,
        });

        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        // check email got sent
        expect(mockSendMail).toHaveBeenCalled();
      });

      it('throw if item id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/invitations/${invitations[0].id}/send`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('throw if invitation id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/invalid-id/send`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('Hook', () => {
    let invitations;

    beforeEach(async () => {
      ({ app, actor } = await build());
      ({ invitations } = await saveInvitations({ member: actor }));
    });

    it('remove invitation on member registration and create memberships successfully', async () => {
      const { id, email, item, permission } = invitations[0];

      // register
      await app.inject({
        method: HttpMethod.Post,
        url: '/register',
        payload: { email, name: 'some-name', captcha: MOCK_CAPTCHA },
      });

      // invitations should be removed and memberships created
      await new Promise((done) => {
        setTimeout(async () => {
          const savedInvitation = await InvitationRepository.findOneBy({ id });
          expect(savedInvitation).toBeFalsy();
          const membership = await ItemMembershipRepository.findOne({
            where: { permission, member: { email }, item: { id: item.id } },
            relations: { member: true, item: true },
          });
          expect(membership).toBeTruthy();
          done(true);
        }, 1000);
      });
    });

    it('does not throw if no invitation found', async () => {
      const email = 'random@email.org';
      const allInvitationsCount = await InvitationRepository.count();
      const allMembershipsCount = await ItemMembershipRepository.count();

      // register
      await app.inject({
        method: HttpMethod.Post,
        url: '/register',
        payload: { email, name: 'some-name', captcha: MOCK_CAPTCHA },
      });

      await new Promise((done) => {
        setTimeout(async () => {
          // all invitations and memberships should exist
          expect(await InvitationRepository.count()).toEqual(allInvitationsCount);
          expect(await ItemMembershipRepository.count()).toEqual(allMembershipsCount);

          done(true);
        }, 1000);
      });
    });
  });
});

describe('Group endpoint', () => {
  let app;
  let actor;

  beforeEach(async () => {
    ({ app, actor } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  const createForm = async (filePath: string) => {
    const file = fs.createReadStream(filePath);
    const form = new FormData();
    form.append('myfile', file);
    return form;
  };

  const creatFilePath = async (filename: string) => {
    return path.resolve(__dirname, `./fixtures/${filename}`);
  };

  const readCSVInvitations = async (filePath: string) => {
    const csvFile = fs.createReadStream(filePath);
    const { rows, header } = await parseCSV(csvFile);
    return rows;
  };

  const createExpectedItemMemberships = async (rows: CSVInvite[], item?: Item) => {
    const memRows = rows.reduce<{
      [key: string]: {
        member: Pick<Member, 'email'>;
        item: Pick<Item, 'name' | 'type'>;
        permission: string;
      };
    }>((resMap, row) => {
      resMap[row.email] = {
        member: { email: row.email },
        item: { name: item ? item.name : row.group_name ?? '', type: ItemType.FOLDER },
        permission: row.permission ?? PermissionLevel.Read,
      };
      return resMap;
    }, {});
    return memRows;
  };

  const createExpectedInvitations = async (rows: CSVInvite[], item?: Item) => {
    const invRows = rows.reduce<{
      [key: string]: {
        email: string;
        item: Pick<Item, 'name' | 'type'>;
        permission: string;
      };
    }>((resMap, row) => {
      resMap[row.email] = {
        email: row.email,
        item: { name: item ? item.name : row.group_name ?? '', type: ItemType.FOLDER },
        permission: row.permission ?? PermissionLevel.Read,
      };
      return resMap;
    }, {});
    return invRows;
  };

  const compareResponse = async (
    data: (ItemMembership | Invitation)[],
    expMem?: {
      [key: string]: {
        member: Pick<Member, 'email'>;
        item: Pick<Item, 'name' | 'type'>;
        permission: string;
      };
    },
    expInv?: {
      [key: string]: {
        email: string;
        item: Pick<Item, 'name' | 'type'>;
        permission: string;
      };
    },
  ) => {
    const expectedSize =
      (expMem ? Object.keys(expMem).length : 0) + (expInv ? Object.keys(expInv).length : 0);

    expect(data).toHaveLength(expectedSize);
    data.map(async (e) => {
      let entryToCompare;
      if (e.hasOwnProperty('member')) {
        entryToCompare = expMem ? expMem[(e as ItemMembership).member.email] : undefined;
      } else {
        entryToCompare = expInv ? expInv[(e as Invitation).email] : undefined;
      }
      expect(e).toMatchObject(entryToCompare);
    });
  };

  const uploadInjection = async (form: FormData, item: Item, idTemplate: string = '') => {
    const response = await app.inject({
      method: HttpMethod.Post,
      url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/upload-csv?id=${item.id}&template_id=${idTemplate}`,
      payload: form,
      headers: form.getHeaders(),
    });
    return response;
  };
  // ${API_HOST}/items/${_itemId}/invitations/upload_csv?id=${_itemId}&template_id=${idTemplate}
  it('Upload a group CSV all members', async () => {
    //By default save Item will create an item
    const { item } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const mockSendMail = mockEmail(app);
    const filePath = await creatFilePath('group.csv');
    const form = await createForm(filePath);
    const rowsInvitations = await readCSVInvitations(filePath);
    const expItemMem = await createExpectedItemMemberships(rowsInvitations);
    const protoMembers: CompleteMember[] = rowsInvitations.map((row) =>
      MemberFactory({ email: row.email }),
    );
    await saveMembers(protoMembers);
    const response = await uploadInjection(form, item);
    expect(response.statusCode).toBe(StatusCodes.OK);
    const data: ItemMembership[] = JSON.parse(response.body).data;
    compareResponse(data, expItemMem);
    await waitForExpect(() => {
      expect(mockSendMail).toHaveBeenCalledTimes(rowsInvitations.length);
    });
  });

  it('Upload a group CSV all invitations', async () => {
    //By default save Item will create an item
    const { item } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const mockSendMail = mockEmail(app);
    const filePath = await creatFilePath('group.csv');
    const form = await createForm(filePath);
    const rowsInvitations = await readCSVInvitations(filePath);
    const expInv = await createExpectedInvitations(rowsInvitations);
    const response = await uploadInjection(form, item);
    expect(response.statusCode).toBe(StatusCodes.OK);
    const data: ItemMembership[] = JSON.parse(response.body).data;
    compareResponse(data, undefined, expInv);
    await waitForExpect(() => {
      expect(mockSendMail).toHaveBeenCalledTimes(rowsInvitations.length);
    });
  });

  it('Upload a group CSV mix members and invitations', async () => {
    //By default save Item will create an item
    const { item } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const mockSendMail = mockEmail(app);
    const filePath = await creatFilePath('group.csv');
    const form = await createForm(filePath);
    const rowsInvitations = await readCSVInvitations(filePath);

    const firstHalfOfRows = rowsInvitations.slice(0, rowsInvitations.length / 2);
    const secondHalfOfRows = rowsInvitations.slice(
      rowsInvitations.length / 2,
      rowsInvitations.length,
    );
    const protoMembers: CompleteMember[] = firstHalfOfRows.map((row) =>
      MemberFactory({ email: row.email }),
    );
    const members = await saveMembers(protoMembers);
    const expItemMem = await createExpectedItemMemberships(firstHalfOfRows);
    const expInv = await createExpectedInvitations(secondHalfOfRows);
    const response = await uploadInjection(form, item);

    expect(response.statusCode).toBe(StatusCodes.OK);

    const data: (ItemMembership | Invitation)[] = JSON.parse(response.body).data;

    compareResponse(data, expItemMem, expInv);
    await waitForExpect(() => {
      expect(mockSendMail).toHaveBeenCalledTimes(rowsInvitations.length);
    });
  });

  it('Check error missing a column email CSV', async () => {
    const { item } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const mockSendMail = mockEmail(app);
    const filePath = await creatFilePath('email_column_missing.csv');
    const form = await createForm(filePath);
    const response = await uploadInjection(form, item);
    expect(response.json()).toEqual(new MissingEmailColumnInCSVError());
    expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    await waitForExpect(() => {
      expect(mockSendMail).toHaveBeenCalledTimes(0);
    });
  });

  it('Check error missing email entries CSV', async () => {
    const { item } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const mockSendMail = mockEmail(app);
    const filePath = await creatFilePath('missing_email_entries.csv');
    const form = await createForm(filePath);
    const response = await uploadInjection(form, item);
    const rowsInvitations = await readCSVInvitations(filePath);

    const rowsWithoutEmail = rowsInvitations.filter((row) => !row.email);
    expect(response.json()).toEqual(new MissingEmailInRowError(rowsWithoutEmail));
    expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    await waitForExpect(() => {
      expect(mockSendMail).toHaveBeenCalledTimes(0);
    });
  });

  it('Upload a normal CSV all memberships', async () => {
    //By default save Item will create an item
    const { item } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const mockSendMail = mockEmail(app);
    const filePath = await creatFilePath('sharing_current_item.csv');
    const form = await createForm(filePath);
    const rowsInvitations = await readCSVInvitations(filePath);
    const expItemMem = await createExpectedItemMemberships(rowsInvitations, item);
    const protoMembers: CompleteMember[] = rowsInvitations.map((row) =>
      MemberFactory({ email: row.email }),
    );
    await saveMembers(protoMembers);
    const response = await uploadInjection(form, item);
    expect(response.statusCode).toBe(StatusCodes.OK);
    const data: ItemMembership[] = JSON.parse(response.body).data;
    compareResponse(data, expItemMem);
    await waitForExpect(() => {
      expect(mockSendMail).toHaveBeenCalledTimes(rowsInvitations.length);
    });
  });

  it('Upload a normal CSV all invitation', async () => {
    //By default save Item will create an item
    const { item } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const mockSendMail = mockEmail(app);
    const filePath = await creatFilePath('sharing_current_item.csv');
    const form = await createForm(filePath);
    const rowsInvitations = await readCSVInvitations(filePath);
    const expInv = await createExpectedInvitations(rowsInvitations);
    const response = await uploadInjection(form, item);
    expect(response.statusCode).toBe(StatusCodes.OK);
    const data: ItemMembership[] = JSON.parse(response.body).data;
    compareResponse(data, undefined, expInv);
    await waitForExpect(() => {
      expect(mockSendMail).toHaveBeenCalledTimes(rowsInvitations.length);
    });
  });

  it('Upload a normal CSV mix invitations and memberships', async () => {
    //By default save Item will create an item
    const { item } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const mockSendMail = mockEmail(app);
    const filePath = await creatFilePath('sharing_current_item.csv');
    const form = await createForm(filePath);
    const rowsInvitations = await readCSVInvitations(filePath);

    const firstHalfOfRows = rowsInvitations.slice(0, rowsInvitations.length / 2);
    const secondHalfOfRows = rowsInvitations.slice(
      rowsInvitations.length / 2,
      rowsInvitations.length,
    );
    const protoMembers: CompleteMember[] = firstHalfOfRows.map((row) =>
      MemberFactory({ email: row.email }),
    );
    const members = await saveMembers(protoMembers);
    const expItemMem = await createExpectedItemMemberships(firstHalfOfRows, item);
    const expInv = await createExpectedInvitations(secondHalfOfRows, item);
    const response = await uploadInjection(form, item);

    expect(response.statusCode).toBe(StatusCodes.OK);

    const data: (ItemMembership | Invitation)[] = JSON.parse(response.body).data;

    compareResponse(data, expItemMem, expInv);
    await waitForExpect(() => {
      expect(mockSendMail).toHaveBeenCalledTimes(rowsInvitations.length);
    });
  });
  const buildFolderItem = (
    args: {
      parentItem?: FolderItem;
      extra?: { folder: { childrenOrder: string[] } };
    } = {},
  ) => {
    const item = FolderItemFactory(args) as unknown as FolderItem;
    // change date time for it to work with the backend data
    item.createdAt = new Date(item.createdAt);
    return item;
  };

  // const createExpectedFolderStructure = async (groupFolderNames: string[]) => {};
  it('Upload a group CSV mix members and invitations template folder', async () => {
    //By default save Item will create an item
    const { item } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const { item: templateItem } = await testUtils.saveItemAndMembership({
      member: actor,
    });
    const subFolder = await testUtils.saveItem({
      item: { name: 'sub' },
      actor: actor,
      parentItem: templateItem,
    });

    //check the folder where the folders are create empty
    let children = await testUtils.itemRepository.getChildren(item);
    expect(children).toEqual([]);
    const mockSendMail = mockEmail(app);
    const filePath = await creatFilePath('group.csv');
    const form = await createForm(filePath);
    const rowsInvitations = await readCSVInvitations(filePath);
    console.log(rowsInvitations);
    const firstHalfOfRows = rowsInvitations.slice(0, rowsInvitations.length / 2);
    console.log(firstHalfOfRows);
    const secondHalfOfRows = rowsInvitations.slice(
      rowsInvitations.length / 2,
      rowsInvitations.length,
    );
    console.log(secondHalfOfRows);

    const protoMembers: CompleteMember[] = firstHalfOfRows.map((row) =>
      MemberFactory({ email: row.email }),
    );
    const members = await saveMembers(protoMembers);
    const expItemMem = await createExpectedItemMemberships(firstHalfOfRows);
    const expInv = await createExpectedInvitations(secondHalfOfRows);
    const response = await uploadInjection(form, item, templateItem.id);

    expect(response.statusCode).toBe(StatusCodes.OK);

    const data: (ItemMembership | Invitation)[] = JSON.parse(response.body).data;

    compareResponse(data, expItemMem, expInv);
    await waitForExpect(() => {
      expect(mockSendMail).toHaveBeenCalledTimes(rowsInvitations.length);
    });
    const allItems = await testUtils.rawItemRepository.find();
    console.log('all', allItems);
    children = await testUtils.itemRepository.getDescendants(templateItem as FolderItem);
    console.log(children);
    children = await testUtils.itemRepository.getDescendants(item as FolderItem);
    children.map(async (child) => {
      const desc = await testUtils.itemRepository.getDescendants(child as FolderItem);
      console.log(desc);
    });
    console.log(children);
  });
});
