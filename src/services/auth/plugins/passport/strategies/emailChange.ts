import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { EMAIL_CHANGE_JWT_SECRET } from '../../../../../utils/config';
import { MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors';
import { MemberRepository } from '../../../../member/repository';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

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
          const member = await memberRepository.get(uuid);
          // We check the email, so we invalidate the token if the email has changed in the meantime.
          if (member && member.email === oldEmail) {
            // Token has been validated
            return done(null, { account: member, emailChange: { newEmail } });
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
