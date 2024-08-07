import { Readable } from 'stream';
import { injectWithTransform, singleton } from 'tsyringe';

import { Repositories } from '../../../../utils/repositories';
import {
  AVATAR_THUMBNAIL_PREFIX,
  ThumbnailService,
  ThumbnailServiceTransformer,
} from '../../../thumbnail/service';
import { Actor, Member } from '../../entities/member';
import { MemberService } from '../../service';

@singleton()
export class MemberThumbnailService {
  thumbnailService: ThumbnailService;
  memberService: MemberService;

  constructor(
    memberService: MemberService,
    @injectWithTransform(ThumbnailService, ThumbnailServiceTransformer, AVATAR_THUMBNAIL_PREFIX)
    thumbnailService: ThumbnailService,
  ) {
    this.thumbnailService = thumbnailService;
    this.memberService = memberService;
  }

  // upload self avatar
  async upload(actor: Member, repositories: Repositories, file: Readable) {
    await this.thumbnailService.upload(actor, actor.id, file);

    // update item that should have thumbnail
    await this.memberService.patch(repositories, actor.id, {
      extra: { hasAvatar: true },
    });
  }

  // get member's avatar
  async getFile(
    actor: Actor,
    repositories: Repositories,
    { size, memberId }: { memberId: string; size: string },
  ) {
    const result = await this.thumbnailService.getFile(actor, {
      size,
      id: memberId,
    });

    return result;
  }
  // get member's avatar
  async getUrl(
    actor: Actor,
    repositories: Repositories,
    { size, memberId }: { memberId: string; size: string },
  ) {
    const result = await this.thumbnailService.getUrl({
      size,
      id: memberId,
    });

    return result;
  }
}
