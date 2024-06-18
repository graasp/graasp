import { ClientHostManager, Context, HttpMethod, PermissionLevel } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member.js';
import { ItemTestUtils } from '../../../test/fixtures/items.js';
import { setItemPublic } from '../../itemTag/test/fixtures.js';
import { SHORT_LINKS_FULL_PREFIX, SHORT_LINKS_LIST_ROUTE } from '../service.js';

export const MOCK_ALIAS = 'mocked-alias';
export const MOCK_PLATFORM = Context.Player;
export const MOCK_ITEM_ID = '1c21f7f8-1917-4dfc-82b6-21d7136812e8';

type MemberWithPermission = {
  member: Member;
  permission: PermissionLevel;
};

export class ShortLinkTestUtils extends ItemTestUtils {
  /**
   * Insert a new mocked item and optionaly give permissions to a given member.
   *
   * @param itemCreator the Member who creates the item.
   * @param memberWithPermission optional Member and permission to give access to item.
   * @param permission the permission to give to the member if not null.
   * @param setPublic if true, set the item as public.
   * @returns
   */
  mockItemAndMemberships = async ({
    itemCreator,
    memberWithPermission,
    setPublic = false,
  }: {
    itemCreator: Member;
    memberWithPermission?: MemberWithPermission;
    setPublic?: boolean;
  }) => {
    const { item } = await this.saveItemAndMembership({
      member: itemCreator,
    });

    if (memberWithPermission) {
      const { member, permission } = memberWithPermission;
      await this.saveMembership({ item, member, permission });
    }

    if (setPublic) {
      await setItemPublic(item, itemCreator);
    }

    return { item };
  };
}

const shortLinkUrl = (alias) => {
  return `${SHORT_LINKS_FULL_PREFIX}/${alias}`;
};

export const injectGet = async (app, alias) => {
  return app.inject({
    method: HttpMethod.Get,
    url: shortLinkUrl(alias),
  });
};

export const injectGetShortLink = async (app, alias) => {
  return app.inject({
    method: HttpMethod.Get,
    url: `${SHORT_LINKS_FULL_PREFIX}/alias/${alias}`,
  });
};

export const injectGetAvailable = async (app, alias) => {
  return app.inject({
    method: HttpMethod.Get,
    url: `${SHORT_LINKS_FULL_PREFIX}/available/${alias}`,
  });
};

export const injectGetAll = async (app, itemId) => {
  return app.inject({
    method: HttpMethod.Get,
    url: `${SHORT_LINKS_FULL_PREFIX}${SHORT_LINKS_LIST_ROUTE}/${itemId}`,
  });
};

export const injectPost = async (app, payload?) => {
  return app.inject({ method: HttpMethod.Post, url: SHORT_LINKS_FULL_PREFIX, payload });
};

export const injectPatch = async (app, alias, payload?) => {
  return app.inject({ method: HttpMethod.Patch, url: shortLinkUrl(alias), payload });
};

export const injectDelete = async (app, alias) => {
  return app.inject({ method: HttpMethod.Delete, url: shortLinkUrl(alias) });
};

export function getRedirection(itemId: string, platform: Context) {
  const clientHostManager = ClientHostManager.getInstance();

  return clientHostManager.getItemLink(platform, itemId);
}
