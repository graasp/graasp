import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { EMAIL_CHANGE_JWT_SECRET } from '../../../../../config/secrets';
import { db } from '../../../../../drizzle/db';
import { MemberNotFound, UnauthorizedMember, buildError } from '../../../../../utils/errors';
import { MemberRepository } from '../../../../member/member.repository';
import { PassportStrategy } from '../strategies';
import type { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  memberRepository: MemberRepository,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.EmailChange,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: EMAIL_CHANGE_JWT_SECRET,
      },
      async (
        {
          uuid,
          oldEmail,
          newEmail: newEmailRaw,
        }: { uuid: string; oldEmail: string; newEmail: string },
        done: StrictVerifiedCallback,
      ) => {
        try {
          const newEmail = newEmailRaw.toLowerCase();
          // We shouldn't fetch the member by email, so we keep track of the actual member.
          const member = await memberRepository.get(db, uuid);
          // We check the email, so we invalidate the token if the email has changed in the meantime.
          if (member && member.email === oldEmail) {
            // Token has been validated
            return done(null, {
              account: member.toMaybeUser(),
              emailChange: { newEmail },
            });
          } else {
            // Authentication refused
            return done(
              options?.propagateError ? new MemberNotFound({ id: uuid }) : new UnauthorizedMember(),
              false,
            );
          }
        } catch (error: unknown) {
          // Exception occurred while fetching member
          return done(
            options?.propagateError ? buildError(error) : new UnauthorizedMember(),
            false,
          );
        }
      },
    ),
  );
};
