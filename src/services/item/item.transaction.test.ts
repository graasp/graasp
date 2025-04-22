import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';

import { FolderItemFactory, HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { mockAuthenticate } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { itemMembershipsTable } from '../../drizzle/schema';
import { assertIsDefined } from '../../utils/assertions';
import { assertIsMemberForTest } from '../authentication';

it('Create successfully in parallel', async () => {
  const { app } = await build();

  const { items } = await seedFromJson({
    actor: null,
    items: [
      {
        memberships: [
          {
            account: { name: 'alice' },
            permission: PermissionLevel.Admin,
          },
          {
            account: { name: 'bob' },
            permission: PermissionLevel.Read,
          },
          {
            account: { name: 'cedric' },
            permission: PermissionLevel.Admin,
          },
          {
            account: { name: 'david' },
            permission: PermissionLevel.Read,
          },
          {
            account: { name: 'elodie' },
            permission: PermissionLevel.Admin,
          },
        ],
      },
    ],
  });

  const itemMemberships = await db.query.itemMembershipsTable.findMany({
    where: eq(itemMembershipsTable.itemPath, items[0].path),
    with: { account: true },
  });

  const requests = itemMemberships.map(async ({ account }) => {
    const payload = FolderItemFactory();
    assertIsDefined(account);
    assertIsMemberForTest(account);
    mockAuthenticate(account);

    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/items',
      payload,
    });

    expect(response.statusCode).toEqual(StatusCodes.OK);
  });

  await Promise.all(requests);
});
