import { faker } from '@faker-js/faker';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { DiscriminatedItem, HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { resolveDependency } from '../../../di/utils';
import { AppDataSource } from '../../../plugins/datasource';
import { MailerService } from '../../../plugins/mailer/mailer.service';
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
import { ItemTestUtils } from '../../item/test/fixtures/items';
import { saveItemLoginSchema } from '../../itemLogin/test/index.test';
import { Member } from '../../member/entities/member';
import { saveMember } from '../../member/test/fixtures/members';
import { ItemMembership } from '../entities/ItemMembership';
import { MembershipRequestRepository } from '../plugins/MembershipRequest/repository';
import { ItemMembershipRepository } from '../repository';
import { expectMembership } from './fixtures/memberships';

const testUtils = new ItemTestUtils();
const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);
const membershipRequestRepository = new MembershipRequestRepository();
const itemMembershipRepository = new ItemMembershipRepository();

describe('Membership routes tests', () => {
  let app: FastifyInstance;
  let actor: Member | undefined;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = undefined;
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
        const membership = await testUtils.saveMembership({ item, account: member });

        const memberships = [itemMembership, membership];

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/item-memberships?itemId=${item.id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const { data, errors } = response.json();

        for (const m of memberships) {
          const im = data[item.id].find(({ id }) => id === m.id);
          expect(im).toBeTruthy();
          expectMembership(m, im, actor);
        }
        expect(errors).toHaveLength(0);
      });
      it('Returns successfully for two ids', async () => {
        const { item: item1, itemMembership: im1 } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const { item: item2, itemMembership: im2 } = await testUtils.saveItemAndMembership({
          member: actor,
        });

        const member = await saveMember();
        const membership1 = await testUtils.saveMembership({ item: item1, account: member });
        const membership2 = await testUtils.saveMembership({ item: item2, account: member });

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
        assertIsDefined(actor);
        // A (Membership)
        // |-> B
        //     |-> C (Membership)
        //         |-> D
        //             |-> E (Membership)
        const member = await saveMember();
        const { item: itemA, itemMembership: im1 } = await testUtils.saveItemAndMembership({
          member,
        });
        const { item: item2 } = await testUtils.saveItemAndMembership({
          member,
        });
        const itemB = await testUtils.saveItem({ parentItem: itemA, actor: member });
        const itemC = await testUtils.saveItem({ parentItem: itemB, actor: member });
        const itemD = await testUtils.saveItem({ parentItem: itemC, actor: member });
        const itemE = await testUtils.saveItem({ parentItem: itemD, actor: member });

        const membership1 = await testUtils.saveMembership({
          item: itemA,
          account: actor,
          permission: PermissionLevel.Read,
        });
        const membership2 = await testUtils.saveMembership({
          item: itemC,
          account: actor,
          permission: PermissionLevel.Write,
        });
        const membership3 = await testUtils.saveMembership({
          item: itemE,
          account: actor,
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
        const membership = await testUtils.saveMembership({ item, account: member1 });

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
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('Create new membership successfully', async () => {
        assertIsDefined(actor);
        const mailerService = resolveDependency(MailerService);
        const notificationMock = jest.spyOn(mailerService, 'sendRaw');

        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const member = await saveMember();

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
        const correctMembership = { ...payload, item, account: member, creator: actor };
        expectMembership(m, correctMembership, actor);
        const savedMembership = await itemMembershipRepository.get(m.id);
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
          account: member,
        });
        const { itemMembership: anotherMembership } = await testUtils.saveItemAndMembership({
          member: actor,
        });

        const newMembership = {
          permission: PermissionLevel.Write,
          accountId: member.id,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${parent.id}`,
          payload: newMembership,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        // check item membership repository contains two memberships
        // the parent one and the new one

        expect(await itemMembershipRawRepository.count()).toEqual(4);
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
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
        const targetItem = await testUtils.saveItem({ parentItem, actor });
        const childItem = await testUtils.saveItem({ parentItem: targetItem, actor });
        const member = await saveMember();

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
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: parent,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          account: member,
        });
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
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: parent,
        });
        await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item: parent,
          account: member,
        });
        const initialCount = await itemMembershipRawRepository.count();

        const newMembership = {
          permission: PermissionLevel.Read,
          accountId: member.id,
          itemId: item.id,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/item-memberships?itemId=${newMembership.itemId}`,
          payload: newMembership,
        });

        // check item membership repository contains one membership
        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount);
        expect(response.json()).toEqual(new InvalidMembership(newMembership));
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad Request for invalid id', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
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
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
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
      ({ app } = await build({ member: null }));
      const creator = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: creator });
      const member = await saveMember();

      const payload = {
        accountId: member.id,
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
        const notificationMock = jest.spyOn(mailerService, 'sendRaw');
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const member1 = await saveMember();
        const member2 = await saveMember();
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
        const id = 'invalid-id';
        const member = await saveMember();
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
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const member = await saveMember();

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
        assertIsDefined(actor);
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const inheritedMembership = await testUtils.saveMembership({
          account: member,
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
          account: member,
        });
        const initialCount = await itemMembershipRawRepository.count();

        const newMembership = {
          permission: PermissionLevel.Read,
          accountId: member.id,
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${membership.id}`,
          payload: newMembership,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const m = response.json();

        // returns inherit permission
        expectMembership(m, {
          ...inheritedMembership,
          account: member,
          item: parent,
          creator: actor,
        });

        // check contains one less membership
        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount - 1);
      });

      it('Upgrade successfully', async () => {
        assertIsDefined(actor);
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          account: member,
        });
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
        assertIsDefined(actor);
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: parent,
        });
        const inheritedMembership = await testUtils.saveMembership({
          permission: PermissionLevel.Read,
          item: parent,
          account: member,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          account: member,
        });
        const initialCount = await itemMembershipRawRepository.count();

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
          account: member,
        });

        // membership below does not exist
        expect(await itemMembershipRawRepository.count()).toEqual(initialCount - 1);
        await itemMembershipRepository
          .get(membership.id)
          .catch((e) => expect(e).toEqual(new ItemMembershipNotFound({ id: membership.id })));
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
        await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item: parent,
          account: member,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Admin,
          item,
          account: member,
        });

        const newMembership = {
          permission: PermissionLevel.Read,
          accountId: member.id,
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/item-memberships/${membership.id}`,
          payload: newMembership,
        });

        expect(response.json()).toEqual(new InvalidPermissionLevel(membership.id));
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot modify a Guest account permission', async () => {
        assertIsDefined(actor);
        const { item } = await testUtils.saveItemAndMembership({ member: actor });

        const { guest: member } = await saveItemLoginSchema({
          item: item as unknown as DiscriminatedItem,
          memberName: faker.internet.userName(),
        });
        assertIsDefined(member);

        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          account: member,
        });
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

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        const newCount = await itemMembershipRawRepository.count();
        expect(newCount).toEqual(initialCount);
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
        assertIsDefined(actor);
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const { item: child } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: item,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Admin,
          item,
          account: member,
        });
        await testUtils.saveMembership({
          permission: PermissionLevel.Admin,
          item: child,
          account: member,
        });
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
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const { item: child } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: item,
        });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Admin,
          item,
          account: member,
        });
        await testUtils.saveMembership({
          permission: PermissionLevel.Admin,
          item: child,
          account: member,
        });
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
        assertIsDefined(actor);
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Read,
          item,
          account: actor,
        });

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
        assertIsDefined(actor);
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        const membership = await testUtils.saveMembership({
          permission: PermissionLevel.Write,
          item,
          account: actor,
        });

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
