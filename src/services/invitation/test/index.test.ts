import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import { In } from 'typeorm';

import { HttpMethod, PermissionLevel, RecaptchaAction } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../utils/config';
import { MOCK_CAPTCHA } from '../../auth/plugins/captcha/test/utils';
import { Item } from '../../item/entities/Item';
import { ItemRepository } from '../../item/repository';
import { generateRandomEmail } from '../../itemLogin/utils';
import { ItemMembershipRepository } from '../../itemMembership/repository';
import { saveItemAndMembership } from '../../itemMembership/test/fixtures/memberships';
import { Member } from '../../member/entities/member';
import { BOB, saveMember } from '../../member/test/fixtures/members';
import { Invitation } from '../invitation';
import { InvitationRepository } from '../repository';

// mock datasource
jest.mock('../../../plugins/datasource');

// mock captcha
// bug: cannot reuse mockCaptchaValidation
jest.mock('node-fetch');
(fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
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
  const { item } = await saveItemAndMembership({ member, parentItem });
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
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item, invitations } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.POST,
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
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        const completeInvitations = await InvitationRepository.find({
          where: { email: In(invitations.map(({ email }) => email)) },
        });
        const result = await response.json();
        expectInvitations(Object.values(result.data), completeInvitations);

        // check email got sent
        await new Promise((done) => {
          setTimeout(() => {
            expect(mockSendMail).toHaveBeenCalledTimes(invitations.length);
            done(true);
          }, 2000);
        });
      });

      it('Throws if one invitation is malformed', async () => {
        const { item, invitations } = await createInvitations({ member: actor });
        const faultyInvitation = { email: 'not-correct-email', permission: PermissionLevel.Read };

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invite`,
          payload: { invitations: [...invitations, faultyInvitation] },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('throw if id is invalid', async () => {
        const { invitations } = await createInvitations({ member: actor });
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/invite`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('GET /:itemId/invitations', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.GET,
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
          method: HttpMethod.GET,
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
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/invitations`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations(await response.json(), [...invitations, ...childInvitations]);
      });

      it('Throw if item with invitations has been trashed', async () => {
        await ItemRepository.softDelete(item.id);
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });

      it('throw if id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/invitations`,
          payload: { invitations },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('GET /invitations/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);

      const { invitations } = await saveInvitations({ member });
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `${ITEMS_ROUTE_PREFIX}/invitations/${invitations[0].id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let invitations;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ invitations } = await saveInvitations({ member: actor }));
      });

      it('get invitation by id successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/invitations/${invitations[0].id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations([await response.json()], [invitations[0]]);
      });

      it("Don't return an invitation for a trashed item", async () => {
        await ItemRepository.softDelete(invitations[0].item.id);
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/invitations/${invitations[0].id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });

      it('throw if id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/invitations/invalid-id`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /:itemId/invitations/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item, invitations } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.PATCH,
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
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectInvitations([await response.json()], [{ ...invitations[0], ...payload }]);
      });

      it('throw if item id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.PATCH,
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
          method: HttpMethod.PATCH,
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
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
          payload: {},
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /:itemId/invitations/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item, invitations } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.DELETE,
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
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.body).toEqual(invitations[0].id);
      });

      it('throw if item id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/invitations/${invitations[0].id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('throw if invitation id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/invalid-id`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('POST /:itemId/invitations/:id/send', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item, invitations } = await saveInvitations({ member });

      const response = await app.inject({
        method: HttpMethod.POST,
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
      it('Resend invitation successfully', async () => {
        const mockSendMail = mockEmail(app);

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/${invitations[0].id}/send`,
        });

        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        // check email got sent
        expect(mockSendMail).toHaveBeenCalled();
      });

      it('throw if item id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/invitations/${invitations[0].id}/send`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('throw if invitation id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/invitations/invalid-id/send`,
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('Hook', () => {
    let item, invitations;

    beforeEach(async () => {
      ({ app, actor } = await build());
      ({ item, invitations } = await saveInvitations({ member: actor }));
    });

    it('Remove invitation on member registration and create memberships successfully', async () => {
      const { id, email, item, permission } = invitations[0];

      // register
      await app.inject({
        method: HttpMethod.POST,
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

    it('Does not throw if no invitation found', async () => {
      const email = 'random@email.org';
      const allInvitations = await InvitationRepository.find();
      const allMemberships = await ItemMembershipRepository.find();

      // register
      await app.inject({
        method: HttpMethod.POST,
        url: '/register',
        payload: { email, name: 'some-name', captcha: MOCK_CAPTCHA },
      });

      await new Promise((done) => {
        setTimeout(async () => {
          // all invitations and memberships should exist
          expect(await InvitationRepository.find()).toHaveLength(allInvitations.length);
          expect(await ItemMembershipRepository.find()).toHaveLength(allMemberships.length);

          done(true);
        }, 1000);
      });
    });
  });
});
