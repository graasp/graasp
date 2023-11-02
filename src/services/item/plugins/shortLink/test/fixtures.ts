import { ClientHostManager, Context, HttpMethod, PermissionLevel } from '@graasp/sdk';

import {
  saveItemAndMembership,
  saveMembership,
} from '../../../../itemMembership/test/fixtures/memberships';
import { Member } from '../../../../member/entities/member';
import { getDummyItem } from '../../../test/fixtures/items';
import { setItemPublic } from '../../itemTag/test/fixtures';
import { SHORT_LINKS_FULL_PREFIX, SHORT_LINKS_LIST_ROUTE } from '../service';

export const MOCK_ALIAS = 'mocked-alias';
export const MOCK_PLATFORM = Context.Player;
export const MOCK_ITEM_ID = '1c21f7f8-1917-4dfc-82b6-21d7136812e8';

type MemberWithPermission = {
  member: Member;
  permission: PermissionLevel;
};

/**
 * Insert a new mocked item and optionaly give permissions to a given member.
 *
 * @param itemCreator the Member who creates the item.
 * @param memberWithPermission optional Member and permission to give access to item.
 * @param permission the permission to give to the member if not null.
 * @param setPublic if true, set the item as public.
 * @returns
 */
export const mockItemAndMemberships = async ({
  itemCreator,
  memberWithPermission,
  setPublic = false,
}: {
  itemCreator: Member;
  memberWithPermission?: MemberWithPermission;
  setPublic?: boolean;
}) => {
  const { item } = await saveItemAndMembership({
    item: getDummyItem(),
    member: itemCreator,
  });

  if (memberWithPermission) {
    const { member, permission } = memberWithPermission;
    await saveMembership({ item, member, permission });
  }

  if (setPublic) {
    await setItemPublic(item, itemCreator);
  }

  return { item };
};

const shortLinkUrl = (shortLinkId) => {
  return `${SHORT_LINKS_FULL_PREFIX}/${shortLinkId}`;
};

export const injectGet = async (app, shortLinkId) => {
  return app.inject({
    method: HttpMethod.GET,
    url: shortLinkUrl(shortLinkId),
  });
};

export const injectGetAvailable = async (app, alias) => {
  return app.inject({
    method: HttpMethod.GET,
    url: `${SHORT_LINKS_FULL_PREFIX}/available/${alias}`,
  });
};

export const injectGetAll = async (app, itemId) => {
  return app.inject({
    method: HttpMethod.GET,
    url: `${SHORT_LINKS_FULL_PREFIX}${SHORT_LINKS_LIST_ROUTE}/${itemId}`,
  });
};

export const injectPost = async (app, payload?) => {
  return app.inject({ method: HttpMethod.POST, url: SHORT_LINKS_FULL_PREFIX, payload });
};

export const injectPatch = async (app, shortLinkId, payload?) => {
  return app.inject({ method: HttpMethod.PATCH, url: shortLinkUrl(shortLinkId), payload });
};

export const injectDelete = async (app, shortLinkId) => {
  return app.inject({ method: HttpMethod.DELETE, url: shortLinkUrl(shortLinkId) });
};

export const logOut = (app) => {
  jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
    delete request.member;
  });
  jest.spyOn(app, 'attemptVerifyAuthentication').mockImplementation(async (request: any) => {
    delete request.session.member;
    delete request.member;
  });
};

export const logInAs = async (app, member) => {
  jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
    request.member = member;
  });
  jest.spyOn(app, 'attemptVerifyAuthentication').mockImplementation(async (request: any) => {
    request.session.set('member', member.id);
    request.member = member;
  });
};

export function getRedirection(itemId: string, platform: Context) {
  const clientHostManager = ClientHostManager.getInstance();

  return clientHostManager.getItemLink(platform, itemId);
}
