import { PermissionLevel } from '@graasp/sdk';

import { MemberCannotAccess } from '../../../../../util/graasp-error';
import { Repositories } from '../../../../../util/repositories';
import { validatePermission } from '../../../../authorization';
import { AppSetting } from './appSettings';
import { InputAppSetting } from './interfaces/app-setting';

export class AppSettingService {
  async post(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    body: Partial<InputAppSetting>,
  ) {
    const { appSettingRepository, memberRepository, itemRepository } = repositories;
    // check member exists
    if (!memberId) {
      throw new MemberCannotAccess();
    }
    const member = await memberRepository.get(memberId);

    const item = await itemRepository.get(itemId);

    // posting an app setting is allowed to admin only
    await validatePermission(repositories, PermissionLevel.Admin, member, item);

    return appSettingRepository.post(itemId, memberId, body);
  }

  async patch(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    appSettingId: string,
    body: Partial<AppSetting>,
  ) {
    const { appSettingRepository, memberRepository, itemRepository } = repositories;
    // check member exists
    if (!memberId) {
      throw new MemberCannotAccess();
    }
    const member = await memberRepository.get(memberId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // patching requires admin rights
    await validatePermission(repositories, PermissionLevel.Admin, member, item);

    await appSettingRepository.get(appSettingId);

    return appSettingRepository.patch(itemId, appSettingId, body);
  }

  async deleteOne(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    appSettingId: string,
  ) {
    const { appSettingRepository, memberRepository, itemRepository } = repositories;
    // check member exists
    if (!memberId) {
      throw new MemberCannotAccess();
    }
    const member = await memberRepository.get(memberId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // delete an app data is allowed to admins
    await validatePermission(repositories, PermissionLevel.Admin, member, item);

    await appSettingRepository.get(appSettingId);

    return appSettingRepository.deleteOne(itemId, appSettingId);
  }

  async getForItem(memberId: string | undefined, repositories: Repositories, itemId: string) {
    const { appSettingRepository, memberRepository, itemRepository } = repositories;

    // get member if exists
    // item can be public
    const member = memberId ? await memberRepository.get(memberId) : undefined;

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // get app setting is allowed to readers
    await validatePermission(repositories, PermissionLevel.Read, member, item);

    // TODO: get only memberId or with visibility
    return appSettingRepository.getForItem(itemId);
  }
}
