import { DEFAULT_LANG, UUID } from '@graasp/sdk';

import { CannotModifyOtherMembers, MemberAlreadySignedUp } from '../../utils/errors';
import HookManager from '../../utils/hook';
import { Repositories } from '../../utils/repositories';
import { Actor, Member } from './entities/member';

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

  async post(
    actor: Actor,
    repositories: Repositories,
    body: Pick<Member, 'email'>,
    lang = DEFAULT_LANG,
  ) {
    // actor may not exist on register

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

  async patch(
    actor: Actor,
    { memberRepository }: Repositories,
    id: UUID,
    body: Partial<Pick<Member, 'extra' | 'email' | 'name'>>,
  ) {
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
