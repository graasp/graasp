import { v4 } from 'uuid';

import { HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import { APPS_PUBLISHER_ID, APP_ITEMS_PREFIX } from '../../../../../utils/config';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../../../itemMembership/test/fixtures/memberships';
import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { getDummyItem } from '../../../test/fixtures/items';
import { PublisherRepository } from '../publisherRepository';
import { AppRepository } from '../repository';

export const GRAASP_PUBLISHER = {
  id: APPS_PUBLISHER_ID,
  name: 'graasp',
  origins: ['http://origin.org'],
};

export const MOCK_APP_ORIGIN = 'http://app.localhost:3000';

export const buildMockAuthTokenSubject = ({ app = v4(), member = v4(), item = v4() } = {}) => ({
  item,
  member,
  app,
  origin: MOCK_APP_ORIGIN,
});
export const MOCK_TOKEN = 'mock-token';
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
    item: getDummyItem({ type: ItemType.APP, extra: { [ItemType.APP]: { url } } }),
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
export const setUp = async (app, actor: Member, creator?: Member, permission?: PermissionLevel) => {
  const apps = await saveAppList();
  const chosenApp = apps[0];
  const { item } = await saveApp({ url: chosenApp.url, member: creator ?? actor });
  const appDetails = { origin: chosenApp.publisher.origins[0], key: chosenApp.key };

  // if specified, we have a complex case where actor did not create the items
  // and data, so we need to add a membership
  if (permission && creator) {
    await saveMembership({ item, member: actor, permission });
  }
  const response = await app.inject({
    method: HttpMethod.POST,
    url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
    payload: appDetails,
  });
  const token = response.json().token;
  return { token, item };
};
