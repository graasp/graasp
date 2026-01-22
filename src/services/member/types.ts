import { AccountType, type CompleteMember, DEFAULT_LANG } from '@graasp/sdk';

import { membersView } from '../../drizzle/schema';
import type { MaybeUser, MemberInfo, MinimalMember } from '../../types';

export type Member = {
  id: string;
  name: string;
};

export type NotificationFrequency = 'always' | 'never';

// TODO: move the member extra type here, so we have control over it
export type MemberExtra = CompleteMember['extra'] & {
  emailFreq?: NotificationFrequency;
};

export type CurrentMember = {
  id: string;
  name: string;
  email: string;
  type: AccountType.Individual;
  isValidated: boolean;
  lang: string;
  createdAt: string;
  updatedAt: string;
  lastAuthenticatedAt: string | null;
  userAgreementsDate: string | null;
  extra: MemberExtra;
  enableSaveActions: boolean;
  communicationSubscribedAt: string | null;
  // add any necessary properties here
};

type PublicMember = {
  id: string;
  name: string;
  // TODO: this should be removed as soon as possible as we do not want to leak such info.
  email: string;
};

type MemberInput = typeof membersView.$inferSelect;

export class MemberDTO {
  private readonly member: MemberInput;

  constructor(member: MemberInput) {
    this.member = member;
  }

  get id() {
    return this.member.id;
  }

  get email() {
    // HACK: This should be removed when we make the member email be non-nullable
    if (!this.member.email) {
      throw new Error(
        'member should have defined email, expected to have defined, found undefined',
      );
    }
    return this.member.email;
  }

  toMaybeUser(): MaybeUser {
    return this.toMinimal();
  }

  toMinimal(): MinimalMember {
    return {
      id: this.member.id,
      name: this.member.name,
      type: AccountType.Individual,
      isValidated: this.member.isValidated ?? false,
    };
  }

  toMemberInfo(): MemberInfo {
    return {
      id: this.member.id,
      name: this.member.name,
      type: AccountType.Individual,
      isValidated: this.member.isValidated ?? false,
      // HACK: email should always exist but the columns is not marked as nonNull
      email: this.member.email!,
      lang: this.member.extra.lang ?? DEFAULT_LANG,
      enableSaveActions: this.member.enableSaveActions,
    };
  }

  toCurrent(): CurrentMember {
    return {
      id: this.member.id,
      name: this.member.name,
      type: AccountType.Individual,
      isValidated: this.member.isValidated ?? false,
      // HACK: email should always exist but the columns is not marked as nonNull
      email: this.member.email!,
      lang: this.member.extra.lang ?? DEFAULT_LANG,
      createdAt: this.member.createdAt,
      updatedAt: this.member.updatedAt,
      lastAuthenticatedAt: this.member.lastAuthenticatedAt,
      userAgreementsDate: this.member.userAgreementsDate,
      extra: this.member.extra,
      // TODO: what should be the default for this ? Why could it be null ? can we enforce a value ??
      enableSaveActions: this.member.enableSaveActions ?? true,
      communicationSubscribedAt: this.member.communicationSubscribedAt,
    };
  }

  toPublicMember(): PublicMember {
    return {
      id: this.member.id,
      name: this.member.name,
      email: this.email,
    };
  }
}
