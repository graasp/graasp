import { Readable } from 'stream';

import { Repositories } from '../../../../utils/repositories';
import FileService from '../../../file/service';
import { ThumbnailService } from '../../../thumbnail/service';
import { Actor, Member } from '../../entities/member';
import { MemberService } from '../../service';

export class MemberThumbnailService {
  thumbnailService: ThumbnailService;
  memberService: MemberService;

  constructor(memberService: MemberService, fileService: FileService) {
    this.thumbnailService = new ThumbnailService(fileService, true, 'avatars');
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
    const result = await this.thumbnailService.getUrl(actor, {
      size,
      id: memberId,
    });

    return result;
  }
}
