import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import { In } from 'typeorm';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel, RecaptchaAction } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { resolveDependency } from '../../../../../di/utils';
import { AppDataSource } from '../../../../../plugins/datasource';
import { MailerService } from '../../../../../plugins/mailer/service';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { MOCK_CAPTCHA } from '../../../../auth/plugins/captcha/test/utils';
import { Item } from '../../../../item/entities/Item';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { Member } from '../../../../member/entities/member';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../../test/fixtures/items';
import { Invitation } from '../entity';

const testUtils = new ItemTestUtils();
const invitationRawRepository = AppDataSource.getRepository(Invitation);
const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);

// mock captcha
// bug: cannot reuse mockCaptchaValidation
jest.mock('node-fetch');
(fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { json: async () => ({ success: true, action: RecaptchaAction.SignUp, score: 1 }) } as any;
});

const mockEmail = () => {
  const mailerService = resolveDependency(MailerService);
  return jest.spyOn(mailerService, 'sendEmail').mockImplementation(async () => {
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
    invitationRawRepository.create({
      item,
      creator: member,
      permission: PermissionLevel.Read,
      email: faker.internet.email().toLowerCase(),
    }),
  );
  return { item, invitations };
};

const saveInvitations = async ({ member }) => {
  const { item, invitations } = await createInvitations({ member });
  for (const inv of invitations) {
    await invitationRawRepository.save(inv);
  }
  return { item, invitations };
};

describe('Invitation Plugin', () => {
  let app: FastifyInstance;
  let actor;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    actor = null;
    unmockAuthenticate();
  });

  describe('POST /invite', () => {
    it('throws if signed out', async () => {
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
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('create invitations successfully', async () => {
        const mockSendMail = mockEmail();

        const { item, invitations } = await createInvitations({ member: actor });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        const completeInvitations = await invitationRawRepository.find({
          where: { email: In(invitations.map(({ email }) => email)) },
        });
        const result = await response.json();
        expect(result.memberships).toHaveLength(0);
        expectInvitations(result.invitations, completeInvitations);

        // check email got sent
        await new Promise((done) => {
          setTimeout(() => {
            expect(mockSendMail).toHaveBeenCalledTimes(invitations.length);
            done(true);
          }, 2000);
        });
      });

      it('create memberships if member already exists', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const toMember = await saveMember();
        const invitations = [
          invitationRawRepository.create({
            item,
            creator: actor,
            permission: PermissionLevel.Read,
            email: toMember.email,
          }),
        ];

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);

        const result = await response.json();
        expect(result.memberships).toHaveLength(1);
        expect(result.memberships[0].account.id).toEqual(toMember.id);
        expect(result.memberships[0].item.id).toEqual(item.id);
        expect(result.memberships[0].permission).toEqual(PermissionLevel.Read);
        expect(result.invitations).toHaveLength(0);
      });

      it('Throw for no invitation', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations: [] },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
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
        const completeInvitations = await invitationRawRepository.find({
          where: { email: invitation.email.toLowerCase() },
        });
        const result = await response.json();
        expectInvitations(result.invitations, completeInvitations);
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
        actor = await saveMember();
        mockAuthenticate(actor);
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
          await invitationRawRepository.save(inv);
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
        const actor = await saveMember();
        mockAuthenticate(actor);
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
        const actor = await saveMember();
        mockAuthenticate(actor);
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
        const actor = await saveMember();
        mockAuthenticate(actor);
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
        const actor = await saveMember();
        mockAuthenticate(actor);
        ({ item, invitations } = await saveInvitations({ member: actor }));
      });
      it('resend invitation successfully', async () => {
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
      const actor = await saveMember();
      mockAuthenticate(actor);
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
      const member = await AppDataSource.getRepository(Member).findOneBy({ email });
      expect(member).not.toBeNull();
      // invitations should be removed and memberships created
      await new Promise((done) => {
        setTimeout(async () => {
          const savedInvitation = await invitationRawRepository.findOneBy({ id });
          expect(savedInvitation).toBeFalsy();
          const membership = await itemMembershipRawRepository.findOne({
            where: { permission, account: { id: member!.id }, item: { id: item.id } },
            relations: { account: true, item: true },
          });
          expect(membership).toBeTruthy();
          done(true);
        }, 1000);
      });
    });

    it('does not throw if no invitation found', async () => {
      const email = 'random@email.org';
      const allInvitationsCount = await invitationRawRepository.count();
      const allMembershipsCount = await itemMembershipRawRepository.count();

      // register
      await app.inject({
        method: HttpMethod.Post,
        url: '/register',
        payload: { email, name: 'some-name', captcha: MOCK_CAPTCHA },
      });

      await new Promise((done) => {
        setTimeout(async () => {
          // all invitations and memberships should exist
          expect(await invitationRawRepository.count()).toEqual(allInvitationsCount);
          expect(await itemMembershipRawRepository.count()).toEqual(allMembershipsCount);

          done(true);
        }, 1000);
      });
    });
  });
});
