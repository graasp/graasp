import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { itemMembershipsTable, membershipRequestsTable } from '../../drizzle/schema';
import { MailerService } from '../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../utils/assertions';
import {
  CannotDeleteOnlyAdmin,
  InvalidMembership,
  InvalidPermissionLevel,
  ItemMembershipNotFound,
  ItemNotFound,
  MemberCannotAccess,
  MemberCannotAdminItem,
  ModifyExistingMembership,
} from '../../utils/errors';
import { assertIsMember } from '../authentication';
import { expectMembership } from './test/fixtures/memberships';

const getMembershipById = async (id: string) => {
  return await db.query.itemMembershipsTable.findFirst({ where: eq(itemMembershipsTable.id, id) });
};

const getMembershipsByItemPath = async (path: string) => {
  return await db.query.itemMembershipsTable.findMany({
    where: eq(itemMembershipsTable.itemPath, path),
  });
};

describe('Membership routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });
  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  describe('GET /items/:itemId/memberships', () => {
    it('Returns error if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json().message).toEqual(new MemberCannotAccess(item.id).message);
    });

    describe('Signed In', () => {
      it('Returns successfully for one id', async () => {
        const {
          actor,
          items: [item],
          itemMemberships,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }, { account: { name: 'bob' } }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${item.id}/memberships`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        const data = response.json();
        for (const m of itemMemberships) {
          const im = data.find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(im, m);
        }
      });
      it('Bad request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/invalid-id/memberships`,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Returns error if one item is not found', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const itemId = v4();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${itemId}/memberships`,
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(response.json().message).toEqual(new ItemNotFound(itemId).message);
      });

      it('Returns error if user has no membership', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({ items: [{}] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${item.id}/memberships`,
        });
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json().message).toEqual(new MemberCannotAccess(item.id).message);
      });
    });

    describe('Public', () => {
      it('Returns successfully for one id', async () => {
        const {
          actor,
          items: [item],
          itemMemberships,
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              memberships: [{ account: 'actor' }, { account: { name: 'bob' } }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${item.id}/memberships`,
        });
        const data = response.json();
        for (const m of itemMemberships) {
          const im = data.find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(im, m);
        }
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });
  describe('POST /items/:id/memberships', () => {
    it('Throws if signed out', async () => {
      const {
        members: [member],
        items: [item],
      } = await seedFromJson({ actor: null, members: [{}], items: [{}] });
      const payload = {
        accountId: member.id,
        itemId: item.id,
        permission: PermissionLevel.Write,
      };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/memberships`,
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('Create new membership successfully', async () => {
        const mailerService = resolveDependency(MailerService);
        const notificationMock = jest.spyOn(mailerService, 'sendRaw');
        const {
          actor,
          members: [member],
          items: [item],
        } = await seedFromJson({ members: [{}], items: [{ memberships: [{ account: 'actor' }] }] });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);
        const payload = {
          accountId: member.id,
          permission: PermissionLevel.Write,
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${item.id}/memberships`,
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

        const savedMemberships = await getMembershipsByItemPath(item.path);
        expect(savedMemberships[1].permission).toEqual(payload.permission);
        expect(savedMemberships[1].accountId).toEqual(payload.accountId);
        expect(notificationMock).toHaveBeenCalled();
      });
      it('Delete successfully memberships lower in the tree ', async () => {
        const {
          actor,
          members: [member],
          items: [parent],
          itemMemberships,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              children: [
                {
                  memberships: [{ permission: PermissionLevel.Write, account: { name: 'bob' } }],
                },
              ],
            },
            // noise
            {
              memberships: [{ permission: PermissionLevel.Write, account: { name: 'bob' } }],
              children: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const newMembership = {
          permission: PermissionLevel.Admin,
          accountId: member.id,
        };
        const [_actorMembership, membership, anotherMembership] = itemMemberships;
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${parent.id}/memberships`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        // previous membership is deleted
        expect(await getMembershipById(membership.id)).toBeFalsy();
        // new membership at parent
        expect(await getMembershipsByItemPath(parent.path)).toHaveLength(2);
        // expect sibling not to be deleted
        expect(await getMembershipById(anotherMembership.id)).toBeTruthy();
      });
      it('Delete successfully Membership Request for the corresponding item and member', async () => {
        const {
          actor,
          members: [member],
          items: [parentItem, targetItem, childItem],
        } = await seedFromJson({
          items: [
            {
              membershipRequests: [{ member: { name: 'bob' } }],
              children: [
                {
                  membershipRequests: [{ member: { name: 'bob' } }],
                  children: [
                    {
                      membershipRequests: [{ member: { name: 'bob' } }],
                    },
                  ],
                },
              ],
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          accountId: member.id,
          permission: PermissionLevel.Write,
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${targetItem.id}/memberships`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
        expect(
          await db.query.membershipRequestsTable.findFirst({
            where: and(
              eq(membershipRequestsTable.memberId, member.id),
              eq(membershipRequestsTable.itemId, parentItem.id),
            ),
          }),
        ).toBeDefined();
        expect(
          await db.query.membershipRequestsTable.findFirst({
            where: and(
              eq(membershipRequestsTable.memberId, member.id),
              eq(membershipRequestsTable.itemId, targetItem.id),
            ),
          }),
        ).toBeUndefined();
        expect(
          await db.query.membershipRequestsTable.findFirst({
            where: and(
              eq(membershipRequestsTable.memberId, member.id),
              eq(membershipRequestsTable.itemId, childItem.id),
            ),
          }),
        ).toBeDefined();
      });
      it('Cannot add new membership at same item for same member', async () => {
        const {
          actor,
          members: [member],
          itemMemberships: [_actorMembership, membership],
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor' },
                { account: { name: 'bob' }, permission: PermissionLevel.Write },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        expect(await getMembershipsByItemPath(item.path)).toHaveLength(2);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${item.id}/memberships`,
          payload: {
            permission: PermissionLevel.Read,
            itemId: item.id,
            accountId: member.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        // check item membership repository contains same memberships
        expect(response.json()).toEqual(new ModifyExistingMembership({ id: membership.id }));
        expect(await getMembershipsByItemPath(item.path)).toHaveLength(2);
      });
      it('Cannot set lower permission than inherited permission', async () => {
        const {
          actor,
          members: [member],
          items: [parent, item],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor' },
                { account: { name: 'bob' }, permission: PermissionLevel.Write },
              ],
              children: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        expect(await getMembershipsByItemPath(parent.path)).toHaveLength(2);

        const newMembership = {
          permission: PermissionLevel.Read,
          accountId: member.id,
          itemId: item.id,
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${item.id}/memberships`,
          payload: newMembership,
        });

        // check item membership repository contains same memberships
        expect(await getMembershipsByItemPath(parent.path)).toHaveLength(2);
        expect(response.json()).toEqual(new InvalidMembership(newMembership));
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Bad Request for invalid id', async () => {
        const {
          actor,
          members: [member],
          items: [item],
        } = await seedFromJson({
          members: [{}],
          items: [{}],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const id = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${id}/memberships`,
          payload: {
            permission: PermissionLevel.Read,
            itemId: item.id,
            accountId: member.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(await getMembershipsByItemPath(item.path)).toHaveLength(0);
      });
      it('Bad Request for invalid payload', async () => {
        const {
          actor,
          members: [member],
          items: [item],
        } = await seedFromJson({
          members: [{}],
          items: [{}],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${item.id}/memberships`,
          payload: {
            accountId: member.id,
            // missing permission
          },
        });
        expect(await getMembershipsByItemPath(item.path)).toHaveLength(0);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('PATCH /items/:id/memberships/:id', () => {
    it('Throws if signed out', async () => {
      const {
        itemMemberships: [itemMembership],
        items: [item],
      } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
      const payload = {
        permission: PermissionLevel.Write,
      };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/${item.id}/memberships/${itemMembership.id}`,
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('Downgrading permission deletes the membership if has corresponding inherited permission', async () => {
        const {
          actor,
          items: [_parent, child],
          members: [member],
          itemMemberships: [_actorMembership, _readMembership, writeMembership],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor' },
                { account: { name: 'bob' }, permission: PermissionLevel.Read },
              ],
              children: [
                { memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Write }] },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);
        expect(await getMembershipsByItemPath(child.path)).toHaveLength(1);

        const newMembership = {
          permission: PermissionLevel.Read,
          accountId: member.id,
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${child.id}/memberships/${writeMembership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        // check contains one less membership
        expect(await getMembershipsByItemPath(child.path)).toHaveLength(0);
      });
      it('Upgrade successfully', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [_actorMembership, membership],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor' },
                { permission: PermissionLevel.Write, account: { name: 'bob' } },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);
        expect(await getMembershipsByItemPath(item.path)).toHaveLength(2);

        const newMembership = {
          permission: PermissionLevel.Admin,
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}/memberships/${membership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        // still has the same number of membership
        expect(await getMembershipsByItemPath(item.path)).toHaveLength(2);

        const savedMembership = await getMembershipById(membership.id);
        // membership has been updated
        expect(savedMembership?.permission).toEqual(newMembership.permission);
      });
      it('Delete successfully memberships lower in the tree', async () => {
        const {
          actor,
          items: [parent],
          itemMemberships: [_actorMembership, readMembership, writeMembership],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor' },
                { account: { name: 'bob' }, permission: PermissionLevel.Read },
              ],
              children: [
                {
                  memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Write }],
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);
        expect(await getMembershipsByItemPath(parent.path)).toHaveLength(2);

        const newMembership = { permission: PermissionLevel.Write };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${parent.id}/memberships/${readMembership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        // membership below does not exist
        expect(await getMembershipById(writeMembership.id)).toBeUndefined();
      });
      it('Bad request if payload is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${v4()}/memberships/${v4()}`,
          payload: { permission: 'permission' },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      });
      it('Bad request if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const id = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${id}/memberships/${id}`,
          payload: { permission: PermissionLevel.Write },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      });
      it('Cannot set lower permission than inherited permission', async () => {
        const {
          actor,
          members: [member],
          items: [_parent, child],
          itemMemberships: [_actorMembership, _writeMembership, adminMembership],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor' },
                { account: { name: 'bob' }, permission: PermissionLevel.Write },
              ],
              children: [
                {
                  memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${child.id}/memberships/${adminMembership.id}`,
          payload: {
            permission: PermissionLevel.Read,
            accountId: member.id,
          },
        });
        expect(response.json()).toEqual(new InvalidPermissionLevel(adminMembership.id));
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot modify a Guest account permission', async () => {
        const {
          actor,
          guests: [guest],
          items: [item],
          itemMemberships: [_actorMembership, guestMembership],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              itemLoginSchema: { guests: [{ name: faker.internet.username() }] },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        assertIsDefined(guest);
        mockAuthenticate(actor);

        const newMembership = {
          permission: PermissionLevel.Admin,
          accountId: guest.id,
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}/memberships/${guestMembership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('DELETE /items/:id/memberships/:id?purgeBelow=<boolean>', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
        itemMemberships: [itemMembership],
      } = await seedFromJson({
        actor: null,
        items: [{ memberships: [{ account: { name: 'bob' } }] }],
      });
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/api/items/${item.id}/memberships/${itemMembership.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('Delete successfully', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [_actorMembership, membership, lowerMembership],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor' },
                { account: { name: 'bob' }, permission: PermissionLevel.Admin },
              ],
              children: [
                { memberships: [{ permission: PermissionLevel.Admin, account: { name: 'bob' } }] },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${item.id}/memberships/${membership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

        // delete only one membership -> purgeBelow = false
        expect(await getMembershipById(membership.id)).toBeUndefined();
        expect(await getMembershipById(lowerMembership.id)).toBeDefined();
      });
      it('Delete successfully with purgeBelow=true', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [_actorMembership, membership, lowerMembership],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor' },
                { account: { name: 'bob' }, permission: PermissionLevel.Admin },
              ],
              children: [
                { memberships: [{ permission: PermissionLevel.Admin, account: { name: 'bob' } }] },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${item.id}/memberships/${membership.id}?purgeBelow=true`,
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

        // delete membership + below
        expect(await getMembershipById(membership.id)).toBeUndefined();
        expect(await getMembershipById(lowerMembership.id)).toBeUndefined();
      });
      it('Bad request if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const id = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${v4()}/memberships/${id}`,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Cannot delete membership if does not exist', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const id = v4();
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${item.id}/memberships/${id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
        expect(response.json()).toEqual(new ItemMembershipNotFound({ id }));
      });
      it('Cannot delete membership if can only read', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [_actorMembership, membership],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor', permission: PermissionLevel.Read },
                { account: { name: 'bob' } },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${item.id}/memberships/${membership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
        expect(await getMembershipById(membership.id)).toBeDefined();
      });
      it('Cannot delete membership if can only write', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [_actorMembership, membership],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor', permission: PermissionLevel.Write },
                { account: { name: 'bob' } },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${item.id}/memberships/${membership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
        expect(await getMembershipById(membership.id)).toBeDefined();
      });
      it('Cannot delete last admin membership', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [membership],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${item.id}/memberships/${membership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        expect(response.json()).toMatchObject(new CannotDeleteOnlyAdmin({ id: expect.anything() }));
        expect(await getMembershipById(membership.id)).toBeDefined();
      });
    });
  });
});
