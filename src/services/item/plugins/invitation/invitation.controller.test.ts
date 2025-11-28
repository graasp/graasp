import { faker } from '@faker-js/faker';
import { and, eq, inArray } from 'drizzle-orm';
import FormData from 'form-data';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import path from 'path';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel, RecaptchaAction } from '@graasp/sdk';

import build, {
  MOCK_CAPTCHA,
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { uniqueEmail } from '../../../../../test/factories/member.factory';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { accountsTable, invitationsTable, itemMembershipsTable } from '../../../../drizzle/schema';
import type { InvitationRaw } from '../../../../drizzle/types';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { assertIsMemberForTest } from '../../../authentication';
import { MissingGroupColumnInCSVError } from './utils/errors';

// we need a different form data for each test
const createFormData = (filename: string) => {
  const form = new FormData();
  form.append(
    'myfile',
    fs.createReadStream(path.resolve(__dirname, `./test/fixtures/${filename}`)),
  );

  return form;
};

// mock captcha
// bug: cannot reuse mockCaptchaValidation
jest.mock('node-fetch');
(fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { json: async () => ({ success: true, action: RecaptchaAction.SignUp, score: 1 }) } as any;
});

const mockEmail = () => {
  const mailerService = resolveDependency(MailerService);
  return jest.spyOn(mailerService, 'sendRaw').mockImplementation(async () => {
    // do nothing
    console.debug('SEND EMAIL');
  });
};

const expectInvitations = (
  invitations: Pick<InvitationRaw, 'name' | 'permission' | 'email'>[],
  correctInvitations: (Pick<InvitationRaw, 'permission' | 'email'> & { name?: string | null })[],
) => {
  expect(invitations).toHaveLength(correctInvitations.length);
  for (const inv of invitations) {
    const correctInv = correctInvitations.find(
      ({ email }) => email.toLowerCase() === inv.email.toLowerCase(),
    );
    assertIsDefined(correctInv);
    if (correctInv.name) {
      expect(inv.name).toEqual(correctInv.name);
    }
    expect(inv.permission).toEqual(correctInv.permission);
  }
};

const buildInvitations = (nb = 1) => {
  return Array.from({ length: nb }, () => ({
    email: faker.internet.email(),
    permission: PermissionLevel.Read,
  }));
};

