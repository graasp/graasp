import { v4 } from 'uuid';

import { HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import { APPS_PUBLISHER_ID, APP_ITEMS_PREFIX } from '../../../../../utils/config';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../../../itemMembership/test/fixtures/memberships';
import { Actor, Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { setItemPublic } from '../../itemTag/test/fixtures';
import { PublisherRepository } from '../publisherRepository';
import { AppRepository } from '../repository';

export const GRAASP_PUBLISHER = {
  id: APPS_PUBLISHER_ID,
  name: 'graasp',
  origins: ['https://origin.org'],
};

export const BOB_PUBLISHER = {
  id: '13844630-eaef-4286-b12b-6fd537d33d45',
  name: 'bob',
  origins: ['https://bob.org'],
};

export const MOCK_APP_ORIGIN = 'https://app.localhost:3000';

export const buildMockAuthTokenSubject = ({ app = v4(), member = v4(), item = v4() } = {}) => ({
  item,
  member,
  app,
  origin: MOCK_APP_ORIGIN,
});
export const MOCK_CONTEXT = {
  id: v4(),
  name: 'some-name',
  path: 'some-path',
  description: 'some-description',
  type: 'some-type',
  extra: {},
  children: [
    {
      id: v4(),
      name: 'some-name',
      path: 'some-path',
      description: 'some-description',
      type: 'some-type',
    },
  ],
  members: [{ id: v4(), name: 'member-name' }],
};
export const MOCK_SETTINGS = {
  showHeader: true,
};
export const MOCK_APPS = [
  {
    id: v4(),
    name: 'some-name',
    url: GRAASP_PUBLISHER.origins[0],
    description: 'description',
    extra: {},
    publisher: GRAASP_PUBLISHER,
  },
  {
    id: v4(),
    name: 'some-name-2',
    url: BOB_PUBLISHER.origins[0],
    description: 'description',
    extra: {},
    publisher: BOB_PUBLISHER,
  },
];

export const saveApp = ({
  url,
  member,
  parentItem,
}: {
  url: string;
  member: Member;
  parentItem?: Item;
}) => {
  return saveItemAndMembership({
    item: { type: ItemType.APP, extra: { [ItemType.APP]: { url } } },
    member,
    parentItem,
  });
};

export const saveAppList = async () => {
  const ddd = await Promise.all(
    MOCK_APPS.map(async (app) => {
      await PublisherRepository.save(app.publisher);
      return AppRepository.save(app);
    }),
  );
  return ddd;
};

// save apps, app settings, and get token
export const setUp = async (
  app,
  actor: Actor | null,
  creator: Member,
  permission?: PermissionLevel,
  setPublic?: boolean,
  parentItem?: Item,
) => {
  const apps = await saveAppList();
  const chosenApp = apps[0];
  const { item } = await saveApp({ url: chosenApp.url, member: creator, parentItem });
  if (setPublic) {
    await setItemPublic(item, creator);
  }
  const appDetails = { origin: chosenApp.publisher.origins[0], key: chosenApp.key };

  // if specified, we have a complex case where actor did not create the items
  // and data, so we need to add a membership
  if (permission && actor && creator && actor !== creator) {
    await saveMembership({ item, member: actor, permission });
  }
  const response = await app.inject({
    method: HttpMethod.Post,
    url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
    payload: appDetails,
  });
  const { token } = response.json();
  return { token, item };
};

// Check that a user can't access to the app of another user using its JWT token
export const setUpForbidden = async (app, actor: Member, unauthorized: Member) => {
  const apps = await saveAppList();
  const graaspApp = apps[0];
  const unauthorizedApp = apps[1];
  const { item } = await saveApp({ url: graaspApp.url, member: actor });
  // set a read permission for the unauthorized member to check that
  // this user can't use a token generated for its app in the graaspApp
  await saveMembership({ item, member: unauthorized, permission: PermissionLevel.Read });

  await app.inject({
    method: HttpMethod.Get,
    url: '/logout',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
    request.member = unauthorized;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn(app, 'attemptVerifyAuthentication').mockImplementation(async (request: any) => {
    request.session.set('member', unauthorized.id);
    request.member = unauthorized;
  });

  const { item: item2 } = await saveApp({ url: unauthorizedApp.url, member: unauthorized });
  const appDetails = { origin: unauthorizedApp.publisher.origins[0], key: unauthorizedApp.key };

  const response = await app.inject({
    method: HttpMethod.Post,
    url: `${APP_ITEMS_PREFIX}/${item2.id}/api-access-token`,
    payload: appDetails,
  });

  const token = response.json().token;
  return { token, item };
};
