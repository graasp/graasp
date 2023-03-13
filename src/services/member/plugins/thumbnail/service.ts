import { SavedMultipartFile } from '@fastify/multipart';


import { Repositories } from '../../../../util/repositories';
import { FastifyReply } from 'fastify';
import { ThumbnailService } from '../../../thumbnail/service';
import FileService from '../../../file/service';
import { MemberService } from '../../service';

export class MemberThumbnailService {
  thumbnailService: ThumbnailService;
  shouldRedirectOnDownload: boolean;
  memberService:MemberService;

  constructor( memberService: MemberService, fileService:FileService, shouldRedirectOnDownload) {
    this.shouldRedirectOnDownload = shouldRedirectOnDownload;
    this.thumbnailService = new ThumbnailService(fileService, true, 'avatars');
    this.memberService=memberService;
  }

  // upload self avatar
  async upload(actor, repositories: Repositories, file: SavedMultipartFile) {
 
    await this.thumbnailService.upload(actor,  actor.id, file);

    // update item that should have thumbnail
    await this.memberService.patch(actor, repositories, actor.id, {
      extra: { hasThumbnail: true  },
    });

  }

  // get member's avatar
  async download(actor, repositories: Repositories, { reply, size, memberId, replyUrl }:  { reply:FastifyReply, memberId:string,size:string,  replyUrl:boolean }) {

    const result = await this.thumbnailService.download(actor, {
      reply: this.shouldRedirectOnDownload ? reply : null,
      replyUrl,
      size,
      id:memberId,
    });

    return result;
  }
}