describe('Invitation Plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('POST /invite', () => {
    it('throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
        payload: {
          invitations: buildInvitations(),
        },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('create invitations successfully', async () => {
        const mockSendMail = mockEmail();

        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] }],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const invitationsForPayload = buildInvitations(2);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations: invitationsForPayload },
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const invitationEmails = invitationsForPayload.map((x) => x.email.toLowerCase());
        const completeInvitations = await db.query.invitationsTable.findMany({
          where: inArray(invitationsTable.email, invitationEmails),
        });
        expectInvitations(completeInvitations, invitationsForPayload);

        // check email got sent
        await new Promise((done) => {
          setTimeout(() => {
            expect(mockSendMail).toHaveBeenCalledTimes(invitationsForPayload.length);
            done(true);
          }, 2000);
        });

        // check that the invitation emails have been sent to the correct addresses
        const sentEmails = mockSendMail.mock.calls.map((x) => x[1]);
        expect(new Set(invitationEmails)).toEqual(new Set(sentEmails));
      });

      it('create memberships if member already exists', async () => {
        const {
          items: [item],
          actor,
          members: [toMember],
        } = await seedFromJson({
          members: [{ name: 'bob' }],
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const invitationsForPayload = [{ email: toMember.email, permission: PermissionLevel.Read }];
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations: invitationsForPayload },
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

        // a membership is created
        const memberships = await db.query.itemMembershipsTable.findMany({
          where: eq(itemMembershipsTable.accountId, toMember.id),
        });
        expect(memberships).toHaveLength(1);
        expect(memberships[0].permission).toEqual(PermissionLevel.Read);
        expect(memberships[0].itemPath).toEqual(item.path);

        // no invitation created
        const completeInvitation = await db.query.invitationsTable.findFirst({
          where: eq(invitationsTable.email, toMember.email),
        });
        expect(completeInvitation).toBeUndefined();
      });

      it('Throw for no invitation', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          members: [{ name: 'bob' }],
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations: [] },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('normalise emails before saving', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const invitation = {
          email: uniqueEmail(),
          permission: PermissionLevel.Read,
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations: [invitation] },
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

        const completeInvitations = await db.query.invitationsTable.findMany({
          where: eq(invitationsTable.email, invitation.email.toLowerCase()),
        });
        expectInvitations(completeInvitations, [
          { ...invitation, email: invitation.email.toLowerCase() },
        ]);
      });

      it('throws if one invitation is malformed', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const faultyInvitation = { email: 'not-correct-email', permission: PermissionLevel.Read };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations: [...buildInvitations(3), faultyInvitation] },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('throw if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/invite`,
          payload: { invitations: buildInvitations() },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('GET /:itemId/invitations', () => {
    it('throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('get invitations for item successfully', async () => {
        const {
          items: [item],
          actor,
          invitations,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}, {}, {}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations`,
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations(response.json(), invitations);
      });

      it('get invitations for parent item from child successfully', async () => {
        const {
          items: [_parent, child],
          actor,
          invitations: [parentInvitation, ...childInvitations],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
              children: [
                {
                  invitations: [{}, {}, {}],
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/invitations`,
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations(await response.json(), [parentInvitation, ...childInvitations]);
      });

      it('throw if item with invitations has been trashed', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              isDeleted: true,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations`,
        });

        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });

      it('throw if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/invitations`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('GET /invitations/:id', () => {
    it('get invitation by id successfully if signed out', async () => {
      const { invitations } = await seedFromJson({
        actor: null,
        items: [
          {
            invitations: [{}],
          },
        ],
      });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/invitations/${invitations[0].id}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expectInvitations([response.json()], [invitations[0]]);
    });
    describe('Signed In', () => {
      it('get invitation by id successfully', async () => {
        const { invitations, actor } = await seedFromJson({
          items: [
            {
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invitations/${invitations[0].id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations([response.json()], [invitations[0]]);
      });
      it("don't return an invitation for a trashed item", async () => {
        const { invitations, actor } = await seedFromJson({
          items: [
            {
              isDeleted: true,
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

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
      const {
        invitations,
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            invitations: [{}],
          },
        ],
      });

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
      it('update invitation successfully', async () => {
        const {
          invitations,
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = {
          permission: PermissionLevel.Admin,
          name: 'myname',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const savedInvitation = await db.query.invitationsTable.findFirst({
          where: eq(invitationsTable.id, invitations[0].id),
        });
        assertIsDefined(savedInvitation);
        expectInvitations([savedInvitation], [{ ...invitations[0], ...payload }]);
      });
      it('throw if item id is invalid', async () => {
        const { invitations, actor } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

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
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

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
        const {
          invitations,
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

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
      const {
        invitations,
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            invitations: [{}],
          },
        ],
      });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('delete invitation successfully', async () => {
        const {
          invitations,
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      });
      it('throw if item id is invalid', async () => {
        const { invitations, actor } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/invitations/${invitations[0].id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('throw if invitation id is invalid', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

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
      const {
        invitations,
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            invitations: [{}],
          },
        ],
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}/send`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('resend invitation successfully', async () => {
        const {
          invitations,
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const mockSendMail = mockEmail();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}/send`,
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        // check email got sent
        expect(mockSendMail).toHaveBeenCalled();
      });
      it('throw if item id is invalid', async () => {
        const { invitations, actor } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/invitations/${invitations[0].id}/send`,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('throw if invitation id is invalid', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              invitations: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/invalid-id/send`,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('POST /:itemId/invitations/upload-csv', () => {
    it('throws if signed out', async () => {
      const form = createFormData('users.csv');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/invitations/upload-csv`,
        payload: form,
        headers: form.getHeaders(),
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('upload csv successfully', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const mailerService = resolveDependency(MailerService);
        const mockSendEmail = jest.spyOn(mailerService, 'send');

        const form = createFormData('users.csv');
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/upload-csv`,
          payload: form,
          headers: form.getHeaders(),
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        // no membership created
        const memberships = await db.query.itemMembershipsTable.findMany({
          where: eq(itemMembershipsTable.itemPath, item.path),
        });
        expect(memberships).toHaveLength(1); // contains only actor membership

        // send invitations
        for (const email of ['alice@graasp.org', 'clarisse@graasp.org']) {
          expect(mockSendEmail).toHaveBeenCalledWith(expect.anything(), email);
        }
      });
    });
  });
  describe('POST /:itemId/invitations/upload-csv-template', () => {
    it('throws if signed out', async () => {
      const form = createFormData('users-groups.csv');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/invitations/upload-csv-template`,
        query: { templateId: v4() },
        payload: form,
        headers: form.getHeaders(),
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('upload csv successfully', async () => {
        const {
          actor,
          items: [item, templateItem],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const mailerService = resolveDependency(MailerService);
        const mockSendEmail = jest.spyOn(mailerService, 'send');
        const form = createFormData('users-groups.csv');
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/upload-csv-template`,
          query: { templateId: templateItem.id },
          payload: form,
          headers: form.getHeaders(),
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);

        // no membership created
        const memberships = await db.query.itemMembershipsTable.findMany({
          where: eq(itemMembershipsTable.itemPath, item.path),
        });
        expect(memberships).toHaveLength(1); // get actor membership

        // send invitations
        for (const email of ['alice@graasp.org', 'bob@graasp.org']) {
          expect(mockSendEmail).toHaveBeenCalledWith(expect.anything(), email);
        }
      });
      it('throw if csv does not have group name column', async () => {
        const {
          actor,
          items: [item, templateItem],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const form = createFormData('users.csv');
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/upload-csv-template`,
          query: { templateId: templateItem.id },
          payload: form,
          headers: form.getHeaders(),
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        expect(response.json().code).toEqual(new MissingGroupColumnInCSVError().code);
      });
    });
  });
  describe('Hook', () => {
    it('remove invitation on member registration and create memberships successfully', async () => {
      const {
        actor,
        items: [item],
        invitations: [invitation],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            invitations: [{}],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      // register
      await app.inject({
        method: HttpMethod.Post,
        url: '/api/register',
        payload: { email: invitation.email, name: 'some-name', captcha: MOCK_CAPTCHA },
      });
      const member = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.email, invitation.email),
      });
      assertIsDefined(member);

      // invitations should be removed and memberships created
      await new Promise((done) => {
        setTimeout(async () => {
          // invitation is deleted
          const savedInvitation = await db.query.invitationsTable.findFirst({
            where: eq(invitationsTable.id, invitation.id),
          });
          expect(savedInvitation).toBeFalsy();

          // membership has been created
          const membership = await db.query.itemMembershipsTable.findFirst({
            where: and(
              eq(itemMembershipsTable.permission, invitation.permission),
              eq(itemMembershipsTable.accountId, member.id),
              eq(itemMembershipsTable.itemPath, item.path),
            ),
          });
          expect(membership).toBeTruthy();
          done(true);
        }, 1000);
      });
    });
    it('does not throw if no invitation found on register', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            invitations: [{}],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      // register
      await app.inject({
        method: HttpMethod.Post,
        url: '/api/register',
        payload: { email: faker.internet.email(), name: 'some-name', captcha: MOCK_CAPTCHA },
      });
      await new Promise((done) => {
        setTimeout(async () => {
          // all invitations and memberships should still exist
          expect(
            await db.query.invitationsTable.findMany({
              where: eq(invitationsTable.itemPath, item.path),
            }),
          ).toHaveLength(1);
          expect(
            await db.query.itemMembershipsTable.findMany({
              where: eq(itemMembershipsTable.itemPath, item.path),
            }),
          ).toHaveLength(1);
          done(true);
        }, 1000);
      });
    });
  });
});
