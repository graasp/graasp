import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { resolveDependency } from '../../../di/utils';
import { MailerService } from '../../../plugins/mailer/service';
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
import { setItemPublic } from '../../item/plugins/itemTag/test/fixtures';
import { ItemTestUtils } from '../../item/test/fixtures/items';
import { saveMember } from '../../member/test/fixtures/members';
import { ItemMembershipRepository } from '../repository';
import { expectMembership } from './fixtures/memberships';

// mock datasource
jest.mock('../../../plugins/datasource');

const testUtils = new ItemTestUtils();

describe('Membership routes tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /item-memberships?itemId=<itemId>', () => {
    it('Returns error if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/item-memberships?itemId=${item.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json().errors[0]).toMatchObject(new MemberCannotAccess(item.id));
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('Returns successfully for one id', async () => {
        const { item, itemMembership } = await testUtils.saveItemAndMembership({ member: actor });

        const member = await saveMember();
        const membership = await testUtils.saveMembership({ item, member });

        const memberships = [itemMembership, membership];

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${item.id}`,
        });
        const { data, errors } = response.json();

        for (const m of memberships) {
          const im = data[item.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(m, im, actor);
        }
        expect(errors).toHaveLength(0);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Returns successfully for two ids', async () => {
        const { item: item1, itemMembership: im1 } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const { item: item2, itemMembership: im2 } = await testUtils.saveItemAndMembership({
          member: actor,
        });

        const member = await saveMember();
        const membership1 = await testUtils.saveMembership({ item: item1, member });
        const membership2 = await testUtils.saveMembership({ item: item2, member });

        const memberships1 = [im1, membership1];
        const memberships2 = [im2, membership2];

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
        const member = await saveMember();
        const { item: itemA, itemMembership: im1 } = await testUtils.saveItemAndMembership({
          member: member,
        });
        const { item: item2 } = await testUtils.saveItemAndMembership({
          member: member,
        });
        const itemB = await testUtils.saveItem({ parentItem: itemA, actor: member });
        const itemC = await testUtils.saveItem({ parentItem: itemB, actor: member });
        const itemD = await testUtils.saveItem({ parentItem: itemC, actor: member });
        const itemE = await testUtils.saveItem({ parentItem: itemD, actor: member });

        const membership1 = await testUtils.saveMembership({
          item: itemA,
          member: actor,
          permission: PermissionLevel.Read,
        });
        const membership2 = await testUtils.saveMembership({
          item: itemC,
          member: actor,
          permission: PermissionLevel.Write,
        });
        const membership3 = await testUtils.saveMembership({
          item: itemE,
          member: actor,
          permission: PermissionLevel.Admin,
        });

        const memberships1 = [im1, membership1];
        const memberships2 = [membership2];
        const memberships3 = [membership3];

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
        await testUtils.saveItemAndMembership({ member: actor });
        const itemId = v4();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${itemId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        expect(response.json().errors[0]).toMatchObject(new ItemNotFound(itemId));
      });

      it('Returns error if user has no membership', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${item.id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().errors[0]).toMatchObject(new MemberCannotAccess(item.id));
      });
    });

    describe('Public', () => {
      beforeEach(async () => {
        ({ app } = await build());
      });
      it('Returns successfully for one id', async () => {
        const member = await saveMember();
        const { item, itemMembership } = await testUtils.saveItemAndMembership({ member });
        await setItemPublic(item, member);

        const member1 = await saveMember();
        const membership = await testUtils.saveMembership({ item, member: member1 });

        const memberships = [itemMembership, membership];

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${item.id}`,
        });
        const { data, errors } = response.json();

        for (const m of memberships) {
          const im = data[item.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(m, im, member);
        }
        expect(errors).toHaveLength(0);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });

  describe('POST /item-memberships', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const creator = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: creator });
      const member = await saveMember();

      const payload = {
        memberId: member.id,
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
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('Create new membership successfully', async () => {
        const mailerService = resolveDependency(MailerService);
        const notificationMock = jest.spyOn(mailerService, 'sendEmail');

        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const member = await saveMember();

        const payload = {
          memberId: member.id,
          itemId: item.id,
          permission: PermissionLevel.Write,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${item.id}`,
          payload,
        });

        const m = response.json();
        const correctMembership = { ...payload, item, member, creator: actor };
        expectMembership(m, correctMembership, actor);
        const savedMembership = await ItemMembershipRepository.get(m.id);
        expectMembership(savedMembership, correctMembership, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);

        expect(notificationMock).toHaveBeenCalled();
      });

      it('Delete successfully memberships lower in the tree ', async () => {
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: parent,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          member,
        });
        const { itemMembership: anotherMembership } = await testUtils.saveItemAndMembership({
          member: actor,
        });

        const newMembership = {
          permission: PermissionLevel.Write,
          itemId: parent.id,
          memberId: member.id,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${parent.id}`,
          payload: newMembership,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        // check item membership repository contains two memberships
        // the parent one and the new one

        expect(await ItemMembershipRepository.count()).toEqual(4);
        // previous membership is deleted
        expect(await ItemMembershipRepository.findOneBy({ id: membership.id })).toBeFalsy();

        expect(await ItemMembershipRepository.findOneBy({ id: response.json().id })).toBeTruthy();

        // expect sibling not to be deleted
        expect(await ItemMembershipRepository.findOneBy({ id: anotherMembership.id })).toBeTruthy();
      });

      it('Cannot add new membership at same item for same member', async () => {
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: parent,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          member,
        });
        const initialCount = await ItemMembershipRepository.count();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${item.id}`,
          payload: {
            permission: PermissionLevel.Read,
            itemId: item.id,
            memberId: member.id,
          },
        });

        // check item membership repository contains one membership
        expect(response.json()).toEqual(new ModifyExistingMembership({ id: membership.id }));
        const newCount = await ItemMembershipRepository.count();
        expect(newCount).toEqual(initialCount);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot set lower permission than inherited permission', async () => {
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: parent,
        });
        await testUtils.saveMembership({ permission: PermissionLevel.Write, item: parent, member });
        const initialCount = await ItemMembershipRepository.count();

        const newMembership = {
          permission: PermissionLevel.Read,
          memberId: member.id,
          itemId: item.id,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${newMembership.itemId}`,
          payload: newMembership,
        });

        // check item membership repository contains one membership
        const newCount = await ItemMembershipRepository.count();
        expect(newCount).toEqual(initialCount);
        expect(response.json()).toEqual(new InvalidMembership(newMembership));
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad Request for invalid id', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const initialCount = await ItemMembershipRepository.count();

        const id = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${id}`,
          payload: {
            permission: PermissionLevel.Read,
            itemId: item.id,
            memberId: member.id,
          },
        });

        const newCount = await ItemMembershipRepository.count();
        expect(newCount).toEqual(initialCount);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad Request for invalid payload', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const initialCount = await ItemMembershipRepository.count();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${item.id}`,
          payload: {
            memberId: member.id,
            // missing permission
          },
        });

        const newCount = await ItemMembershipRepository.count();
        expect(newCount).toEqual(initialCount);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('POST many /item-memberships/itemId', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const creator = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: creator });
      const member = await saveMember();

      const payload = {
        memberId: member.id,
        itemId: item.id,
        permission: PermissionLevel.Write,
      };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/item-memberships/${item.id}`,
        payload: { memberships: [payload] },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Create new memberships successfully', async () => {
        const mailerService = resolveDependency(MailerService);
        const notificationMock = jest.spyOn(mailerService, 'sendEmail');
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const member1 = await saveMember();
        const member2 = await saveMember();
        const members = [member1, member2];
        const newMemberships = [
          { memberId: member1.id, permission: PermissionLevel.Read },
          { memberId: member2.id, permission: PermissionLevel.Write },
        ];
        const initialCount = await ItemMembershipRepository.count();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships/${item.id}`,
          payload: { memberships: newMemberships },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const newCount = await ItemMembershipRepository.count();
        expect(newCount).toEqual(initialCount + 2);
        const { data: savedMembershispForItem } = await ItemMembershipRepository.getForManyItems([
          item,
        ]);
        const savedMemberships = savedMembershispForItem[item.id];

        newMemberships.forEach((m) => {
          const im = savedMemberships.find(({ member }) => member.id === m.memberId);
          const correctMembership = {
            ...m,
            item,
            creator: actor,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            member: members.find(({ id: thisId }) => thisId === m.memberId)!,
          };
          expectMembership(im, correctMembership);
        });
        expect(notificationMock).toHaveBeenCalledTimes(newMemberships.length);
      });

      it('Bad Request for invalid id', async () => {
        const id = 'invalid-id';
        const member = await saveMember();
        const newMemberships = [
          { memberId: member.id, permission: PermissionLevel.Read },
          { memberId: member.id, permission: PermissionLevel.Write },
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
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const member = await saveMember();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships/${item.id}`,
          payload: {
            memberships: [
              {
                memberId: member.id,
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
      ({ app } = await build({ member: null }));
      const creator = await saveMember();
      const { itemMembership } = await testUtils.saveItemAndMembership({ member: creator });

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
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Downgrading permission deletes the membership if has corresponding inherited permission', async () => {
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const inheritedMembership = await testUtils.saveMembership({
          member,
          item: parent,
          permission: PermissionLevel.Read,
        });

        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: parent,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          member,
        });
        const initialCount = await ItemMembershipRepository.count();

        const newMembership = {
          permission: PermissionLevel.Read,
          memberId: member.id,
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${membership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const m = response.json();

        // returns inherit permission
        expectMembership(m, { ...inheritedMembership, member, item: parent, creator: actor });

        // check contains one less membership
        const newCount = await ItemMembershipRepository.count();
        expect(newCount).toEqual(initialCount - 1);
      });

      it('Upgrade successfully', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          member,
        });
        const initialCount = await ItemMembershipRepository.count();

        const newMembership = {
          permission: PermissionLevel.Admin,
          memberId: member.id,
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${membership.id}`,
          payload: newMembership,
        });

        const m = response.json();

        expect(response.statusCode).toBe(StatusCodes.OK);
        const newCount = await ItemMembershipRepository.count();
        expect(newCount).toEqual(initialCount);

        expectMembership(m, { ...newMembership, member, item, creator: actor });

        const savedMembership = await ItemMembershipRepository.get(membership.id);
        expectMembership(savedMembership, { ...newMembership, member, item, creator: actor });
      });

      it('Delete successfully memberships lower in the tree', async () => {
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: parent,
        });
        const inheritedMembership = await testUtils.saveMembership({
          permission: PermissionLevel.Read,
          item: parent,
          member,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          member,
        });
        const initialCount = await ItemMembershipRepository.count();

        const newMembership = { permission: PermissionLevel.Write };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${inheritedMembership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check result
        expectMembership(response.json(), {
          ...newMembership,
          item: parent,
          creator: actor,
          member,
        });

        // membership below does not exist
        expect(await ItemMembershipRepository.count()).toEqual(initialCount - 1);
        ItemMembershipRepository.get(membership.id).catch((e) =>
          expect(e).toEqual(new ItemMembershipNotFound({ id: membership.id })),
        );
      });
      it('Bad request if payload is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${v4()}`,
          payload: { permission: 'permission' },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      });

      it('Bad request if id is invalid', async () => {
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
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: parent,
        });
        await testUtils.saveMembership({ permission: PermissionLevel.Write, item: parent, member });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Admin,
          item,
          member,
        });

        const newMembership = {
          permission: PermissionLevel.Read,
          memberId: member.id,
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${membership.id}`,
          payload: newMembership,
        });

        expect(response.json()).toEqual(new InvalidPermissionLevel(membership.id));
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /item-memberships/:id?purgeBelow=<boolean>', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const creator = await saveMember();
      const { itemMembership } = await testUtils.saveItemAndMembership({ member: creator });
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/item-memberships/${itemMembership.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Delete successfully', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const { item: child } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: item,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Admin,
          item,
          member,
        });
        await testUtils.saveMembership({ permission: PermissionLevel.Admin, item: child, member });
        const initialCount = await ItemMembershipRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${membership.id}`,
        });

        const m = response.json();
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectMembership(m, { ...membership, creator: actor, member, item });
        // delete only one membership -> purgeBelow = false
        expect(await ItemMembershipRepository.count()).toEqual(initialCount - 1);
      });

      it('Delete successfully with purgeBelow=true', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const { item: child } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: item,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Admin,
          item,
          member,
        });
        await testUtils.saveMembership({ permission: PermissionLevel.Admin, item: child, member });
        const initialCount = await ItemMembershipRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${membership.id}?purgeBelow=true`,
        });

        // delete membership + below
        expect(await ItemMembershipRepository.count()).toEqual(initialCount - 2);

        expect(response.statusCode).toEqual(StatusCodes.OK);
      });

      it('Bad request if id is invalid', async () => {
        const id = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${id}`,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Cannot delete membership if does not exist', async () => {
        await testUtils.saveItemAndMembership({ member: actor });
        const initialCount = await ItemMembershipRepository.count();

        const id = v4();
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${id}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
        expect(response.json()).toEqual(new ItemMembershipNotFound({ id }));
        expect(await ItemMembershipRepository.count()).toEqual(initialCount);
      });

      it('Cannot delete membership if can only read', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Read,
          item,
          member: actor,
        });

        const initialCount = await ItemMembershipRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${membership.id}`,
        });

        expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
        expect(await ItemMembershipRepository.count()).toEqual(initialCount);
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });

      it('Cannot delete membership if can only write', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          member: actor,
        });

        const initialCount = await ItemMembershipRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/item-memberships/${membership.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);

        expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
        expect(await ItemMembershipRepository.count()).toEqual(initialCount);
      });

      it('Cannot delete last admin membership', async () => {
        const { itemMembership } = await testUtils.saveItemAndMembership({ member: actor });

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
