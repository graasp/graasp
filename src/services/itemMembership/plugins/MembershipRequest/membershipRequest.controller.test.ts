import { and, eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 as uuid } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, MembershipRequestStatus } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { membershipRequestsTable } from '../../../../drizzle/schema';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../../../utils/assertions';
import { assertIsMemberForTest } from '../../../authentication';
import { type ItemRaw } from '../../../item/item';

function expectMemberRequestToBe(
  membershipRequest,
  member?: { id: string; email: string },
  item?: ItemRaw,
) {
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

  describe('Get All', () => {
    it('returns empty array if no requests', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequests = await response.json();
      expect(membershipRequests).toEqual([]);
    });
    it('returns array with one request', async () => {
      const {
        actor,
        items: [item],
        members: [member],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
            membershipRequests: [{ member: { name: 'bob' } }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const membershipRequests = await response.json();
      expect(membershipRequests.length).toBe(1);
      expectMemberRequestToBe(membershipRequests[0], member);
    });
    it('returns array with all requests', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
            membershipRequests: [
              { member: { name: 'bob' } },
              { member: { name: 'alice' } },
              { member: { name: 'cedric' } },
            ],
          },
          // noise
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
            membershipRequests: [{ member: { name: 'bob' } }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const returnedValues = await response.json();
      // shoul not return other items' requests
      expect(returnedValues).toHaveLength(3);
    });

    it('rejects not found if item id does not exist', async () => {
      const { actor } = await seedFromJson({});
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${uuid()}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('rejects forbidden if authenticated member has no permissions on the item', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('rejects forbidden if authenticated member is a writer of the item', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'write' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('rejects unauthorized if unauthenticated', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('Get Own', () => {
    it('returns notSubmittedOrDeleted if there is no request and no item membership', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{}],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests/own`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.NotSubmittedOrDeleted);
    });
    it('returns notSubmittedOrDeleted if there is no request and an item membership in parent item', async () => {
      const {
        actor,
        items: [_parent, childItem],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
            children: [{}],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${childItem.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.NotSubmittedOrDeleted);
    });
    it('returns pending if there is a request', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            membershipRequests: [{ member: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.Pending);
    });
    it('returns approved if there is an item membership', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.Approved);
    });
    it('returns pending if there is a request and an item membership', async () => {
      // This case should not happen because no request should be made if the member already has a membership, and
      // the request should be deleted if the member gets a membership.
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
            membershipRequests: [{ member: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests/own`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = await response.json();
      expect(data.status).toEqual(MembershipRequestStatus.Pending);
    });
    it('rejects if item id does not exist', async () => {
      const { actor } = await seedFromJson({});
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${uuid()}/memberships/requests/own`,
      });
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('rejects unauthorized if unauthenticated', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/memberships/requests/own`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });
  describe('Create', () => {
    let mailerService: MailerService;
    let mockSendEmail: jest.SpyInstance;
    beforeEach(async () => {
      mailerService = resolveDependency(MailerService);
      mockSendEmail = jest.spyOn(mailerService, 'sendRaw');
    });
    it('returns valid object when successful and send notification to admin', async () => {
      const {
        actor,
        items: [item],
        members: [admin],
      } = await seedFromJson({
        items: [{ memberships: [{ account: { name: 'bob' }, permission: 'admin' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      const membershipRequest = await db.query.membershipRequestsTable.findFirst({
        where: and(
          eq(membershipRequestsTable.itemId, item.id),
          eq(membershipRequestsTable.memberId, actor.id),
        ),
      });
      assertIsDefined(membershipRequest);
      expect(membershipRequest.memberId).toBe(actor.id);
      expect(membershipRequest.itemId).toBe(item.id);

      // send notification to admin
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1]).toBe(admin.email);
    });
    it('sends email to every admins of the item and its ancestors when successful', async () => {
      const {
        actor,
        items: [_root, _parent, targetItem],
        members,
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
            children: [
              {
                memberships: [{ account: { name: 'alice' }, permission: 'admin' }],
                children: [
                  {
                    memberships: [
                      { account: { name: 'cedric' }, permission: 'admin' },
                      // noise
                      { account: { name: 'noise' }, permission: 'read' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      const admins = members.slice(0, 3);
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${targetItem.id}/memberships/requests`,
      });

      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      const membershipRequest = await db.query.membershipRequestsTable.findFirst({
        where: and(
          eq(membershipRequestsTable.itemId, targetItem.id),
          eq(membershipRequestsTable.memberId, actor.id),
        ),
      });
      expect(membershipRequest).toBeDefined();
      expect(mockSendEmail).toHaveBeenCalledTimes(admins.length);
    });
    it('reject when request already exist', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            membershipRequests: [{ member: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const responseSecondPost = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/memberships/requests`,
      });
      expect(responseSecondPost.statusCode).toBe(StatusCodes.BAD_REQUEST);
      // do not send email
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
    it('rejects when unauthenticated', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/memberships/requests`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
    it('rejects when unauthenticated with non-existing item id', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${uuid()}/memberships/requests`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
    it('rejects when item does not exist', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${uuid()}/memberships/requests`,
      });
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
    it('creator without membership can request membership on private item', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            creator: 'actor',
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/memberships/requests`,
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      const membershipRequest = await db.query.membershipRequestsTable.findFirst({
        where: and(
          eq(membershipRequestsTable.itemId, item.id),
          eq(membershipRequestsTable.memberId, actor.id),
        ),
      });
      expect(membershipRequest).toBeDefined();
      expect(mockSendEmail).toHaveBeenCalledTimes(0); // Because there is no admin to notify
    });
    it('creator without membership can request membership on public item', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            creator: 'actor',
            isPublic: true,
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/memberships/requests`,
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      const membershipRequest = await db.query.membershipRequestsTable.findFirst({
        where: and(
          eq(membershipRequestsTable.itemId, item.id),
          eq(membershipRequestsTable.memberId, actor.id),
        ),
      });
      expect(membershipRequest).toBeDefined();
      expect(mockSendEmail).toHaveBeenCalledTimes(0); // Because there is no admin to notify
    });
    it('rejects when already have a membership', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor' }] }],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/memberships/requests`,
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
  });
  describe('Delete One', () => {
    it('returns ok with the concerned membership request', async () => {
      const {
        actor,
        items: [item],
        members: [member],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor' }],
            membershipRequests: [{ member: { name: 'bob' } }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/api/items/${item.id}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      const membershipRequest = await db.query.membershipRequestsTable.findFirst({
        where: and(
          eq(membershipRequestsTable.itemId, item.id),
          eq(membershipRequestsTable.memberId, member.id),
        ),
      });
      expect(membershipRequest).toBeUndefined();
    });
    it('rejects not found if item id does not exist', async () => {
      const {
        actor,
        members: [member],
      } = await seedFromJson({ members: [{}] });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/api/items/${uuid()}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('rejects not found if item id is not associated with member id', async () => {
      const {
        actor,
        items: [item],
        members: [member],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor' }],
          },
        ],
        members: [{}],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/api/items/${item.id}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('rejects not found if member id does not exists', async () => {
      const {
        actor,
        items: [item],
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
        url: `/api/items/${item.id}/memberships/requests/${uuid()}`,
      });
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('rejects forbidden if authenticated member has no permissions on the item', async () => {
      const {
        actor,
        items: [item],
        members: [member],
      } = await seedFromJson({
        items: [{}],
        members: [{}],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/api/items/${item.id}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('rejects forbidden if authenticated member is a writer of the item', async () => {
      const {
        actor,
        items: [item],
        members: [member],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'write' }],
          },
        ],
        members: [{}],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/api/items/${item.id}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('rejects unauthorized if unauthenticated', async () => {
      const {
        items: [item],
        members: [member],
      } = await seedFromJson({ actor: null, items: [{}], members: [{}] });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/api/items/${item.id}/memberships/requests/${member.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('rejects unauthorized if unauthenticated with non-existing ids', async () => {
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/api/items/${uuid()}/memberships/requests/${uuid()}`,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });
});
