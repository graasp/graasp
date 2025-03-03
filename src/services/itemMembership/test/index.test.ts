import { faker } from '@faker-js/faker';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { seedFromJson } from '../../../../test/mocks/seed';
import { resolveDependency } from '../../../di/utils';
import { AppDataSource } from '../../../plugins/datasource';
import { MailerService } from '../../../plugins/mailer/service';
import { assertIsDefined } from '../../../utils/assertions';
import {
  CannotDeleteOnlyAdmin,
  InvalidMembership,
  InvalidPermissionLevel,
  ItemMembershipNotFound,
  ItemNotFound,
  MemberCannotAccess,
  MemberCannotAdminItem,
  ModifyExistingMembership,
} from '../../../utils/errors';
import { setItemPublic } from '../../item/plugins/itemVisibility/test/fixtures';
import { assertIsMember } from '../../member/entities/member';
import { ItemMembership } from '../entities/ItemMembership';
import { MembershipRequestRepository } from '../plugins/MembershipRequest/repository';
import { ItemMembershipRepository } from '../repository';
import { expectMembership } from './fixtures/memberships';

const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);
const membershipRequestRepository = new MembershipRequestRepository();
const itemMembershipRepository = new ItemMembershipRepository();

describe('Membership routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('GET /item-memberships?itemId=<itemId>', () => {
    it('Returns error if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/item-memberships?itemId=${item.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json().errors[0]).toMatchObject(new MemberCannotAccess(item.id));
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
        assertIsMember(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${item.id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const { data, errors } = response.json();

        for (const m of itemMemberships) {
          const im = data[item.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(m, im, actor);
        }
        expect(errors).toHaveLength(0);
      });
      it('Returns successfully for two ids', async () => {
        const {
          actor,
          items: [item1, item2],
          itemMemberships: [im1, im2, im3, im4],
        } = await seedFromJson({
          items: [
            { memberships: [{ account: 'actor' }, { account: { name: 'bob' } }] },
            { memberships: [{ account: 'actor' }, { account: { name: 'bob' } }] },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const memberships1 = [im1, im2];
        const memberships2 = [im3, im4];

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${item1.id}&itemId=${item2.id}`,
        });
        const { data, errors } = response.json();
        for (const m of memberships1) {
          const im = data[item1.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(im, m, actor);
        }
        for (const m of memberships2) {
          const im = data[item2.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(im, m, actor);
        }
        expect(errors).toHaveLength(0);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Nested usecase', async () => {
        // A (Membership)
        // |-> B
        //     |-> C (Membership)
        //         |-> D
        //             |-> E (Membership)

        const {
          actor,
          items: [_itemA, itemB, _itemC, itemD, itemE, item2],
          itemMemberships: [im1, im2, im3, im4, im5],
        } = await seedFromJson({
          items: [
            {
              name: 'A',
              memberships: [
                { account: 'actor', permission: PermissionLevel.Read },
                { account: { name: 'bob' } },
              ],
              children: [
                {
                  name: 'B',
                  children: [
                    {
                      name: 'C',
                      memberships: [
                        { account: 'actor', permission: PermissionLevel.Write },
                        { account: { name: 'bob' } },
                      ],
                      children: [
                        {
                          name: 'D',
                          children: [
                            {
                              name: 'E',
                              memberships: [
                                { account: 'actor', permission: PermissionLevel.Admin },
                                { account: { name: 'bob' } },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            // actor cannot access
            { name: '2', memberships: [{ account: { name: 'bob' } }] },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);
        const memberships1 = [im1, im2];
        const memberships2 = [im3];
        const memberships3 = [im4, im5];
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${item2.id}&itemId=${itemB.id}&itemId=${itemD.id}&itemId=${itemE.id}`,
        });
        const { data, errors } = response.json();

        expect(Object.keys(data)).toHaveLength(3);
        expect(Object.keys(data)).not.toContain(item2.id);
        expect(errors).toHaveLength(1);
        expect(response.statusCode).toBe(StatusCodes.OK);

        for (const m of memberships1) {
          const im = data[itemB.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(im, m, actor);
        }
        for (const m of memberships2) {
          const im = data[itemD.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(im, m, actor);
        }
        for (const m of memberships3) {
          const im = data[itemE.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(im, m, actor);
        }
      });
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
        mockAuthenticate(actor);
        const itemId = v4();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${itemId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        expect(response.json().errors[0]).toMatchObject(new ItemNotFound(itemId));
      });

      it('Returns error if user has no membership', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({ items: [{}] });
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${item.id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().errors[0]).toMatchObject(new MemberCannotAccess(item.id));
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
              memberships: [{ account: 'actor' }, { account: { name: 'bob' } }],
            },
          ],
        });
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        await setItemPublic(item, actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${item.id}`,
        });
        const { data, errors } = response.json();

        for (const m of itemMemberships) {
          const im = data[item.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(m, im);
        }
        expect(errors).toHaveLength(0);
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

        const m = response.json();
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const correctMembership = { ...payload, item, account: member, creator: actor };
        expectMembership(m, correctMembership);
        const savedMembership = await itemMembershipRepository.get(m.id);
        expectMembership(savedMembership, correctMembership, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);

        expect(notificationMock).toHaveBeenCalled();
      });

      it('Delete successfully memberships lower in the tree ', async () => {
        const {
          actor,
          members,
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
        mockAuthenticate(actor);

        const member = members[0];

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

        expect(response.statusCode).toBe(StatusCodes.OK);

        // previous membership is deleted
        expect(await itemMembershipRawRepository.findOneBy({ id: membership.id })).toBeFalsy();

        expect(
          await itemMembershipRawRepository.findOneBy({ id: response.json().id }),
        ).toBeTruthy();

        // expect sibling not to be deleted
        expect(
          await itemMembershipRawRepository.findOneBy({ id: anotherMembership.id }),
        ).toBeTruthy();
      });

      it('Delete successfully Membership Request for the corresponding item and member', async () => {
        const {
          actor,
          members: [member],
          items: [parentItem, targetItem, childItem],
        } = await seedFromJson({
          members: [{}],
          items: [{ children: [{ children: [{}] }], memberships: [{ account: 'actor' }] }],
        });
        mockAuthenticate(actor);

        await membershipRequestRepository.post(member.id, parentItem.id);
        await membershipRequestRepository.post(member.id, targetItem.id);
        await membershipRequestRepository.post(member.id, childItem.id);

        const payload = {
          accountId: member.id,
          permission: PermissionLevel.Write,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${targetItem.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(await membershipRequestRepository.get(member.id, parentItem.id)).toBeDefined();
        expect(await membershipRequestRepository.get(member.id, targetItem.id)).toBeNull();
        expect(await membershipRequestRepository.get(member.id, childItem.id)).toBeDefined();
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
        mockAuthenticate(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${item.id}`,
          payload: {
            permission: PermissionLevel.Read,
            itemId: item.id,
            accountId: member.id,
          },
        });

        // check item membership repository contains one membership
        expect(response.json()).toEqual(new ModifyExistingMembership({ id: membership.id }));
        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot set lower permission than inherited permission', async () => {
        const {
          actor,
          members: [member],
          items: [_parentItem, item],
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
        mockAuthenticate(actor);

        const initialCount = await itemMembershipRawRepository.count();

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

        // check item membership repository contains one membership
        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount);
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
        mockAuthenticate(actor);

        const initialCount = await itemMembershipRawRepository.count();

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

        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
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
        mockAuthenticate(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${item.id}`,
          payload: {
            accountId: member.id,
            // missing permission
          },
        });

        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('POST many /item-memberships/itemId', () => {
    it('Throws if signed out', async () => {
      const {
        members,
        items: [item],
      } = await seedFromJson({
        actor: null,
        members: [{}],
        items: [{}],
      });
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/item-memberships/${item.id}`,
        payload: {
          memberships: [
            {
              accountId: members[0].id,
              itemId: item.id,
              permission: PermissionLevel.Write,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Create new memberships successfully', async () => {
        const mailerService = resolveDependency(MailerService);
        const notificationMock = jest.spyOn(mailerService, 'sendRaw');

        const {
          actor,
          members: [member1, member2],
          items: [item],
        } = await seedFromJson({
          members: [{}, {}],
          items: [
            {
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const members = [member1, member2];
        const newMemberships = [
          { accountId: member1.id, permission: PermissionLevel.Read },
          { accountId: member2.id, permission: PermissionLevel.Write },
        ];
        const initialCount = await itemMembershipRawRepository.count();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships/${item.id}`,
          payload: { memberships: newMemberships },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount + 2);
        const { data: savedMembershispForItem } = await itemMembershipRepository.getForManyItems([
          item,
        ]);
        const savedMemberships = savedMembershispForItem[item.id];
        newMemberships.forEach((m) => {
          const member = members.find(({ id: thisId }) => thisId === m.accountId);
          assertIsDefined(member);
          assertIsDefined(actor);
          const im = savedMemberships.find(({ account }) => account.id === m.accountId);
          const correctMembership = {
            ...m,
            item,
            creator: actor,
            account: member,
          };
          expectMembership(im, correctMembership);
        });
        expect(notificationMock).toHaveBeenCalledTimes(newMemberships.length);
      });

      it('Bad Request for invalid id', async () => {
        const {
          actor,
          members: [member],
        } = await seedFromJson({
          members: [{}],
          items: [
            {
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        mockAuthenticate(actor);

        const id = 'invalid-id';
        const newMemberships = [
          { accountId: member.id, permission: PermissionLevel.Read },
          { accountId: member.id, permission: PermissionLevel.Write },
        ];

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships/${id}`,
          payload: { memberships: newMemberships },
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Return error array for invalid payload', async () => {
        const {
          actor,
          members: [member],
          items: [item],
        } = await seedFromJson({
          members: [{}],
          items: [
            {
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships/${item.id}`,
          payload: {
            memberships: [
              {
                accountId: member.id,
                // missing permission
              },
            ],
          },
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

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
          items: [parent],
          members: [member],
          itemMemberships: [_actorMembership, readMembership, writeMembership],
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const newMembership = {
          permission: PermissionLevel.Read,
          accountId: member.id,
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${writeMembership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const m = response.json();

        // returns inherit permission
        expectMembership(m, {
          ...readMembership,
          account: member,
          item: parent,
          creator: actor,
        });

        // check contains one less membership
        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount - 1);
      });

      it('Upgrade successfully', async () => {
        const {
          actor,
          members: [member],
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const newMembership = {
          permission: PermissionLevel.Admin,
          accountId: member.id,
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${membership.id}`,
          payload: newMembership,
        });

        const m = response.json();

        expect(response.statusCode).toBe(StatusCodes.OK);
        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount);

        expectMembership(m, { ...newMembership, account: member, item, creator: actor });

        const savedMembership = await itemMembershipRepository.get(membership.id);
        expectMembership(savedMembership, {
          ...newMembership,
          account: member,
          item,
          creator: actor,
        });
      });

      it('Delete successfully memberships lower in the tree', async () => {
        const {
          actor,
          items: [parent],
          itemMemberships: [_actorMembership, readMembership, writeMembership],
          members: [member],
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const newMembership = { permission: PermissionLevel.Write };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${readMembership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check result
        expectMembership(response.json(), {
          ...newMembership,
          item: parent,
          creator: actor,
          account: member,
        });

        // membership below does not exist
        expect(await itemMembershipRawRepository.count()).toEqual(initialCount - 1);
        await itemMembershipRepository
          .get(writeMembership.id)
          .catch((e) => expect(e).toEqual(new ItemMembershipNotFound({ id: writeMembership.id })));
      });
      it('Bad request if payload is invalid', async () => {
        const { actor } = await seedFromJson();
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);
        assertIsDefined(guest);

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
          members: [member],
          items: [item],
          itemMemberships: [_actorMembership, membership],
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${membership.id}`,
        });

        const m = response.json();
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectMembership(m, { ...membership, creator: actor, account: member, item });
        // delete only one membership -> purgeBelow = false
        expect(await itemMembershipRawRepository.count()).toEqual(initialCount - 1);
      });

      it('Delete successfully with purgeBelow=true', async () => {
        const {
          actor,
          itemMemberships: [_actorMembership, membership],
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
        mockAuthenticate(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${membership.id}?purgeBelow=true`,
        });

        // delete membership + below
        expect(await itemMembershipRawRepository.count()).toEqual(initialCount - 2);

        expect(response.statusCode).toEqual(StatusCodes.OK);
      });

      it('Bad request if id is invalid', async () => {
        const { actor } = await seedFromJson();
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
        mockAuthenticate(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const id = v4();
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
        expect(response.json()).toEqual(new ItemMembershipNotFound({ id }));
        expect(await itemMembershipRawRepository.count()).toEqual(initialCount);
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${membership.id}`,
        });

        expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
        expect(await itemMembershipRawRepository.count()).toEqual(initialCount);
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
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
        mockAuthenticate(actor);

        const initialCount = await itemMembershipRawRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${membership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);

        expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
        expect(await itemMembershipRawRepository.count()).toEqual(initialCount);
      });

      it('Cannot delete last admin membership', async () => {
        const {
          actor,
          itemMemberships: [itemMembership],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${itemMembership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        const res = await response.json();
        expect(res).toMatchObject(new CannotDeleteOnlyAdmin({ id: expect.anything() }));
      });
    });
  });
});
