import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { REFRESH_TOKEN_JWT_SECRET } from '../../../../../utils/config';
import { MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors';
import { MemberRepository } from '../../../../member/repository';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  log: (msg: string) => void,
  memberRepository: MemberRepository,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.REFRESH_TOKEN,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: REFRESH_TOKEN_JWT_SECRET,
      },
      async ({ sub }, done: StrictVerifiedCallback) => {
        memberRepository
          .get(sub)
          .then((member) => {
            if (member) {
              // Token has been validated
              // Error is null, user payload contains the UUID.
              done(null, { member });
            } else {
              // Authentication refused
              return done(
                options?.spreadException ? new MemberNotFound(sub) : new UnauthorizedMember(),
                false,
              );
            }
          })
          .catch((err) => {
            // Exception occurred
            log(err);
            done(options?.spreadException ? err : new UnauthorizedMember(), false);
          });
      },
    ),
  );
};
