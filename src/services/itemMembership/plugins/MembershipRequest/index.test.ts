import { StatusCodes } from 'http-status-codes';
import { v4 as uuid } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, MembershipRequestStatus, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { resolveDependency } from '../../../../di/utils';
import { MailerService } from '../../../../plugins/mailer/service';
import { buildRepositories } from '../../../../utils/repositories';
import { Item } from '../../../item/entities/Item';
import { ItemTestUtils } from '../../../item/test/fixtures/items';
import { Member } from '../../../member/entities/member';
import { saveMember } from '../../../member/test/fixtures/members';
import { MembershipRequestRepository } from './repository';

const testUtils = new ItemTestUtils();

function expectMemberRequestToBe(membershipRequest, member?: Member, item?: Item) {
  // There is no use to this Id since we should use the Item Id and the Member Id. This assertion check that AJV is doing his job by removing it.
  expect(membershipRequest.id).toBeUndefined();
  expect(membershipRequest.createdAt).toBeDefined();
  if (member) {
    expect(membershipRequest.member.id).toBe(member.id);
    expect(membershipRequest.member.email).toBe(member.email);
  } else {
    expect(membershipRequest.member).toBeUndefined();
  }
  if (item) {
    expect(membershipRequest.item.id).toBe(item.id);
    expect(membershipRequest.item.path).toBe(item.path);
  } else {
    expect(membershipRequest.item).toBeUndefined();
  }
}

