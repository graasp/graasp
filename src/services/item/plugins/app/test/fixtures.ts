import { v4 } from 'uuid';

import { HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import { mockAuthenticate } from '../../../../../../test/app.js';
import { AuthenticatedUser, MinimalMember } from '../../../../../types.js';
import { APPS_PUBLISHER_ID, APP_ITEMS_PREFIX } from '../../../../../utils/config.js';
import { FolderItem } from '../../../discrimination.js';
import { ItemTestUtils } from '../../../test/fixtures/items.js';
import { setItemPublic } from '../../itemVisibility/test/fixtures.js';

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

export class AppTestUtils extends ItemTestUtils {
  saveApp = ({
    url,
    member,
    parentItem,
  }: {
    url: string;
    member: MinimalMember;
    parentItem?: FolderItem;
  }) => {
    return this.saveItemAndMembership({
      item: { type: ItemType.APP, extra: { [ItemType.APP]: { url } } },
      member,
      parentItem,
    });
  };

  saveAppList = () => {
    return Promise.all(
      MOCK_APPS.map(async (app) => {
        await AppDataSource.getRepository(Publisher).save(app.publisher);
        return await AppDataSource.getRepository(App).save(app);
      }),
    );
  };

  // save apps, app settings, and get token
  setUp = async (
    app,
    actor: AuthenticatedUser,
    creator: MinimalMember,
    permission?: PermissionLevel,
    setPublic?: boolean,
    parentItem?: FolderItem,
  ) => {
    const apps = await this.saveAppList();
    const chosenApp = apps[0];
    const { item } = await this.saveApp({ url: chosenApp.url, member: creator, parentItem });
    if (setPublic) {
      await setItemPublic(item, creator);
    }
    const appDetails = { origin: chosenApp.publisher.origins[0], key: chosenApp.key };

    // if specified, we have a complex case where actor did not create the items
    // and data, so we need to add a membership
    if (permission && actor && creator && actor !== creator) {
      await this.saveMembership({ item, account: actor, permission });
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
  setUpForbidden = async (app, actor: MinimalMember, unauthorized: MinimalMember) => {
    const apps = await this.saveAppList();
    const graaspApp = apps[0];
    const unauthorizedApp = apps[1];
    const { item } = await this.saveApp({ url: graaspApp.url, member: actor });
    // set a read permission for the unauthorized member to check that
    // this user can't use a token generated for its app in the graaspApp
    await this.saveMembership({ item, account: unauthorized, permission: PermissionLevel.Read });

    await app.inject({
      method: HttpMethod.Get,
      url: '/logout',
    });

    // This will override the original session strategies to a custom one that always validate the request.
    mockAuthenticate(unauthorized);

    const { item: item2 } = await this.saveApp({ url: unauthorizedApp.url, member: unauthorized });
    const appDetails = { origin: unauthorizedApp.publisher.origins[0], key: unauthorizedApp.key };

    const response = await app.inject({
      method: HttpMethod.Post,
      url: `${APP_ITEMS_PREFIX}/${item2.id}/api-access-token`,
      payload: appDetails,
    });

    const token = response.json().token;
    return { token, item };
  };
}
