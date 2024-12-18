import { Static } from '@sinclair/typebox';

import { FastifyInstance } from 'fastify';

import {
  ClientHostManager,
  Context,
  HttpMethod,
  PermissionLevel,
  ShortLinkPlatform,
  UUID,
} from '@graasp/sdk';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemTestUtils } from '../../../test/fixtures/items';
import { setItemPublic } from '../../itemVisibility/test/fixtures';
import { createShortLink, updateShortLink } from '../schemas';
import { SHORT_LINKS_FULL_PREFIX, SHORT_LINKS_LIST_ROUTE } from '../service';

export const MOCK_ALIAS = 'mocked-alias';
export const MOCK_PLATFORM = ShortLinkPlatform.Player;
export const MOCK_ITEM_ID = '1c21f7f8-1917-4dfc-82b6-21d7136812e8';

type MemberWithPermission = {
  member: Member;
  permission: PermissionLevel;
};

export class ShortLinkTestUtils extends ItemTestUtils {
  /**
   * Insert a new mocked item and optionaly give permissions to a given member.
   *
   * @param item partial item to create.
   * @param itemCreator the Member who creates the item.
   * @param memberWithPermission optional Member and permission to give access to item.
   * @param permission the permission to give to the member if not null.
   * @param setPublic if true, set the item as public.
   * @returns
   */
  mockItemAndMemberships = async ({
    item,
    itemCreator,
    memberWithPermission,
    setPublic = false,
  }: {
    item?: Partial<Item>;
    itemCreator: Member;
    memberWithPermission?: MemberWithPermission;
    setPublic?: boolean;
  }) => {
    const { item: createdItem } = await this.saveItemAndMembership({
      item,
      member: itemCreator,
    });

    if (memberWithPermission) {
      const { member, permission } = memberWithPermission;
      await this.saveMembership({ item: createdItem, account: member, permission });
    }

    if (setPublic) {
      await setItemPublic(createdItem, itemCreator);
    }

    return { item: createdItem };
  };
}

const shortLinkUrl = (alias: string) => {
  return `${SHORT_LINKS_FULL_PREFIX}/${alias}`;
};

export const injectGet = async (app: FastifyInstance, alias: string) => {
  return app.inject({
    method: HttpMethod.Get,
    url: shortLinkUrl(alias),
  });
};

export const injectGetAvailable = async (app: FastifyInstance, alias: string) => {
  return app.inject({
    method: HttpMethod.Get,
    url: `${SHORT_LINKS_FULL_PREFIX}/available/${alias}`,
  });
};

export const injectGetAll = async (app: FastifyInstance, itemId: UUID) => {
  return app.inject({
    method: HttpMethod.Get,
    url: `${SHORT_LINKS_FULL_PREFIX}${SHORT_LINKS_LIST_ROUTE}/${itemId}`,
  });
};

export const injectPost = async (
  app: FastifyInstance,
  payload?: Static<typeof createShortLink.body>,
) => {
  return app.inject({ method: HttpMethod.Post, url: SHORT_LINKS_FULL_PREFIX, payload });
};

export const injectPatch = async (
  app: FastifyInstance,
  alias: string,
  payload?: Static<typeof updateShortLink.body>,
) => {
  return app.inject({ method: HttpMethod.Patch, url: shortLinkUrl(alias), payload });
};

export const injectDelete = async (app: FastifyInstance, alias: string) => {
  return app.inject({ method: HttpMethod.Delete, url: shortLinkUrl(alias) });
};

export function getRedirection(itemId: string, platform: Context) {
  const clientHostManager = ClientHostManager.getInstance();

  return clientHostManager.getItemLink(platform, itemId);
}
