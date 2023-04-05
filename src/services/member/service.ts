import { DEFAULT_LANG, UUID } from '@graasp/sdk';

import { CannotModifyOtherMembers, MemberAlreadySignedUp } from '../../util/graasp-error';
import HookManager from '../../util/hook';
import { Repositories } from '../../util/repositories';
import { Actor } from './entities/member';

export class MemberService {
  hooks = new HookManager();

  async get(actor: Actor, { memberRepository }: Repositories, id: string) {
    return memberRepository.get(id);
  }

  async getMany(actor: Actor, { memberRepository }: Repositories, ids: string[]) {
    return memberRepository.getMany(ids);
  }

  async getManyByEmail(actor: Actor, { memberRepository }: Repositories, ids: string[]) {
    return memberRepository.getManyByEmail(ids);
  }

  async post(actor: Actor, repositories: Repositories, body, lang = DEFAULT_LANG) {
    if (!actor) {
      throw new Error('Cannot post new member');
    }

    const { memberRepository } = repositories;

    // The email is lowercased when the user registers
    // To every subsequents call, it is to the client to ensure the email is sent in lowercase
    // the servers always do a 1:1 match to retrieve the member by email.
    const email = body.email.toLowerCase();

    // check if member w/ email already exists
    const member = await memberRepository.getByEmail(email);

    if (!member) {
      const newMember = {
        ...body,
        extra: { lang },
      };

      const member = await memberRepository.post(newMember);

      // post hook
      await this.hooks.runPostHooks('create', actor, repositories, { member });

      return member;
    } else {
      throw new MemberAlreadySignedUp({ email });
    }

    // TODO: refactor
  }

  async patch(actor: Actor, { memberRepository }: Repositories, id: UUID, body) {
    if (!actor || actor.id !== id) {
      throw new CannotModifyOtherMembers(id);
    }

    const m = await memberRepository.get(id);
    const extra = Object.assign({}, m.extra, body?.extra);

    return memberRepository.patch(id, { name: body.name, email: body.email, extra });
  }

  async deleteOne(actor: Actor, { memberRepository }: Repositories, id: UUID) {
    if (!actor || actor.id !== id) {
      throw new CannotModifyOtherMembers(id);
    }

    return memberRepository.deleteOne(id);
  }
}
