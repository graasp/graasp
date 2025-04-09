import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

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

  describe('GET /item-memberships?itemId=<itemId>', () => {
    it('Returns error if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/item-memberships?itemId=${item.id}`,
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
          url: `/item-memberships?itemId=${item.id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        const data = response.json();
        for (const m of itemMemberships) {
          const im = data.find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(im, m);
        }
      });
      // WE DO NOT WANT TO SUPPORT GET MANY ANYMORE
      // it('Returns successfully for two ids', async () => {
      //   const {
      //     actor,
      //     items: [item1, item2],
      //     itemMemberships,
      //   } = await seedFromJson({
      //     items: [
      //       { memberships: [{ account: 'actor' }, { account: { name: 'bob' } }] },
      //       { memberships: [{ account: 'actor' }, { account: { name: 'bob' } }] },
      //     ],
      //   });
      //   assertIsDefined(actor);
      //   assertIsMember(actor);
      //   mockAuthenticate(actor);

      //   const response = await app.inject({
      //     method: HttpMethod.Get,
      //     url: `/item-memberships?itemId=${item1.id}&itemId=${item2.id}`,
      //   });
      //   expect(response.statusCode).toBe(StatusCodes.OK);
      //   const data = response.json();

      //   for (const m of itemMemberships) {
      //     const im = data.find(({ id }) => id === m.id);
      //     expect(im).toBeTruthy();
      //     expectMembership(im, m);
      //   }
      // });
      //     it('Nested usecase', async () => {
      //       // A (Membership)
      //       // |-> B
      //       //     |-> C (Membership)
      //       //         |-> D
      //       //             |-> E (Membership)

      //       const {
      //         actor,
      //         items: [_itemA, itemB, _itemC, itemD, itemE, item2],
      //         itemMemberships: [im1, im2, im3, im4, im5],
      //       } = await seedFromJson({
      //         items: [
      //           {
      //             name: 'A',
      //             memberships: [
      //               { account: 'actor', permission: PermissionLevel.Read },
      //               { account: { name: 'bob' } },
      //             ],
      //             children: [
      //               {
      //                 name: 'B',
      //                 children: [
      //                   {
      //                     name: 'C',
      //                     memberships: [
      //                       { account: 'actor', permission: PermissionLevel.Write },
      //                       { account: { name: 'bob' } },
      //                     ],
      //                     children: [
      //                       {
      //                         name: 'D',
      //                         children: [
      //                           {
      //                             name: 'E',
      //                             memberships: [
      //                               { account: 'actor', permission: PermissionLevel.Admin },
      //                               { account: { name: 'bob' } },
      //                             ],
      //                           },
      //                         ],
      //                       },
      //                     ],
      //                   },
      //                 ],
      //               },
      //             ],
      //           },
      //           // actor cannot access
      //           { name: '2', memberships: [{ account: { name: 'bob' } }] },
      //         ],
      //       });
      //       assertIsDefined(actor);
      //       assertIsMember(actor);
      //       mockAuthenticate(actor);
      //       const memberships1 = [im1, im2];
      //       const memberships2 = [im3];
      //       const memberships3 = [im4, im5];
      //       const response = await app.inject({
      //         method: HttpMethod.Get,
      //         url: `/item-memberships?itemId=${item2.id}&itemId=${itemB.id}&itemId=${itemD.id}&itemId=${itemE.id}`,
      //       });
      //       const { data, errors } = response.json();

      //       expect(Object.keys(data)).toHaveLength(3);
      //       expect(Object.keys(data)).not.toContain(item2.id);
      //       expect(errors).toHaveLength(1);
      //       expect(response.statusCode).toBe(StatusCodes.OK);

      //       for (const m of memberships1) {
      //         const im = data[itemB.id].find(({ id }) => id === m.id);
      //         expect(im).toBeTruthy();
      //         expectMembership(im, m, actor);
      //       }
      //       for (const m of memberships2) {
      //         const im = data[itemD.id].find(({ id }) => id === m.id);
      //         expect(im).toBeTruthy();
      //         expectMembership(im, m, actor);
      //       }
      //       for (const m of memberships3) {
      //         const im = data[itemE.id].find(({ id }) => id === m.id);
      //         expect(im).toBeTruthy();
      //         expectMembership(im, m, actor);
      //       }
      //     });
      it('Bad request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/item-memberships?itemId=invalid-id',
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
          url: `/item-memberships?itemId=${itemId}`,
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
          url: `/item-memberships?itemId=${item.id}`,
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
          url: `/item-memberships?itemId=${item.id}`,
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
  describe('POST /item-memberships', () => {
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
        url: `/item-memberships?itemId=${item.id}`,
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
          url: `/item-memberships?itemId=${item.id}`,
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
          url: `/item-memberships?itemId=${parent.id}`,
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
          url: `/item-memberships?itemId=${targetItem.id}`,
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
          url: `/item-memberships?itemId=${item.id}`,
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
          url: `/item-memberships?itemId=${item.id}`,
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
          url: `/item-memberships?itemId=${id}`,
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
          url: `/item-memberships?itemId=${item.id}`,
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
  // describe('POST many /item-memberships/itemId', () => {
  //   it('Throws if signed out', async () => {
  //     const {
  //       members,
  //       items: [item],
  //     } = await seedFromJson({
  //       actor: null,
  //       members: [{}],
  //       items: [{}],
  //     });

  //     const response = await app.inject({
  //       method: HttpMethod.Post,
  //       url: `/item-memberships/${item.id}`,
  //       payload: {
  //         memberships: [
  //           {
  //             accountId: members[0].id,
  //             itemId: item.id,
  //             permission: PermissionLevel.Write,
  //           },
  //         ],
  //       },
  //     });
  //     expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  //   });
  // describe('Signed In', () => {
  //   it('Create new memberships successfully', async () => {
  //     const mailerService = resolveDependency(MailerService);
  //     const notificationMock = jest.spyOn(mailerService, 'sendRaw');
  //     const {
  //       actor,
  //       members: [member1, member2],
  //       items: [item],
  //     } = await seedFromJson({
  //       members: [{}, {}],
  //       items: [
  //         {
  //           memberships: [{ account: 'actor' }],
  //         },
  //       ],
  //     });
  //     assertIsDefined(actor);
  //     assertIsMember(actor);
  //     mockAuthenticate(actor);
  //     expect(await getMembershipsByItemPath(item.path)).toHaveLength(1);

  //     const members = [member1, member2];
  //     const newMemberships = [
  //       { accountId: member1.id, permission: PermissionLevel.Read },
  //       { accountId: member2.id, permission: PermissionLevel.Write },
  //     ];
  //     const response = await app.inject({
  //       method: HttpMethod.Post,
  //       url: `/item-memberships/${item.id}`,
  //       payload: { memberships: newMemberships },
  //     });
  //     expect(response.statusCode).toBe(StatusCodes.OK);

  //     expect(await getMembershipsByItemPath(item.path)).toHaveLength(3);
  //     const savedMemberships = await getMembershipsByItemPath(item.path);
  //     newMemberships.forEach((m) => {
  //       const member = members.find(({ id: thisId }) => thisId === m.accountId);
  //       const im = savedMemberships.find(({ accountId }) => accountId === m.accountId);
  //       expect(im).toBeDefined();
  //     });
  //     expect(notificationMock).toHaveBeenCalledTimes(newMemberships.length);
  //   });
  //     it('Bad Request for invalid id', async () => {
  //       const {
  //         actor,
  //         members: [member],
  //       } = await seedFromJson({
  //         members: [{}],
  //         items: [
  //           {
  //             memberships: [{ account: 'actor' }],
  //           },
  //         ],
  //       });
  //       mockAuthenticate(actor);
  //       const id = 'invalid-id';
  //       const newMemberships = [
  //         { accountId: member.id, permission: PermissionLevel.Read },
  //         { accountId: member.id, permission: PermissionLevel.Write },
  //       ];
  //       const response = await app.inject({
  //         method: HttpMethod.Post,
  //         url: `/item-memberships/${id}`,
  //         payload: { memberships: newMemberships },
  //       });
  //       expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
  //       expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
  //     });
  //     it('Return error array for invalid payload', async () => {
  //       const {
  //         actor,
  //         members: [member],
  //         items: [item],
  //       } = await seedFromJson({
  //         members: [{}],
  //         items: [
  //           {
  //             memberships: [{ account: 'actor' }],
  //           },
  //         ],
  //       });
  //       mockAuthenticate(actor);
  //       const response = await app.inject({
  //         method: HttpMethod.Post,
  //         url: `/item-memberships/${item.id}`,
  //         payload: {
  //           memberships: [
  //             {
  //               accountId: member.id,
  //               // missing permission
  //             },
  //           ],
  //         },
  //       });
  //       expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
  //       expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
  //     });
  //   });
  // });
  describe('PATCH /item-memberships/:id', () => {
    it('Throws if signed out', async () => {
      const {
        itemMemberships: [itemMembership],
      } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
      const payload = {
        permission: PermissionLevel.Write,
      };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/item-memberships/${itemMembership.id}`,
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
          url: `/item-memberships/${writeMembership.id}`,
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
          url: `/item-memberships/${membership.id}`,
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
          url: `/item-memberships/${readMembership.id}`,
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
          url: `/item-memberships/${v4()}`,
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
          url: `/item-memberships/${id}`,
          payload: { permission: PermissionLevel.Write },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      });
      it('Cannot set lower permission than inherited permission', async () => {
        const {
          actor,
          members: [member],
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
          url: `/item-memberships/${adminMembership.id}`,
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
          itemMemberships: [_actorMembership, guestMembership],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              itemLoginSchema: { guests: [{ name: faker.internet.userName() }] },
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
          url: `/item-memberships/${guestMembership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('DELETE /item-memberships/:id?purgeBelow=<boolean>', () => {
    it('Throws if signed out', async () => {
      const {
        itemMemberships: [itemMembership],
      } = await seedFromJson({
        actor: null,
        items: [{ memberships: [{ account: { name: 'bob' } }] }],
      });
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/item-memberships/${itemMembership.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('Delete successfully', async () => {
        const {
          actor,
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
          url: `/item-memberships/${membership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

        // delete only one membership -> purgeBelow = false
        expect(await getMembershipById(membership.id)).toBeUndefined();
        expect(await getMembershipById(lowerMembership.id)).toBeDefined();
      });
      it('Delete successfully with purgeBelow=true', async () => {
        const {
          actor,
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
          url: `/item-memberships/${membership.id}?purgeBelow=true`,
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
          url: `/item-memberships/${id}`,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Cannot delete membership if does not exist', async () => {
        const { actor } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const id = v4();
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${id}`,
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
          url: `/item-memberships/${membership.id}`,
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
          url: `/item-memberships/${membership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
        expect(await getMembershipById(membership.id)).toBeDefined();
      });
      it('Cannot delete last admin membership', async () => {
        const {
          actor,
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
          url: `/item-memberships/${membership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        expect(response.json()).toMatchObject(new CannotDeleteOnlyAdmin({ id: expect.anything() }));
        expect(await getMembershipById(membership.id)).toBeDefined();
      });
    });
  });
});
