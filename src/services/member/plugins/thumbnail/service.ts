import { WriteStream } from 'fs';

import { MultipartFile } from '@fastify/multipart';
import { FastifyReply } from 'fastify';

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
  async upload(actor: Member, repositories: Repositories, file: MultipartFile) {
    await this.thumbnailService.upload(actor, actor.id, file.file as unknown as WriteStream);

    // update item that should have thumbnail
    await this.memberService.patch(actor, repositories, actor.id, {
      extra: { hasAvatar: true },
    });
  }

  // get member's avatar
  async download(
    actor: Actor,
    repositories: Repositories,
    {
      reply,
      size,
      memberId,
      replyUrl,
    }: { reply: FastifyReply; memberId: string; size: string; replyUrl?: boolean },
  ) {
    const result = await this.thumbnailService.download(actor, {
      reply,
      replyUrl,
      size,
      id: memberId,
    });

    return result;
  }
}