describe('MembershipRequest', () => {
  let app: FastifyInstance;
  let member: Member;
  let creator: Member;
  let item: Item;
  let membershipRequestRepository: MembershipRequestRepository;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  beforeEach(async () => {
    member = await saveMember();
    creator = await saveMember();
    ({ item } = await testUtils.saveItemAndMembership({ member: creator }));
    ({ membershipRequestRepository } = buildRepositories());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
  });

  afterAll(async () => {
    app.close();
  });

  describe('Get All', () => {
    beforeEach(() => {
      mockAuthenticate(creator);
    });
    it('returns empty array if no requests', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequests = await response.json();
      expect(membershipRequests).toEqual([]);
    });
    it('returns array with one request', async () => {
      const member = await saveMember();
      membershipRequestRepository.post(member.id, item.id);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequests = await response.json();
      expect(membershipRequests.length).toBe(1);
      expectMemberRequestToBe(membershipRequests[0], member);
    });
    it('returns array with all requests', async () => {
      const numberOfRequests = 3;
      for (let i = 0; i < numberOfRequests; i++) {
        membershipRequestRepository.post((await saveMember()).id, item.id);
      }

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequests = await response.json();
      expect(membershipRequests.length).toBe(numberOfRequests);
    });

    it('does not returns requests of other items', async () => {
      const numberOfRequests = 3;
      for (let i = 0; i < numberOfRequests; i++) {
        membershipRequestRepository.post((await saveMember()).id, item.id);
      }
      const { item: anotherItem } = await testUtils.saveItemAndMembership({ member: creator });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${anotherItem.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequests = await response.json();
      expect(membershipRequests).toEqual([]);
    });
    it('rejects not found if item id does not exist', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${uuid()}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('rejects if item is not a folder', async () => {
      const { item: anotherItem } = await testUtils.saveItemAndMembership({
        member: creator,
        item: { type: ItemType.DOCUMENT },
      });
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${anotherItem.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('rejects forbidden if authenticated member has no permissions on the item', async () => {
      mockAuthenticate(await saveMember());
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('rejects forbidden if authenticated member is a writer of the item', async () => {
      const { item: anotherItem } = await testUtils.saveItemAndMembership({
        member: creator,
        permission: PermissionLevel.Write,
      });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${anotherItem.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('rejects unauthorized if unauthenticated', async () => {
      unmockAuthenticate();
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('Get Own', () => {
    beforeEach(() => {
      mockAuthenticate(member);
    });
    it('returns notSubmittedOrDeleted if there is no request and no item membership', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.NotSubmittedOrDeleted);
    });
    it('returns notSubmittedOrDeleted if there is no request and an item membership in parent item', async () => {
      const childItem = await testUtils.saveItem({ actor: creator, parentItem: item });
      await testUtils.saveMembership({ item, account: member });
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${childItem.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.NotSubmittedOrDeleted);
    });
    it('returns pending if there is a request', async () => {
      await membershipRequestRepository.post(member.id, item.id);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.Pending);
    });
    it('returns approved if there is an item membership', async () => {
      await testUtils.saveMembership({ item, account: member });
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.Approved);
    });
    it('returns pending if there is a request and an item membership', async () => {
      // This case should not happen because no request should be made if the member already has a membership, and
      // the request should be deleted if the member gets a membership.
      await membershipRequestRepository.post(member.id, item.id);
      await testUtils.saveMembership({ item, account: member });
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.Pending);
    });
    it('rejects if item id does not exist', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${uuid()}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('rejects if item is not a folder', async () => {
      const anotherItem = await testUtils.saveItem({
        actor: creator,
        item: { type: ItemType.DOCUMENT },
      });
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${anotherItem.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('rejects unauthorized if unauthenticated', async () => {
      unmockAuthenticate();
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('Create', () => {
    let mailerService: MailerService;
    let mockSendEmail: jest.SpyInstance;

    beforeEach(async () => {
      mailerService = resolveDependency(MailerService);
      mockSendEmail = jest.spyOn(mailerService, 'sendEmail');
    });

    it('returns valid object when successful', async () => {
      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequest = await response.json();
      expect(membershipRequest.member.id).toBe(member.id);
      expect(membershipRequest.member.email).toBe(member.email);
      expect(membershipRequest.item.id).toBe(item.id);
      expect(membershipRequest.item.path).toBe(item.path);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1]).toBe(creator.email);
    });

    it('sends email to every admins of the item and its ancestors when successful', async () => {
      const parentItem = await testUtils.saveItem({ actor: creator, parentItem: item });
      const targetItem = await testUtils.saveItem({ actor: creator, parentItem });
      const siblingItem = await testUtils.saveItem({ actor: creator, parentItem });
      const childItem = await testUtils.saveItem({ actor: creator, parentItem: targetItem });
      const uncleItem = await testUtils.saveItem({ actor: creator, parentItem: item });

      const items = [item, parentItem, targetItem, siblingItem, childItem, uncleItem];

      const preset = {
        [PermissionLevel.Admin]: 3,
        [PermissionLevel.Read]: 6,
        [PermissionLevel.Write]: 4,
      };

      for (const entry in preset) {
        const permission = entry as PermissionLevel;
        for (let i = 0; i < preset[permission]; i++) {
          for (const item of items) {
            const temporaryMember = await saveMember();
            await testUtils.saveMembership({ item, permission, account: temporaryMember });
          }
        }
      }

      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${targetItem.id}/memberships/requests`,
      });

      const expectedItems = [targetItem, parentItem, item];

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequest = await response.json();
      expectMemberRequestToBe(membershipRequest, member, targetItem);
      expect(mockSendEmail).toHaveBeenCalledTimes(
        preset[PermissionLevel.Admin] * expectedItems.length + 1, // +1 for the creator
      );
    });

    it('reject when request already exist', async () => {
      mockAuthenticate(member);

      const responseFirstPost = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(responseFirstPost.statusCode).toBe(StatusCodes.OK);
      const membershipRequest = await responseFirstPost.json();
      expectMemberRequestToBe(membershipRequest, member, item);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1]).toBe(creator.email);

      const responseSecondPost = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(responseSecondPost.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
    it('rejects when unauthenticated', async () => {
      unmockAuthenticate();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
    it('rejects when unauthenticated with non-existing item id', async () => {
      unmockAuthenticate();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${uuid()}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
    it('rejects when item does not exist', async () => {
      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${uuid()}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });

    it('rejects when item is not a folder', async () => {
      mockAuthenticate(member);
      const notAFolder = await testUtils.saveItem({
        actor: creator,
        item: { type: ItemType.DOCUMENT },
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${notAFolder.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });

    it('accepts when authenticated as the creator when there is no membership', async () => {
      const { itemMembershipRepository } = buildRepositories();
      await itemMembershipRepository.delete({ item, account: creator });
      mockAuthenticate(creator);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequest = await response.json();
      expectMemberRequestToBe(membershipRequest, creator, item);
      expect(mockSendEmail).toHaveBeenCalledTimes(0); // Because there is no admin to notify
    });
    it('rejects when authenticated as the creator with membership', async () => {
      mockAuthenticate(creator);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });

    it('rejects when already have a membership', async () => {
      await testUtils.saveMembership({
        item,
        account: member,
      });
      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
  });

  describe('Delete One', () => {
    beforeEach(async () => {
      mockAuthenticate(creator);
      await membershipRequestRepository.post(member.id, item.id);
    });

    it('returns ok with the concerned membership request', async () => {
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${item.id}/memberships/requests/${member.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequest = await response.json();
      expectMemberRequestToBe(membershipRequest, member, item);
    });

    it('rejects not found if item id does not exist', async () => {
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${uuid()}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('rejects not found if item id is not associated with member id', async () => {
      const anotherMember = await saveMember();
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${item.id}/memberships/requests/${anotherMember.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('rejects not found if member id does not exists', async () => {
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${item.id}/memberships/requests/${uuid()}`,
      });
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('rejects forbidden if authenticated member has no permissions on the item', async () => {
      mockAuthenticate(await saveMember());
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${item.id}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('rejects forbidden if authenticated member is a writer of the item', async () => {
      const writer = await saveMember();
      await testUtils.saveMembership({ item, account: writer, permission: PermissionLevel.Write });
      mockAuthenticate(writer);
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${item.id}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('rejects unauthorized if unauthenticated', async () => {
      unmockAuthenticate();
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${item.id}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('rejects unauthorized if unauthenticated with non-existing ids', async () => {
      unmockAuthenticate();
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${uuid()}/memberships/requests/${uuid()}`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });
});
