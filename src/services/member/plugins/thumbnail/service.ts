import { Readable } from 'stream';
import { injectWithTransform, singleton } from 'tsyringe';

import { AccountType } from '@graasp/sdk';

import type { DBConnection } from '../../../../drizzle/db.js';
import type { MaybeUser, MinimalMember } from '../../../../types.js';
import { AccountRepository } from '../../../account/account.repository.js';
import { AccountNotFound } from '../../../account/errors.js';
import {
  AVATAR_THUMBNAIL_PREFIX,
  ThumbnailService,
  ThumbnailServiceTransformer,
} from '../../../thumbnail/service.js';
import { MemberService } from '../../member.service.js';

@singleton()
export class MemberThumbnailService {
  thumbnailService: ThumbnailService;
  memberService: MemberService;
  accountRepository: AccountRepository;

  constructor(
    memberService: MemberService,
    @injectWithTransform(ThumbnailService, ThumbnailServiceTransformer, AVATAR_THUMBNAIL_PREFIX)
    thumbnailService: ThumbnailService,
    accountRepository: AccountRepository,
  ) {
    this.thumbnailService = thumbnailService;
    this.memberService = memberService;
    this.accountRepository = accountRepository;
  }

  // upload self avatar
  async upload(db: DBConnection, actor: MinimalMember, file: Readable) {
    await this.thumbnailService.upload(actor, actor.id, file);

    // update item that should have thumbnail
    await this.memberService.patch(db, actor.id, {
      extra: { hasAvatar: true },
    });
  }

  // get member's avatar
  async getFile(
    db: DBConnection,
    actor: MaybeUser,
    { size, memberId }: { memberId: string; size: string },
  ) {
    const result = await this.thumbnailService.getFile(actor, {
      size,
      id: memberId,
    });

    return result;
  }

  // get member's avatar
  async getUrl(db: DBConnection, { size, memberId }: { memberId: string; size: string }) {
    const account = await this.accountRepository.get(db, memberId);

    if (!account.exists()) {
      throw new AccountNotFound(memberId);
    }

    // only members can upload an avatar
    if (account.type !== AccountType.Individual) {
      return null;
    }

    // member does not have avatar
    if (!account.hasAvatar) {
      return null;
    }

    const result = await this.thumbnailService.getUrl({
      size,
      id: memberId,
    });

    return result;
  }
}
