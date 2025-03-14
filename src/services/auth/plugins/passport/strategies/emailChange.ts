import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { db } from '../../../../../drizzle/db.js';
import { EMAIL_CHANGE_JWT_SECRET } from '../../../../../utils/config.js';
import { MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors.js';
import { MemberRepository } from '../../../../member/member.repository.js';
import { PassportStrategy } from '../strategies.js';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types.js';

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
      async ({ uuid, oldEmail, newEmail }, done: StrictVerifiedCallback) => {
        try {
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
        } catch (err) {
          // Exception occurred while fetching member
          return done(options?.propagateError ? err : new UnauthorizedMember(), false);
        }
      },
    ),
  );
};
